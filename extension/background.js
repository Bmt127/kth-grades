const APP_URL_PATTERNS = ['https://bmt127.github.io/kth-grades/*', 'http://localhost:5173/*'];
const APP_FALLBACK_URL = 'https://bmt127.github.io/kth-grades/';

// Watching the network directly (instead of asking the content script to
// scan performance.getEntriesByType, which has a limited buffer that a cold,
// fresh two-factor login can overflow before the requests we care about ever
// fire) so the student UID / proxy id are never missed regardless of how
// many other requests the page makes first.
const STUDENT_UID_REGEX =
  /\/(?:studentinformation|studiedeltagande)\/internal\/(?:tillfallesdeltagande\/kurstillfallesdeltagande\/student|student)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const PROXY_REGEX = /\/student\/proxy\/(\d+)\//;

const discoveredIds = new Map(); // tabId -> { studentUID, proxyId }

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const existing = discoveredIds.get(details.tabId) || {};
    const uidMatch = details.url.match(STUDENT_UID_REGEX);
    const proxyMatch = details.url.match(PROXY_REGEX);
    if (uidMatch) existing.studentUID = uidMatch[1];
    if (proxyMatch) existing.proxyId = proxyMatch[1];
    if (uidMatch || proxyMatch) discoveredIds.set(details.tabId, existing);
  },
  { urls: ['https://student.ladok.se/*', 'https://www.student.ladok.se/*'] }
);

chrome.tabs.onRemoved.addListener((tabId) => discoveredIds.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'kth-grades-get-session-ids') return;
  const tabId = sender.tab && sender.tab.id;
  sendResponse(tabId != null ? discoveredIds.get(tabId) || null : null);
});

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
