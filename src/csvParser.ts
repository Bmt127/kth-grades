import type { Course, Grade } from './types';

const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P']);

export function parseCSV(text: string): Course[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const sep = header.includes('\t') ? '\t' : header.includes(';') ? ';' : ',';
  const cols = lines[0].split(sep).map(c => c.trim().toLowerCase());

  const codeIdx = cols.findIndex(c => c === 'code' || c === 'kurskod' || c === 'course code');
  const nameIdx = cols.findIndex(c => c === 'name' || c === 'kursnamn' || c === 'course name' || c === 'course');
  const creditsIdx = cols.findIndex(c => c === 'credits' || c === 'hp' || c === 'omfattning' || c === 'scope');
  const gradeIdx = cols.findIndex(c => c === 'grade' || c === 'betyg' || c === 'result');
  const dateIdx = cols.findIndex(c => c === 'date' || c === 'datum' || c === 'examination date');
  const periodIdx = cols.findIndex(c => c === 'period' || c === 'termin' || c === 'semester');

  if (codeIdx === -1 && nameIdx === -1) {
    throw new Error('Could not find course code or name column. Expected headers: Code, Name, Credits, Grade, Date, Period');
  }

  const courses: Course[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = line.split(sep).map(f => f.trim());

    const rawGrade = gradeIdx !== -1 ? fields[gradeIdx] : '';
    const grade = rawGrade.charAt(0).toUpperCase() + rawGrade.slice(1);

    if (!VALID_GRADES.has(grade)) continue;

    const rawCredits = creditsIdx !== -1 ? fields[creditsIdx].replace(',', '.') : '0';

    courses.push({
      id: crypto.randomUUID(),
      code: codeIdx !== -1 ? fields[codeIdx].toUpperCase() : '',
      name: nameIdx !== -1 ? fields[nameIdx] : '',
      credits: parseFloat(rawCredits) || 0,
      grade: grade as Grade,
      date: dateIdx !== -1 ? fields[dateIdx] : '',
      period: periodIdx !== -1 ? fields[periodIdx] : '',
    });
  }

  return courses;
}

export function generateSampleCSV(): string {
  return `Code,Name,Credits,Grade,Date,Period
DD1337,Programming,6,A,2024-01-15,HT2023 P2
SF1624,Algebra and Geometry,7.5,B,2024-01-18,HT2023 P2
DD1338,Algorithms and Data Structures,9,A,2024-06-05,VT2024 P4`;
}
