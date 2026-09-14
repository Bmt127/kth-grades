// Runs on every student.ladok.se page. Automatically fetches every completed
// course and its grade directly from Ladok's own internal API (the same
// same-origin proxy Ladok's own web app uses) and sends the structured
// result to the kth-grades app in the background — no button, no DOM
// scraping, no manual navigation. Session/session id are discovered the same
// way KTH's own "kth-ladok-gpa" widget does: read out of network requests
// the page itself already made, never guessed or constructed.
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

  // background.js watches the network directly via chrome.webRequest (no
  // buffer limit, unlike performance.getEntriesByType, which a cold, fresh
  // two-factor login can overflow before the requests we need ever fire)
  // and remembers the student UID / proxy id it's seen for this tab.
  function getSessionIdsFromBackground() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'kth-grades-get-session-ids' }, (resp) => resolve(resp || null));
    });
  }

  function waitForSessionIds({ timeoutMs = 90000, intervalMs = 1000 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      (async function poll() {
        const ids = await getSessionIdsFromBackground();
        if (ids && ids.studentUID && ids.proxyId) return resolve(ids);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(poll, intervalMs);
      })();
    });
  }

  async function fetchJson(url, mediaType) {
    const res = await fetch(url, {
      headers: { Accept: `application/vnd.ladok-${mediaType}+json` },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(`Request failed (${res.status}): ${url}`);
    return res.json();
  }

  function toProxyUrl(apiUrl, service, proxyId) {
    return apiUrl.replace(
      `https://api.ladok.se:443/${service}`,
      `https://student.ladok.se/student/proxy/${proxyId}/${service}`
    );
  }

  async function fetchStudiestruktur(studentUID, proxyId) {
    const url = `https://student.ladok.se/student/proxy/${proxyId}/studiedeltagande/internal/studiestruktur/student/${studentUID}`;
    return fetchJson(url, 'studiedeltagande');
  }

  function courseName(kurs) {
    const benamning = kurs.Utbildningsinformation?.Benamning;
    if (typeof benamning === 'string' && benamning) return benamning;
    if (benamning && typeof benamning === 'object') {
      return benamning.sv || benamning.en || Object.values(benamning)[0] || '';
    }
    return '';
  }

  async function fetchProgramCourses(programNode, proxyId) {
    const link = (programNode.link || []).find((l) => l.rel.includes('paborjade_kurser'));
    if (!link) return { Tillfallesdeltaganden: [] };
    const url = toProxyUrl(link.uri, 'studiedeltagande', proxyId);
    return fetchJson(url, 'studiedeltagande');
  }

  function pickAttestedKursversion(kursversioner) {
    if (!kursversioner || !kursversioner.length) return undefined;
    const withGrade = kursversioner.find(
      (kv) => kv?.VersionensKurs?.ResultatPaUtbildning?.SenastAttesteradeResultat?.Betygsgradsobjekt?.Kod
    );
    return withGrade || kursversioner[0];
  }

  async function fetchGradeForCourse(kurs, proxyId) {
    const kurskod = kurs.Utbildningsinformation.Utbildningskod;
    const link = (kurs.link || []).find((l) => l.rel.includes('egenkursinformation'));
    if (!link) return { kurskod, betyg: null, hp: null };
    try {
      const url = toProxyUrl(link.uri, 'resultat', proxyId);
      const data = await fetchJson(url, 'resultat');
      const kv = pickAttestedKursversion(data.Kursversioner);
      const betyg = kv?.VersionensKurs?.ResultatPaUtbildning?.SenastAttesteradeResultat?.Betygsgradsobjekt?.Kod ?? null;
      const hp = kv?.VersionensKurs?.Omfattning ?? null;
      return { kurskod, betyg, hp };
    } catch (err) {
      console.warn('[kth-grades] Could not fetch grade for', kurskod, err);
      return { kurskod, betyg: null, hp: null };
    }
  }

  // Operates on {kurs, programKod, programName} entries (not raw kurs
  // objects) so the program a retaken course is deduped down to is kept.
  function dedupeRetakenEntries(entries) {
    const byKurskod = new Map();
    const withoutKurskod = [];
    for (const e of entries) {
      const kod = e.kurs.Utbildningsinformation?.Utbildningskod;
      if (!kod) {
        withoutKurskod.push(e);
        continue;
      }
      const existing = byKurskod.get(kod);
      if (!existing) {
        byKurskod.set(kod, e);
        continue;
      }
      const existingStart = new Date(existing.kurs.Utbildningsinformation?.Studieperiod?.Startdatum || 0);
      const currentStart = new Date(e.kurs.Utbildningsinformation?.Studieperiod?.Startdatum || 0);
      if (currentStart >= existingStart) byKurskod.set(kod, e);
    }
    return [...withoutKurskod, ...byKurskod.values()];
  }

  function programLabel(node) {
    const info = node.Utbildningsinformation || {};
    const benamning = info.Benamning;
    if (typeof benamning === 'string' && benamning) return benamning;
    if (benamning && typeof benamning === 'object') {
      return benamning.sv || benamning.en || Object.values(benamning)[0] || info.Utbildningskod;
    }
    return info.Utbildningskod || 'Okänt program';
  }

  function normalizeGrade(raw) {
    if (!raw) return null;
    const upper = String(raw).trim().toUpperCase();
    if (upper === 'FX') return 'Fx';
    if (['A', 'B', 'C', 'D', 'E', 'F', 'P'].includes(upper)) return upper;
    return null;
  }

  async function collectCourses(studentUID, proxyId) {
    const struct = await fetchStudiestruktur(studentUID, proxyId);
    const programNodes = (struct.Studiestrukturer || []).filter(
      (s) => s.Utbildningsinformation?.Utbildningskod
    );

    const perProgram = await Promise.all(
      programNodes.map(async (node) => {
        const data = await fetchProgramCourses(node, proxyId);
        const programKod = node.Utbildningsinformation.Utbildningskod;
        const programName = programLabel(node);
        return (data.Tillfallesdeltaganden || []).map((kurs) => ({ kurs, programKod, programName }));
      })
    );
    const entries = dedupeRetakenEntries(perProgram.flat());
    const grades = await Promise.all(entries.map((e) => fetchGradeForCourse(e.kurs, proxyId)));

    const courses = [];
    for (let i = 0; i < entries.length; i++) {
      const { kurs, programKod, programName } = entries[i];
      const grade = normalizeGrade(grades[i].betyg);
      if (!grade) continue; // ongoing, or a code we don't recognize — skip rather than guess

      courses.push({
        id: crypto.randomUUID(),
        code: kurs.Utbildningsinformation.Utbildningskod,
        name: courseName(kurs),
        credits: grades[i].hp ?? 0,
        grade,
        date: kurs.Utbildningsinformation?.Studieperiod?.Startdatum || '',
        period: '',
        program: programKod,
        programName,
      });
    }
    return courses;
  }

  async function runImport() {
    if (alreadyRunning) return;
    alreadyRunning = true;

    showToast('Väntar på Ladok…', true);
    const ids = await waitForSessionIds();
    if (!ids) {
      showToast('⚠️ Hittade ingen aktiv Ladok-session — ladda om sidan', false);
      alreadyRunning = false; // allow a later retry (e.g. a manual reload)
      return;
    }
    const { studentUID, proxyId } = ids;

    showToast('Hämtar dina betyg…', true);

    try {
      const courses = await collectCourses(studentUID, proxyId);
      if (courses.length === 0) {
        showToast('⚠️ Hittade inga avklarade kurser', false);
        return;
      }

      chrome.runtime.sendMessage({ type: 'kth-grades-ladok-data', courses }, (resp) => {
        showToast(
          resp && resp.ok ? `✅ ${courses.length} betyg skickade till kth-grades` : '⚠️ Kunde inte skicka betyg',
          Boolean(resp && resp.ok)
        );
      });
    } catch (err) {
      console.error('[kth-grades] Import failed', err);
      showToast('⚠️ Kunde inte hämta betyg från Ladok', false);
    }
  }

  // Runs at document_start so background.js's webRequest listener is
  // guaranteed to already be watching before the page's own requests start —
  // but that means document.body may not exist yet, so wait for it.
  function start() {
    setTimeout(runImport, 500);
  }
  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
