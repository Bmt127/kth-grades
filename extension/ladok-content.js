// Runs on every student.ladok.se page. Automatically finds and sends the
// rendered grade text to the kth-grades app — no button, no manual page
// navigation. Never touches credentials, cookies, or Ladok's own network
// requests; only reads text that's already visible on the page.
(function () {
  const TOAST_ID = 'kth-grades-toast';
  let alreadySent = false;

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
    }, 4000);
  }

  // Heuristic: does the visible text contain a course-code-then-grade pattern,
  // like a real "Studieresultat" listing would? Mirrors the shape ladokParser.ts
  // looks for, without needing to know Ladok's actual DOM structure.
  function looksLikeResults(text) {
    return /\b[A-ZÅÄÖ]{2,4}\d{3,4}[A-ZÅÄÖ]?\b[\s\S]{0,40}\b(Fx|FX|[A-F]|P|G|VG|U)\b/.test(text);
  }

  function send(text) {
    if (alreadySent) return;
    alreadySent = true;
    chrome.runtime.sendMessage({ type: 'kth-grades-ladok-data', text }, (resp) => {
      showToast(
        resp && resp.ok ? '✅ Betyg skickade till kth-grades' : '⚠️ Kunde inte skicka betyg',
        Boolean(resp && resp.ok)
      );
    });
  }

  function findStudieresultatLink() {
    const candidates = Array.from(document.querySelectorAll('a, button'));
    return candidates.find((el) => /studieresultat/i.test(el.textContent || ''));
  }

  function tryAutoImport(attemptsLeft) {
    if (alreadySent) return;

    if (looksLikeResults(document.body.innerText)) {
      send(document.body.innerText);
      return;
    }

    if (attemptsLeft <= 0) return;

    const link = findStudieresultatLink();
    if (!link) {
      // Nothing to click yet (page still loading) — try again shortly.
      setTimeout(() => tryAutoImport(attemptsLeft - 1), 1000);
      return;
    }

    const cameFrom = location.href;
    link.click();

    setTimeout(() => {
      if (looksLikeResults(document.body.innerText)) {
        send(document.body.innerText);
        // We navigated on the user's behalf — take them back to where they were.
        if (location.href !== cameFrom) history.back();
      } else {
        tryAutoImport(attemptsLeft - 1);
      }
    }, 1200);
  }

  // Give the SPA a moment to finish its own initial render before we look.
  setTimeout(() => tryAutoImport(3), 800);
})();
