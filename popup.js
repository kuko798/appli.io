document.getElementById("sync").onclick = () => {
  const range = document.getElementById("date-range").value;
  document.getElementById("status").innerText = "Syncing...";

  chrome.runtime.sendMessage({ action: "sync", range: range }, response => {
    document.getElementById("status").innerText = response;
  });
};

document.getElementById("view-dashboard").onclick = () => {
  chrome.tabs.create({ url: "dashboard.html" });
};