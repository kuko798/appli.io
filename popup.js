document.getElementById("sync").onclick = () => {
  document.getElementById("status").innerText = "Syncing...";
  chrome.runtime.sendMessage({ action: "sync" }, response => {
    document.getElementById("status").innerText = response;
  });
};