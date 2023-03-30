import { Octokit } from "https://cdn.skypack.dev/@octokit/rest";

let stopped;

chrome.storage.local.get(["stopped"]).then((result) => {
  stopped = result.stopped;
});

chrome.storage.onChanged.addListener((changes, _) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (key === "stopped") {
      stopped = newValue;
      if (!newValue) getNotifications();
    }
  }
});

function pushNotification(id, title, message) {
  chrome.notifications.create(id, {
    title: "GitHub Notification",
    message: title,
    contextMessage: message,
    iconUrl: "gh-logo-512.png",
    type: "basic",
    appIconMaskUrl: "gh-logo-512.png",
  });
}

function getHeaders(token) {
  const headers = new Headers({
    Accept: "application/vnd.github+json",
    Authorization: `bearer ${token}`,
  });
  return headers;
}

function onClick(notificationId) {
  let id = `${notificationId}`;
  chrome.storage.local.get([id]).then((result) => {
    if (!result[id]) {
      chrome.notifications.clear(notificationId);
      return;
    }
    let notification = JSON.parse(result[id]);
    if (!notification) return;
    let url = notification.subject.url;
    let threadsUrl = notification.url;
    if (url) {
      let urlParts = url.split("/");
      let htmlUrl = `${notification.repository.html_url}/pull/${
        urlParts[urlParts.length - 1]
      }`;
      chrome.tabs.create({ url: htmlUrl });
      const headers = getHeaders(token);
      fetch(threadsUrl, {
        method: "PATCH",
        headers,
      })
        .then((response) => {
          if (response.status === 205) {
            chrome.notifications.clear(notificationId);
          }
        })
        .catch((err) => {
          console.error(err);
          chrome.notifications.clear(notificationId);
        });
    } else {
      chrome.notifications.clear(notificationId);
    }
  });
}

chrome.notifications.onClicked.addListener(onClick);

let token;
let octokit;

async function getToken() {
  let result = await chrome.storage.local.get(["gh_notifications_token"]);
  token = result.gh_notifications_token;
  if (!token) {
    console.error("No API token found");
  }
  octokit = new Octokit({
    auth: token,
    userAgent: "gh-notifier-extension v0.1.0",
  });
}

async function startupListener() {
  if (!token) await getToken();
  if (!stopped) await getNotifications();
  chrome.alarms.create("refresh", { periodInMinutes: 1 });
}

chrome.runtime.onStartup.addListener(startupListener);
chrome.runtime.onInstalled.addListener(startupListener);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (stopped) return;
  if (alarm.name === "refresh") {
    await getNotifications();
  }
});

async function getNotifications() {
  console.log("Getting notifications", token, stopped);

  if (stopped) return;
  if (!token) await getToken();

  try {
    let response = await octokit.request("GET /notifications", {
      all: false,
      participating: true,
    });
    console.log("Full response: ", response);
    for (let i = 0; i < response.data.length; i++) {
      let notification = response.data[i];
      console.log(notification);
      let updateId = `${notification.id}${notification.updated_at}`;
      let existing = await chrome.storage.local.get([updateId]);
      if (existing[updateId]) {
        continue;
      }
      chrome.storage.local.set({
        [updateId]: JSON.stringify(notification),
      });
      pushNotification(
        updateId,
        notification.subject.title,
        notification.reason
      );
    }
  } catch (error) {
    pushNotification(
      `${error.status}${error.message}`,
      `${error.status}`,
      error.message
    );
  }
}
