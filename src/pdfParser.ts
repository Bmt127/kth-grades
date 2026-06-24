import type { Course, Grade } from './types';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

    if (!content.items || !Array.isArray(content.items)) continue;

    for (let j = 0; j < content.items.length; j++) {
      const item = content.items[j];
      if (!item || !('str' in item) || !item.str.trim()) continue;
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
  const items = await extractTextItems(file);

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

  // Sort rows top to bottom, items left to right within each row
  const sortedKeys = Array.from(rows.keys()).sort((a, b) => a - b);
  const sortedRows: TextItem[][] = [];
  for (let i = 0; i < sortedKeys.length; i++) {
    const items = rows.get(sortedKeys[i])!;
    items.sort((a, b) => a.x - b.x);
    sortedRows.push(items);
  }

  // Identify header row with "Benämning", "Omfattning", "Betyg", "Datum"
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

  const courses: Course[] = [];
  const threshold = 60;

  for (let i = headerRowIdx + 1; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    let rowTextJoined = '';
    for (let j = 0; j < row.length; j++) {
      rowTextJoined += row[j].text + ' ';
    }

    // Stop at footer sections
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

    if (!name || !grade) continue;

    const normalizedGrade = normalizeGrade(grade);
    if (!normalizedGrade) continue;

    // Skip sub-modules: credits in parentheses like "( 5,5 hp )"
    const isSubModule = credits.includes('(') || credits.includes(')');
    if (isSubModule) continue;

    // Parse credits: "7,5 hp" or "7.5 hp"
    const creditsClean = credits.replace(/[()]/g, '').replace(',', '.').replace(/[^\d.]/g, '');
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

  return courses;
}

// Fallback parser using regex patterns on reconstructed lines
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

    // Skip sub-modules
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
