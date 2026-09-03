// Runs only on the kth-grades app. Relays the extension message into a
// window.postMessage, matching the format the app already listens for
// (LADOK_MESSAGE_SOURCE in src/ladokBookmarklet.ts) — no app code changes needed.
(function () {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'kth-grades-ladok-data') return;
    window.postMessage({ source: 'kth-grades-ladok-import', text: message.text }, window.location.origin);
    sendResponse({ ok: true });
  });
})();
