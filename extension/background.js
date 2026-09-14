const APP_URL_PATTERNS = ['https://bmt127.github.io/kth-grades/*', 'http://localhost:5173/*'];
const APP_FALLBACK_URL = 'https://bmt127.github.io/kth-grades/';

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'kth-grades-ladok-data') return;

  (async () => {
    try {
      let [tab] = await chrome.tabs.query({ url: APP_URL_PATTERNS });
      if (!tab) {
        tab = await chrome.tabs.create({ url: APP_FALLBACK_URL, active: false });
        await waitForTabComplete(tab.id);
      } else {
        // An already-open tab may be running a stale bundle from before the
        // app's own code last changed — a plain static-site reload doesn't
        // reach it. Force a reload so it's guaranteed to run the latest code
        // (and have the message listener actually mounted) before we send.
        // Attach the wait *before* triggering the reload so we can't miss
        // the "complete" transition.
        const reloaded = waitForTabComplete(tab.id);
        await chrome.tabs.reload(tab.id);
        await reloaded;
      }
      await chrome.tabs.sendMessage(tab.id, { type: 'kth-grades-ladok-data', text: message.text, courses: message.courses });
      // Import succeeded — take the user straight to the result.
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // keep the message channel open for the async sendResponse
});
