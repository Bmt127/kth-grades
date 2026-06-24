import { useState } from 'react';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import type { Course } from '../types';
import { GRADE_POINTS } from '../types';
import type { Grade } from '../types';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P'];

const gradeBadgeClass: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-lime-100 text-lime-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-orange-100 text-orange-800',
  E: 'bg-red-100 text-red-700',
  F: 'bg-red-200 text-red-900',
  Fx: 'bg-red-200 text-red-900',
  P: 'bg-indigo-100 text-indigo-800',
};

export function CourseTable({
  courses,
  onUpdate,
  onDelete,
}: {
  courses: Course[];
  onUpdate: (id: string, updates: Partial<Course>) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Course>>({});
  const sorted = [...courses].sort((a, b) => b.date.localeCompare(a.date));

  function startEdit(course: Course) {
    setEditingId(course.id);
    setDraft({ name: course.name, credits: course.credits, grade: course.grade, date: course.date });
  }

  function saveEdit() {
    if (editingId) {
      onUpdate(editingId, draft);
      setEditingId(null);
      setDraft({});
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({});
  }

  const inputClass = "w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">All Courses</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
              <th className="px-6 py-3">Course</th>
              <th className="px-6 py-3 text-center">Credits</th>
              <th className="px-6 py-3 text-center">Grade</th>
              <th className="px-6 py-3 text-center">Points</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(course =>
              editingId === course.id ? (
                <tr key={course.id} className="bg-blue-50/50">
                  <td className="px-6 py-2">
                    <input
                      className={inputClass}
                      value={draft.name ?? ''}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                    />
                  </td>
                  <td className="px-6 py-2 text-center">
                    <input
                      className={inputClass + ' w-20 text-center'}
                      type="number"
                      step="0.5"
                      min="0.5"
                      value={draft.credits ?? 0}
                      onChange={e => setDraft(d => ({ ...d, credits: parseFloat(e.target.value) || 0 }))}
                    />
                  </td>
                  <td className="px-6 py-2 text-center">
                    <select
                      className={inputClass + ' w-16 text-center'}
                      value={draft.grade ?? 'A'}
                      onChange={e => setDraft(d => ({ ...d, grade: e.target.value as Grade }))}
                    >
                      {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-2 text-sm text-center text-gray-400">
                    {GRADE_POINTS[draft.grade as Grade] !== null ? GRADE_POINTS[draft.grade as Grade] : '-'}
                  </td>
                  <td className="px-6 py-2">
                    <input
                      className={inputClass + ' w-32'}
                      type="date"
                      value={draft.date ?? ''}
                      onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
                    />
                  </td>
                  <td className="px-6 py-2">
                    <div className="flex gap-1">
                      <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-700 cursor-pointer p-1">
                        <Check size={16} />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600 cursor-pointer p-1">
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={course.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    <span className="font-medium">{course.name}</span>
                    {course.code && <span className="ml-2 text-xs text-gray-400 font-mono">{course.code}</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-center text-gray-600">
                    {course.credits} hp
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${gradeBadgeClass[course.grade]}`}>
                      {course.grade}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-center text-gray-600">
                    {GRADE_POINTS[course.grade] !== null ? GRADE_POINTS[course.grade] : '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{course.date}</td>
                  <td className="px-6 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(course)}
                        className="text-gray-400 hover:text-blue-500 transition-colors cursor-pointer p-1"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDelete(course.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
