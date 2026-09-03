// Runs only on student.ladok.se. Adds a floating button that sends the
// already-rendered page text to the kth-grades app tab — never touches
// credentials, cookies, or Ladok's own network requests.
(function () {
  if (document.getElementById('kth-grades-send-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'kth-grades-send-btn';
  btn.textContent = '📥 Send to kth-grades';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 2147483647,
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '9999px',
    padding: '12px 20px',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    cursor: 'pointer',
  });

  btn.addEventListener('click', () => {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    chrome.runtime.sendMessage(
      { type: 'kth-grades-ladok-data', text: document.body.innerText },
      (resp) => {
        btn.disabled = false;
        btn.textContent = resp && resp.ok ? '✅ Sent!' : '⚠️ Failed — try again';
        setTimeout(() => { btn.textContent = original; }, 2500);
      }
    );
  });

  document.body.appendChild(btn);
})();
