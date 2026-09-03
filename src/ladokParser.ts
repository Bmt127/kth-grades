import type { Course, Grade } from './types';

const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P']);

function normalizeGrade(raw: string): Grade | null {
  const upper = raw.trim().toUpperCase();
  if (upper === 'FX') return 'Fx';
  if (VALID_GRADES.has(upper)) return upper as Grade;
  if (upper === 'G') return 'P';
  if (upper === 'VG') return 'P';
  if (upper === 'U') return 'F';
  return null;
}

export interface LadokResult {
  courses: Course[];
  studentName: string | null;
}

// Parses the plain visible text of a Ladok "studieresultat" page (captured by the
// bookmarklet via document.body.innerText). Line-by-line, pattern-based — Ladok's
// page layout isn't guaranteed, so this mirrors the PDF fallback parser rather than
// relying on any specific DOM/column structure.
export function parseLadokText(text: string): LadokResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let studentName: string | null = null;
  for (const line of lines) {
    const m = line.match(/^(namn|name)[:\s]+(.+)$/i);
    if (m) {
      studentName = m[2].trim();
      break;
    }
  }

  const codeRe = /\b([A-ZÅÄÖ]{2,4}\d{3,4}[A-ZÅÄÖ]?)\b/;
  const gradeRe = /\b(Fx|FX|[A-F]|P|G|VG|U)\b/;
  const creditsRe = /(\d+[.,]\d)\s*hp/i;
  const dateRe = /\b(\d{4}-\d{2}-\d{2})\b/;

  const courses: Course[] = [];
  for (const line of lines) {
    const codeMatch = line.match(codeRe);
    const gradeMatch = line.match(gradeRe);
    if (!codeMatch || !gradeMatch) continue;

    const grade = normalizeGrade(gradeMatch[1]);
    if (!grade) continue;

    const creditsMatch = line.match(creditsRe);
    const dateMatch = line.match(dateRe);

    const name = line
      .replace(codeRe, '')
      .replace(creditsRe, '')
      .replace(gradeRe, '')
      .replace(dateRe, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (name.length < 2) continue;

    courses.push({
      id: crypto.randomUUID(),
      code: codeMatch[1],
      name,
      credits: creditsMatch ? parseFloat(creditsMatch[1].replace(',', '.')) || 0 : 0,
      grade,
      date: dateMatch ? dateMatch[1] : '',
      period: '',
    });
  }

  return { courses, studentName };
}
