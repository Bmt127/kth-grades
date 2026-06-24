import type { Course, Grade } from './types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P']);

// Fix text where PDF extracted individual chars: "T e n t a m e n" → "Tentamen"
function fixSpacedText(text: string): string {
  // Detect if most "words" are single characters
  const parts = text.split(/\s+/);
  const singleChars = parts.filter(p => p.length === 1).length;
  if (singleChars > parts.length * 0.6 && parts.length > 3) {
    return parts.join('');
  }
  return text;
}

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

    if (!content.items || !Array.isArray(content.items)) continue;

    for (let j = 0; j < content.items.length; j++) {
      const item = content.items[j];
      if (!item || !('str' in item) || !item.str.trim()) continue;
      if (!item.transform || !Array.isArray(item.transform)) continue;
      items.push({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: (i - 1) * 10000 + (pageHeight - item.transform[5]),
      });
    }
  }

  return items;
}

export async function parsePdf(file: File): Promise<Course[]> {
  let items: TextItem[];
  try {
    items = await extractTextItems(file);
  } catch (err) {
    console.error('PDF text extraction failed:', err);
    throw new Error('Could not read this PDF. Make sure it is a Ladok resultatintyg (not a scanned image).');
  }
  if (items.length === 0) {
    throw new Error('No text found in this PDF. It may be a scanned image — try downloading a new copy from Ladok.');
  }

  // Group items into rows by y position (within 3px tolerance)
  const rows = new Map<number, TextItem[]>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let matchedY: number | null = null;
    const keys = Array.from(rows.keys());
    for (let k = 0; k < keys.length; k++) {
      if (Math.abs(keys[k] - item.y) < 4) {
        matchedY = keys[k];
        break;
      }
    }
    const key = matchedY ?? item.y;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key)!.push(item);
  }

  const sortedKeys = Array.from(rows.keys()).sort((a, b) => a - b);
  const sortedRows: TextItem[][] = [];
  for (let i = 0; i < sortedKeys.length; i++) {
    const rowItems = rows.get(sortedKeys[i])!;
    rowItems.sort((a, b) => a.x - b.x);
    sortedRows.push(rowItems);
  }

  // Find header row
  let headerRowIdx = -1;
  let columns: { name: number; credits: number; grade: number; date: number } | null = null;

  for (let i = 0; i < sortedRows.length; i++) {
    const rowTexts: string[] = [];
    for (let j = 0; j < sortedRows[i].length; j++) {
      rowTexts.push(sortedRows[i][j].text.toLowerCase());
    }
    const hasName = rowTexts.some(t => t.includes('benämning') || t.includes('course') || t.includes('name'));
    const hasGrade = rowTexts.some(t => t.includes('betyg') || t.includes('grade'));

    if (hasName && hasGrade) {
      headerRowIdx = i;
      let nameItem: TextItem | undefined;
      let creditsItem: TextItem | undefined;
      let gradeItem: TextItem | undefined;
      let dateItem: TextItem | undefined;

      for (let j = 0; j < sortedRows[i].length; j++) {
        const t = sortedRows[i][j].text.toLowerCase();
        if (t.includes('benämning') || t.includes('course')) nameItem = sortedRows[i][j];
        if (t.includes('omfattning') || t.includes('credits') || t.includes('scope')) creditsItem = sortedRows[i][j];
        if (t.includes('betyg') || t.includes('grade')) gradeItem = sortedRows[i][j];
        if (t.includes('datum') || t.includes('date')) dateItem = sortedRows[i][j];
      }

      columns = {
        name: nameItem?.x ?? 0,
        credits: creditsItem?.x ?? 200,
        grade: gradeItem?.x ?? 400,
        date: dateItem?.x ?? 500,
      };
      break;
    }
  }

  if (!columns) {
    return parsePdfByPatterns(sortedRows);
  }

  // First pass: parse all rows into structured data
  interface RawRow {
    name: string;
    credits: number;
    grade: Grade | null;
    date: string;
    isSubModule: boolean;
  }

  const allRows: RawRow[] = [];
  const threshold = 60;

  for (let i = headerRowIdx + 1; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    let rowTextJoined = '';
    for (let j = 0; j < row.length; j++) {
      rowTextJoined += row[j].text + ' ';
    }

    if (rowTextJoined.toLowerCase().includes('summering') ||
        rowTextJoined.toLowerCase().includes('kontrollera intyget') ||
        rowTextJoined.toLowerCase().includes('noter och information')) {
      break;
    }

    let name = '';
    let credits = '';
    let grade = '';
    let date = '';

    for (let j = 0; j < row.length; j++) {
      const item = row[j];
      const distName = Math.abs(item.x - columns.name);
      const distCredits = Math.abs(item.x - columns.credits);
      const distGrade = Math.abs(item.x - columns.grade);
      const distDate = Math.abs(item.x - columns.date);
      const minDist = Math.min(distName, distCredits, distGrade, distDate);

      if (minDist === distName && distName < threshold) {
        name = name ? name + ' ' + item.text : item.text;
      } else if (minDist === distCredits && distCredits < threshold) {
        credits = credits ? credits + ' ' + item.text : item.text;
      } else if (minDist === distGrade && distGrade < threshold) {
        grade = item.text;
      } else if (minDist === distDate && distDate < threshold) {
        date = item.text;
      }
    }

    if (!name) continue;

    const isSubModule = credits.includes('(') || credits.includes(')');
    const normalizedGrade = grade ? normalizeGrade(grade) : null;
    const creditsClean = credits.replace(/[()]/g, '').replace(',', '.').replace(/[^\d.]/g, '');

    allRows.push({
      name: fixSpacedText(name.trim()),
      credits: parseFloat(creditsClean) || 0,
      grade: normalizedGrade,
      date,
      isSubModule,
    });
  }

  // Second pass: group sub-modules under parent courses
  const courses: Course[] = [];
  let idx = 0;

  while (idx < allRows.length) {
    const row = allRows[idx];

    if (!row.isSubModule) {
      // Collect following sub-modules
      const subs: RawRow[] = [];
      let next = idx + 1;
      while (next < allRows.length && allRows[next].isSubModule) {
        subs.push(allRows[next]);
        next++;
      }

      if (row.grade) {
        // Completed course — include with sub-module info
        const subModules = subs.map(s => ({
          name: s.name,
          credits: s.credits,
          grade: s.grade,
        }));

        courses.push({
          id: crypto.randomUUID(),
          code: '',
          name: row.name,
          credits: row.credits,
          grade: row.grade,
          date: row.date,
          period: '',
          subModules: subModules.length > 0 ? subModules : undefined,
        });
      }
      // If no grade on parent, skip (unfinished course)

      idx = next;
    } else {
      idx++;
    }
  }

  return courses;
}

function parsePdfByPatterns(sortedRows: TextItem[][]): Course[] {
  const courses: Course[] = [];
  const gradeRe = /\b(Fx|FX|[A-F]|P|G|VG|U)\b/;
  const creditsRe = /(\d+[.,]\d)\s*hp/i;
  const dateRe = /\b(\d{4}-\d{2}-\d{2})\b/;
  const subModuleRe = /\(\s*\d+[.,]\d\s*hp\s*\)/;

  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    let line = '';
    for (let j = 0; j < row.length; j++) {
      line += row[j].text + ' ';
    }
    line = line.trim();

    if (subModuleRe.test(line)) continue;

    const gradeMatch = line.match(gradeRe);
    const creditsMatch = line.match(creditsRe);
    const dateMatch = line.match(dateRe);

    if (!gradeMatch) continue;

    const grade = normalizeGrade(gradeMatch[1]);
    if (!grade) continue;

    let name = line
      .replace(creditsRe, '')
      .replace(gradeRe, '')
      .replace(dateRe, '')
      .replace(/\b\d{1,2}\b/g, '')
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
