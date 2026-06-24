import { GraduationCap, BookOpen, TrendingUp, Award } from 'lucide-react';
import type { Course } from '../types';
import { calculateGPA, getTotalCredits } from '../gpaUtils';

export function StatsCards({ courses }: { courses: Course[] }) {
  const gpa = calculateGPA(courses);
  const totalCredits = getTotalCredits(courses);
  const passedCourses = courses.filter(c => c.grade !== 'F' && c.grade !== 'Fx').length;
  const aGrades = courses.filter(c => c.grade === 'A').length;

  const cards = [
    { label: 'GPA', value: gpa.toFixed(4), sub: '/ 5.00', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Credits', value: totalCredits.toFixed(1), sub: 'hp', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Courses Passed', value: passedCourses, sub: `of ${courses.length}`, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'A Grades', value: aGrades, sub: `${courses.length > 0 ? ((aGrades / courses.length) * 100).toFixed(0) : 0}%`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">{card.label}</span>
            <div className={`${card.bg} ${card.color} p-2 rounded-lg`}>
              <card.icon size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{card.value}</span>
            <span className="text-sm text-gray-400">{card.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
