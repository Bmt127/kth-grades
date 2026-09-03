export const LADOK_URL = 'https://www.student.ladok.se/student/app/studentwebb/min-utbildning';
export const LADOK_MESSAGE_SOURCE = 'kth-grades-ladok-import';

// Runs on the Ladok tab, not on this site. It never touches credentials or
// cookies — it just reads the already-rendered page text and posts it back to
// the tab that opened it (window.opener), scoped to that tab's own origin.
function bookmarkletSource(): void {
  try {
    const w = window as unknown as { opener?: Window };
    if (!w.opener) {
      alert("Open this from kth-grades's \"Connect via Ladok\" button first — this bookmarklet only works in a tab opened by that button.");
      return;
    }
    const targetOrigin = document.referrer ? new URL(document.referrer).origin : '*';
    const text = document.body.innerText;
    w.opener.postMessage({ source: 'kth-grades-ladok-import', text }, targetOrigin);
    alert('Sent to kth-grades! You can close this tab now.');
  } catch (err) {
    alert('Could not send data: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export function getBookmarkletHref(): string {
  const body = bookmarkletSource
    .toString()
    .replace(/^function\s*\w*\s*\([^)]*\)\s*{/, '')
    .replace(/}$/, '');
  return 'javascript:(function(){' + body + '})();';
}
