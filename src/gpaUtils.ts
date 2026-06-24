import type { Course } from './types';
import { GRADE_POINTS } from './types';

export function calculateGPA(courses: Course[]): number {
  const gradedCourses = courses.filter(c => GRADE_POINTS[c.grade] !== null);
  if (gradedCourses.length === 0) return 0;

  const totalWeighted = gradedCourses.reduce(
    (sum, c) => sum + (GRADE_POINTS[c.grade] as number) * c.credits,
    0
  );
  const totalCredits = gradedCourses.reduce((sum, c) => sum + c.credits, 0);

  return totalWeighted / totalCredits;
}

export function getTotalCredits(courses: Course[]): number {
  return courses
    .filter(c => c.grade !== 'F' && c.grade !== 'Fx')
    .reduce((sum, c) => sum + c.credits, 0);
}

export function getGradeDistribution(courses: Course[]) {
  const dist: Record<string, number> = {};
  for (const c of courses) {
    dist[c.grade] = (dist[c.grade] || 0) + 1;
  }
  return Object.entries(dist)
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => {
      const order = ['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P'];
      return order.indexOf(a.grade) - order.indexOf(b.grade);
    });
}

export function getGPAOverTime(courses: Course[]) {
  const sorted = [...courses]
    .filter(c => GRADE_POINTS[c.grade] !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  let totalWeighted = 0;
  let totalCredits = 0;

  return sorted.map(c => {
    totalWeighted += (GRADE_POINTS[c.grade] as number) * c.credits;
    totalCredits += c.credits;
    return {
      date: c.date,
      course: c.code || c.name.split(' ').slice(0, 2).join(' '),
      gpa: +(totalWeighted / totalCredits).toFixed(4),
    };
  });
}
