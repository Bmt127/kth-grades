import type { Course, Grade } from './types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
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

// Join text items that are close together without spaces (handles char-by-char PDFs)
function joinItems(items: TextItem[]): string {
  if (items.length === 0) return '';
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let result = sorted[0].text;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].x - (sorted[i - 1].x + sorted[i - 1].text.length * 5);
    result += gap > 8 ? ' ' + sorted[i].text : sorted[i].text;
  }
  return result;
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

export interface PdfResult {
  courses: Course[];
  studentName: string | null;
}

function extractStudentName(sortedRows: TextItem[][]): string | null {
  for (let i = 0; i < sortedRows.length; i++) {
    const rowText = joinItems(sortedRows[i]).trim();
    if (rowText.toLowerCase() === 'namn' || rowText.toLowerCase() === 'name') {
      if (i + 1 < sortedRows.length) {
        const nameRow = joinItems(sortedRows[i + 1]).trim();
        if (nameRow && !nameRow.toLowerCase().includes('datum') && !nameRow.toLowerCase().includes('personnummer')) {
          // Name row might also contain personnummer on the same y-line
          // Take only items to the left of x=300 (name column area)
          const nameOnlyItems = sortedRows[i + 1].filter(it => it.x < 300);
          if (nameOnlyItems.length > 0) {
            return joinItems(nameOnlyItems).trim();
          }
          return nameRow;
        }
      }
    }
  }
  return null;
}

export async function parsePdf(file: File): Promise<PdfResult> {
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
    const fullRowText = joinItems(sortedRows[i]).toLowerCase();
    const hasName = fullRowText.includes('benämning') || fullRowText.includes('course');
    const hasGrade = fullRowText.includes('betyg') || fullRowText.includes('grade');

    if (hasName && hasGrade) {
      headerRowIdx = i;

      // Group items into clusters by proximity to find column start positions
      const clusters: { x: number; text: string }[] = [];
      const sorted = [...sortedRows[i]].sort((a, b) => a.x - b.x);
      let cluster = { x: sorted[0].x, items: [sorted[0]] };
      for (let j = 1; j < sorted.length; j++) {
        if (sorted[j].x - sorted[j - 1].x < 15) {
          cluster.items.push(sorted[j]);
        } else {
          clusters.push({ x: cluster.x, text: cluster.items.map(it => it.text).join('').toLowerCase() });
          cluster = { x: sorted[j].x, items: [sorted[j]] };
        }
      }
      clusters.push({ x: cluster.x, text: cluster.items.map(it => it.text).join('').toLowerCase() });

      let nameX = 0, creditsX = 200, gradeX = 400, dateX = 500;
      for (const c of clusters) {
        if (c.text.includes('benämning') || c.text.includes('course') || c.text.includes('name')) nameX = c.x;
        else if (c.text.includes('omfattning') || c.text.includes('credits') || c.text.includes('scope')) creditsX = c.x;
        else if (c.text.includes('betyg') || c.text.includes('grade')) gradeX = c.x;
        else if (c.text.includes('datum') || c.text.includes('date')) dateX = c.x;
      }

      columns = {
        name: nameX,
        credits: creditsX,
        grade: gradeX,
        date: dateX,
      };
      break;
    }
  }

  if (!columns) {
    return { courses: parsePdfByPatterns(sortedRows), studentName: extractStudentName(sortedRows) };
  }

  const courses: Course[] = [];
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

    const nameItems: TextItem[] = [];
    const creditsItems: TextItem[] = [];
    const gradeItems: TextItem[] = [];
    const dateItems: TextItem[] = [];

    for (let j = 0; j < row.length; j++) {
      const item = row[j];
      const distName = Math.abs(item.x - columns.name);
      const distCredits = Math.abs(item.x - columns.credits);
      const distGrade = Math.abs(item.x - columns.grade);
      const distDate = Math.abs(item.x - columns.date);
      const minDist = Math.min(distName, distCredits, distGrade, distDate);

      if (minDist === distName && distName < threshold) {
        nameItems.push(item);
      } else if (minDist === distCredits && distCredits < threshold) {
        creditsItems.push(item);
      } else if (minDist === distGrade && distGrade < threshold) {
        gradeItems.push(item);
      } else if (minDist === distDate && distDate < threshold) {
        dateItems.push(item);
      }
    }

    const name = joinItems(nameItems);
    const credits = joinItems(creditsItems);
    const grade = joinItems(gradeItems);
    const date = joinItems(dateItems);

    if (!name) continue;

    // Skip sub-modules (credits in parentheses like "( 5,5 hp )")
    const creditsRaw = credits.replace(/\s/g, '');
    const isSubModule = creditsRaw.includes('(') || creditsRaw.includes(')');
    if (isSubModule) continue;

    // Skip rows without a grade (unfinished courses)
    const normalizedGrade = grade ? normalizeGrade(grade) : null;
    if (!normalizedGrade) continue;

    const creditsNoSpaces = credits.replace(/\s/g, '');
    const creditsClean = creditsNoSpaces.replace(',', '.').replace(/[^\d.]/g, '');
    const creditsNum = parseFloat(creditsClean) || 0;

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

  return { courses, studentName: extractStudentName(sortedRows) };
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
