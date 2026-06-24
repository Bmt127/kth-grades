import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Course, Grade } from '../types';
import { GRADE_COLORS } from '../types';
import { getGradeDistribution } from '../gpaUtils';

export function GradeDistribution({ courses }: { courses: Course[] }) {
  const data = getGradeDistribution(courses);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h2>
        <p className="text-gray-400 text-center py-8">No courses yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Grade Distribution</h2>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="grade" tick={{ fontSize: 13, fontWeight: 600 }} stroke="#9ca3af" />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.grade} fill={GRADE_COLORS[entry.grade as Grade] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
