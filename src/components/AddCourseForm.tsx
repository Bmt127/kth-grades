import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Course } from '../types';
import type { Grade } from '../types';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E', 'F', 'Fx', 'P'];

export function AddCourseForm({ onAdd }: { onAdd: (course: Course) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('7.5');
  const [grade, setGrade] = useState<Grade>('A');
  const [period, setPeriod] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !name) return;

    onAdd({
      id: crypto.randomUUID(),
      code: code.toUpperCase(),
      name,
      credits: parseFloat(credits),
      grade,
      date: new Date().toISOString().slice(0, 10),
      period,
    });

    setCode('');
    setName('');
    setCredits('7.5');
    setGrade('A');
    setPeriod('');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer"
      >
        <Plus size={18} /> Add Course
      </button>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Course</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Course Code</label>
          <input
            className={inputClass}
            placeholder="DD1337"
            value={code}
            onChange={e => setCode(e.target.value)}
            required
          />
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Course Name</label>
          <input
            className={inputClass}
            placeholder="Programming"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Credits (hp)</label>
          <input
            className={inputClass}
            type="number"
            step="0.5"
            min="0.5"
            value={credits}
            onChange={e => setCredits(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Grade</label>
          <select
            className={inputClass}
            value={grade}
            onChange={e => setGrade(e.target.value as Grade)}
          >
            {GRADES.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
