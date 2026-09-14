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

  const STUDENT_UID_REGEX =
    /\/(?:studentinformation|studiedeltagande)\/internal\/(?:tillfallesdeltagande\/kurstillfallesdeltagande\/student|student)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const PROXY_REGEX = /\/student\/proxy\/(\d+)\//;

  function findFromPerformanceEntries(regex) {
    const entries = performance.getEntriesByType('resource');
    for (const entry of entries) {
      const match = entry.name.match(regex);
      if (match) return match[1];
    }
    return null;
  }

  function waitForValue(regex, { timeoutMs = 15000, intervalMs = 500 } = {}) {
    return new Promise((resolve) => {
      const existing = findFromPerformanceEntries(regex);
      if (existing) return resolve(existing);
      const start = Date.now();
      const timer = setInterval(() => {
        const found = findFromPerformanceEntries(regex);
        if (found) {
          clearInterval(timer);
          resolve(found);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, intervalMs);
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

  function dedupeRetakenCourses(kurser) {
    const byKurskod = new Map();
    const withoutKurskod = [];
    for (const k of kurser) {
      const kod = k.Utbildningsinformation?.Utbildningskod;
      if (!kod) {
        withoutKurskod.push(k);
        continue;
      }
      const existing = byKurskod.get(kod);
      if (!existing) {
        byKurskod.set(kod, k);
        continue;
      }
      const existingStart = new Date(existing.Utbildningsinformation?.Studieperiod?.Startdatum || 0);
      const currentStart = new Date(k.Utbildningsinformation?.Studieperiod?.Startdatum || 0);
      if (currentStart >= existingStart) byKurskod.set(kod, k);
    }
    return [...withoutKurskod, ...byKurskod.values()];
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

    const courseDataList = await Promise.all(programNodes.map((n) => fetchProgramCourses(n, proxyId)));
    const rawKurser = courseDataList.flatMap((cd) => cd.Tillfallesdeltaganden || []);
    const kurser = dedupeRetakenCourses(rawKurser);
    const grades = await Promise.all(kurser.map((k) => fetchGradeForCourse(k, proxyId)));

    const courses = [];
    for (let i = 0; i < kurser.length; i++) {
      const kurs = kurser[i];
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
      });
    }
    return courses;
  }

  async function runImport() {
    if (alreadyRunning) return;
    alreadyRunning = true;

    const studentUID = await waitForValue(STUDENT_UID_REGEX, { timeoutMs: 8000 });
    const proxyId = await waitForValue(PROXY_REGEX, { timeoutMs: 8000 });
    if (!studentUID || !proxyId) {
      alreadyRunning = false; // page may not have made the relevant requests yet — allow a later retry
      return;
    }

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

  // Give the page a moment to make its own API calls (which is how we
  // discover the student UID / proxy id) before we look for them.
  setTimeout(runImport, 1500);
})();
