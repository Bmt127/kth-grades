import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Course } from '../types';
import { getGPAOverTime } from '../gpaUtils';

export function GPAChart({ courses }: { courses: Course[] }) {
  const data = getGPAOverTime(courses);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">GPA Over Time</h2>
        <p className="text-gray-400 text-center py-8">No graded courses yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">GPA Over Time</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="course"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
            formatter={(value) => [Number(value).toFixed(4), 'Cumulative GPA']}
          />
          <Line
            type="monotone"
            dataKey="gpa"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#2563eb' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
