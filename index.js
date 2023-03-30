chrome.storage.local
  .get(["gh_notifications_token", "stopped"])
  .then((result) => {
    document.getElementById("token").value =
      result.gh_notifications_token || "";
    document.getElementById("start").disabled = !result.stopped;
    document.getElementById("stop").disabled = !!result.stopped;
  });

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (key === "stopped") {
      document.getElementById("start").disabled = oldValue;
      document.getElementById("stop").disabled = newValue;
    }
  }
});

document.getElementById("token").addEventListener("change", (event) => {
  let token = event.target.value;
  chrome.storage.local
    .set({ gh_notifications_token: token, stopped: false })
    .then(() => {
      alert(token);
    });
});

document.getElementById("start").addEventListener("click", (event) => {
  chrome.storage.local.set({ stopped: false });
});

document.getElementById("stop").addEventListener("click", (event) => {
  chrome.storage.local.set({ stopped: true });
});
