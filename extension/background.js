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
        tab = await chrome.tabs.create({ url: APP_FALLBACK_URL, active: true });
        await waitForTabComplete(tab.id);
      } else {
        await chrome.tabs.update(tab.id, { active: true });
      }
      await chrome.tabs.sendMessage(tab.id, { type: 'kth-grades-ladok-data', text: message.text });
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();

  return true; // keep the message channel open for the async sendResponse
});
