// Runs on every student.ladok.se page. Automatically finds your completed
// courses on the "Min utbildning" overview, fetches each course's own detail
// page (same-origin, using the session you're already logged into — no
// credentials or cookies are ever touched or read by this script), reads out
// its final grade, and sends the result to the kth-grades app in the
// background. No button, no manual navigation.
(function () {
  const TOAST_ID = 'kth-grades-toast';
  let alreadyRunning = false;

  function showToast(message, ok) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement('div');
      toast.id = TOAST_ID;
      Object.assign(toast.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 2147483647,
        color: '#fff',
        borderRadius: '9999px',
        padding: '12px 20px',
        fontSize: '14px',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: '600',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        transition: 'opacity 0.3s',
      });
      document.body.appendChild(toast);
    }
    toast.style.background = ok ? '#16a34a' : '#dc2626';
    toast.style.opacity = '1';
    toast.textContent = message;
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 5000);
  }

  const CODE_RE = /\b([A-ZÅÄÖ]{2,4}\d{3,4}[A-ZÅÄÖ]?)\b/;
  const GRADE_RE = /Slutbetyg\s*:?\s*[^()\n]*\(([A-Za-zÅÄÖåäö]{1,3})\)/i;
  const CREDITS_RE = /(\d+[.,]\d)\s*(?:hp|fup)/i;

  function findCourseRows() {
    const links = Array.from(document.querySelectorAll('a[href*="/min-utbildning/kurs/"]'));
    const seen = new Set();
    const rows = [];
    for (const link of links) {
      if (seen.has(link.href)) continue;
      seen.add(link.href);

      // Walk up a few ancestors to find the row containing this course's
      // status/credits text — Ladok's exact markup isn't documented.
      let row = link;
      for (let i = 0; i < 5 && row.parentElement; i++) {
        row = row.parentElement;
        if (row.innerText && row.innerText.length < 400) break;
      }
      const rowText = row.innerText || '';
      if (!/Avklarad/i.test(rowText)) continue; // skip ongoing/registered courses — no grade yet

      rows.push({ href: link.href, creditsHint: (rowText.match(CREDITS_RE) || [])[1] || null });
    }
    return rows;
  }

  async function fetchCourseGrade(row) {
    const res = await fetch(row.href, { credentials: 'same-origin' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body ? doc.body.innerText || doc.body.textContent || '' : '';

    const codeMatch = text.slice(0, 600).match(CODE_RE);
    const gradeMatch = text.match(GRADE_RE);
    if (!codeMatch || !gradeMatch) return null;

    const credits = (text.match(CREDITS_RE) || [])[1] || row.creditsHint || '0,0';
    return `${codeMatch[1]} ${credits} hp ${gradeMatch[1]}`;
  }

  async function runImport() {
    if (alreadyRunning) return;
    const rows = findCourseRows();
    if (rows.length === 0) return; // not on (or nothing found on) the course overview page

    alreadyRunning = true;
    showToast(`Hämtar betyg för ${rows.length} kurser…`, true);

    const lines = [];
    for (const row of rows) {
      try {
        const line = await fetchCourseGrade(row);
        if (line) lines.push(line);
      } catch (err) {
        console.warn('[kth-grades] Failed to read course page', row.href, err);
      }
    }

    if (lines.length === 0) {
      showToast('⚠️ Hittade inga betyg att importera', false);
      return;
    }

    chrome.runtime.sendMessage({ type: 'kth-grades-ladok-data', text: lines.join('\n') }, (resp) => {
      showToast(
        resp && resp.ok ? `✅ ${lines.length} betyg skickade till kth-grades` : '⚠️ Kunde inte skicka betyg',
        Boolean(resp && resp.ok)
      );
    });
  }

  // Give the SPA a moment to finish rendering the course list before we look.
  setTimeout(runImport, 1000);
})();
