export type Grade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'Fx' | 'P';

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  grade: Grade;
  date: string;
  period: string;
}

export const GRADE_POINTS: Record<Grade, number | null> = {
  A: 5.0,
  B: 4.5,
  C: 4.0,
  D: 3.5,
  E: 3.0,
  F: 0,
  Fx: 0,
  P: null,
};

export const GRADE_COLORS: Record<Grade, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  E: '#ef4444',
  F: '#991b1b',
  Fx: '#7f1d1d',
  P: '#6366f1',
};
