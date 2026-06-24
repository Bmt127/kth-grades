import type { Course, Grade } from './types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

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

interface TextItem {
  text: string;
  x: number;
  y: number;
}

async function extractTextItems(file: File): Promise<TextItem[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const items: TextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageHeight = (page.view[3] - page.view[1]);

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      items.push({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        // Normalize y so page 1 items come before page 2
        y: (i - 1) * 10000 + (pageHeight - item.transform[5]),
      });
    }
  }

  return items;
}

export async function parsePdf(file: File): Promise<Course[]> {
  const items = await extractTextItems(file);

  // Group items into rows by y position (within 3px tolerance)
  const rows = new Map<number, TextItem[]>();
  for (const item of items) {
    let matchedY: number | null = null;
    for (const existingY of rows.keys()) {
      if (Math.abs(existingY - item.y) < 4) {
        matchedY = existingY;
        break;
      }
    }
    const key = matchedY ?? item.y;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(item);
  }

  // Sort rows top to bottom, items left to right within each row
  const sortedRows = [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // Identify columns by looking for header row with "Benämning", "Omfattning", "Betyg", "Datum"
  // or English: "Name"/"Course", "Credits"/"Scope", "Grade", "Date"
  let headerRowIdx = -1;
  let columns: { name: number; credits: number; grade: number; date: number } | null = null;

  for (let i = 0; i < sortedRows.length; i++) {
    const rowText = sortedRows[i].map(it => it.text.toLowerCase());
    const hasName = rowText.some(t => t.includes('benämning') || t.includes('course') || t.includes('name'));
    const hasGrade = rowText.some(t => t.includes('betyg') || t.includes('grade'));

    if (hasName && hasGrade) {
      headerRowIdx = i;
      const nameItem = sortedRows[i].find(it =>
        it.text.toLowerCase().includes('benämning') || it.text.toLowerCase().includes('course')
      );
      const creditsItem = sortedRows[i].find(it =>
        it.text.toLowerCase().includes('omfattning') || it.text.toLowerCase().includes('credits') || it.text.toLowerCase().includes('scope')
      );
      const gradeItem = sortedRows[i].find(it =>
        it.text.toLowerCase().includes('betyg') || it.text.toLowerCase().includes('grade')
      );
      const dateItem = sortedRows[i].find(it =>
        it.text.toLowerCase().includes('datum') || it.text.toLowerCase().includes('date')
      );

      columns = {
        name: nameItem?.x ?? 0,
        credits: creditsItem?.x ?? 200,
        grade: gradeItem?.x ?? 400,
        date: dateItem?.x ?? 500,
      };
      break;
    }
  }

  // Fallback: if no header found, try to parse by pattern matching each row
  if (!columns) {
    return parsePdfByPatterns(sortedRows);
  }

  const courses: Course[] = [];
  const threshold = 60; // x-position tolerance for column assignment

  for (let i = headerRowIdx + 1; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const rowTextJoined = row.map(it => it.text).join(' ');

    // Stop at "Summering" or footer sections
    if (rowTextJoined.toLowerCase().includes('summering') ||
        rowTextJoined.toLowerCase().includes('kontrollera intyget') ||
        rowTextJoined.toLowerCase().includes('noter och information')) {
      break;
    }

    // Assign each item to the nearest column
    let name = '';
    let credits = '';
    let grade = '';
    let date = '';

    for (const item of row) {
      const distName = Math.abs(item.x - columns.name);
      const distCredits = Math.abs(item.x - columns.credits);
      const distGrade = Math.abs(item.x - columns.grade);
      const distDate = Math.abs(item.x - columns.date);
      const minDist = Math.min(distName, distCredits, distGrade, distDate);

      if (minDist === distName && distName < threshold) {
        name = name ? name + ' ' + item.text : item.text;
      } else if (minDist === distCredits && distCredits < threshold) {
        credits = item.text;
      } else if (minDist === distGrade && distGrade < threshold) {
        grade = item.text;
      } else if (minDist === distDate && distDate < threshold) {
        date = item.text;
      }
    }

    if (!name || !grade) continue;

    const normalizedGrade = normalizeGrade(grade);
    if (!normalizedGrade) continue;

    const creditsNum = parseFloat(credits.replace(',', '.').replace(/[^\d.]/g, '')) || 0;

    courses.push({
      id: crypto.randomUUID(),
      code: '',
      name: name.trim(),
      credits: creditsNum,
      grade: normalizedGrade,
      date,
      period: '',
    });
  }

  return courses;
}

// Fallback parser using regex patterns on reconstructed lines
function parsePdfByPatterns(sortedRows: TextItem[][]): Course[] {
  const courses: Course[] = [];
  const gradeRe = /\b(Fx|FX|[A-F]|P|G|VG|U)\b/;
  const creditsRe = /(\d+[.,]\d)\s*hp/i;
  const dateRe = /\b(\d{4}-\d{2}-\d{2})\b/;

  for (const row of sortedRows) {
    const line = row.map(it => it.text).join(' ');

    const gradeMatch = line.match(gradeRe);
    const creditsMatch = line.match(creditsRe);
    const dateMatch = line.match(dateRe);

    if (!gradeMatch) continue;

    const grade = normalizeGrade(gradeMatch[1]);
    if (!grade) continue;

    // Extract name by removing the grade, credits, date, and note number
    let name = line
      .replace(creditsRe, '')
      .replace(gradeRe, '')
      .replace(dateRe, '')
      .replace(/\b\d{1,2}\b/g, '') // note numbers
      .replace(/\s+/g, ' ')
      .trim();

    if (name.length < 2) continue;

    const creditsStr = creditsMatch ? creditsMatch[1].replace(',', '.') : '0';

    courses.push({
      id: crypto.randomUUID(),
      code: '',
      name,
      credits: parseFloat(creditsStr) || 0,
      grade,
      date: dateMatch ? dateMatch[1] : '',
      period: '',
    });
  }

  return courses;
}
