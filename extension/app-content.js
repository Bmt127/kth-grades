// Runs only on the kth-grades app. Relays the extension message into a
// window.postMessage, matching the source the app already listens for
// (LADOK_MESSAGE_SOURCE in src/ladokBookmarklet.ts). Carries either raw
// `text` (bookmarklet-style, parsed by the app) or already-structured
// `courses` (fetched directly from Ladok's API by ladok-content.js).
(function () {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'kth-grades-ladok-data') return;
    window.postMessage(
      { source: 'kth-grades-ladok-import', text: message.text, courses: message.courses },
      window.location.origin
    );
    sendResponse({ ok: true });
  });
})();
