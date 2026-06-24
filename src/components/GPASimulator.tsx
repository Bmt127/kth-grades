import { useState, useMemo } from 'react';
import { Target, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import type { Course, Grade } from '../types';
import { GRADE_POINTS } from '../types';
import { calculateGPA } from '../gpaUtils';

const LETTER_GRADES: Grade[] = ['A', 'B', 'C', 'D', 'E'];

interface RetakePlan {
  changes: { course: Course; from: Grade; to: Grade }[];
  gpaAfter: number;
  gpaGain: number;
}

function gpaWith(courses: Course[], overrides: Map<string, Grade>): number {
  const modified = courses.map(c => overrides.has(c.id) ? { ...c, grade: overrides.get(c.id)! } : c);
  return calculateGPA(modified);
}

function findRetakePlans(courses: Course[], target: number, currentGPA: number): RetakePlan[] {
  // Only courses with grades that can be improved (not A, not P, not F/Fx)
  const improvable = courses
    .filter(c => GRADE_POINTS[c.grade] !== null && c.grade !== 'A')
    .sort((a, b) => {
      // Sort by potential impact: biggest gain first (low grade + high credits)
      const impactA = (5.0 - (GRADE_POINTS[a.grade] ?? 0)) * a.credits;
      const impactB = (5.0 - (GRADE_POINTS[b.grade] ?? 0)) * b.credits;
      return impactB - impactA;
    });

  const plans: RetakePlan[] = [];

  // Strategy 1: Single course retakes
  for (const course of improvable) {
    const currentPts = GRADE_POINTS[course.grade]!;
    for (const toGrade of LETTER_GRADES) {
      if (GRADE_POINTS[toGrade]! <= currentPts) continue;
      const overrides = new Map([[course.id, toGrade]]);
      const gpaAfter = gpaWith(courses, overrides);
      if (gpaAfter > currentGPA) {
        plans.push({
          changes: [{ course, from: course.grade, to: toGrade }],
          gpaAfter,
          gpaGain: gpaAfter - currentGPA,
        });
      }
    }
  }

  // Strategy 2: Multi-course combos (2-3 retakes) targeting the goal
  // Use greedy approach: pick best single retake, then add more if needed
  for (let size = 2; size <= Math.min(4, improvable.length); size++) {
    // Try combinations of top candidates upgraded to A
    const topCandidates = improvable.slice(0, Math.min(8, improvable.length));
    const combos = getCombinations(topCandidates, size);

    for (const combo of combos) {
      // Try all-A upgrade for this combo
      const overrides = new Map<string, Grade>();
      const changes: { course: Course; from: Grade; to: Grade }[] = [];
      for (const course of combo) {
        overrides.set(course.id, 'A');
        changes.push({ course, from: course.grade, to: 'A' });
      }
      const gpaAfter = gpaWith(courses, overrides);
      if (gpaAfter >= target && gpaAfter > currentGPA) {
        plans.push({ changes, gpaAfter, gpaGain: gpaAfter - currentGPA });
      }

      // Also try minimum upgrades: each course goes up just one grade
      const minOverrides = new Map<string, Grade>();
      const minChanges: { course: Course; from: Grade; to: Grade }[] = [];
      for (const course of combo) {
        const curIdx = LETTER_GRADES.indexOf(course.grade as Grade);
        if (curIdx > 0) {
          const oneUp = LETTER_GRADES[curIdx - 1];
          minOverrides.set(course.id, oneUp);
          minChanges.push({ course, from: course.grade, to: oneUp });
        }
      }
      if (minChanges.length > 0) {
        const gpaAfterMin = gpaWith(courses, minOverrides);
        if (gpaAfterMin > currentGPA) {
          plans.push({ changes: minChanges, gpaAfter: gpaAfterMin, gpaGain: gpaAfterMin - currentGPA });
        }
      }
    }
  }

  // Deduplicate and sort
  const seen = new Set<string>();
  const unique = plans.filter(p => {
    const key = p.changes.map(c => `${c.course.id}:${c.to}`).sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    // Prefer plans that reach the target
    const aReaches = a.gpaAfter >= target;
    const bReaches = b.gpaAfter >= target;
    if (aReaches !== bReaches) return aReaches ? -1 : 1;
    // Among those that reach target, prefer fewer changes
    if (aReaches && bReaches) {
      if (a.changes.length !== b.changes.length) return a.changes.length - b.changes.length;
      // Then prefer easier upgrades (smaller grade jumps)
      const aDifficulty = a.changes.reduce((s, c) => s + (GRADE_POINTS[c.to]! - GRADE_POINTS[c.from]!), 0);
      const bDifficulty = b.changes.reduce((s, c) => s + (GRADE_POINTS[c.to]! - GRADE_POINTS[c.from]!), 0);
      return aDifficulty - bDifficulty;
    }
    // Otherwise sort by GPA gain
    return b.gpaGain - a.gpaGain;
  });

  return unique.slice(0, 15);
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 1) return arr.map(x => [x]);
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = getCombinations(arr.slice(i + 1), size - 1);
    for (const combo of rest) {
      result.push([arr[i], ...combo]);
    }
  }
  return result;
}

const gradeBadge: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-lime-100 text-lime-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-orange-100 text-orange-800',
  E: 'bg-red-100 text-red-700',
};

export function GPASimulator({ courses }: { courses: Course[] }) {
  const [targetGPA, setTargetGPA] = useState('');
  const [open, setOpen] = useState(false);
  const currentGPA = calculateGPA(courses);

  const analysis = useMemo(() => {
    const target = parseFloat(targetGPA);
    if (!target || target <= currentGPA || target > 5.0) return null;

    const plans = findRetakePlans(courses, target, currentGPA);
    const reachingPlans = plans.filter(p => p.gpaAfter >= target);
    const partialPlans = plans.filter(p => p.gpaAfter < target);

    // Check if target is even possible (all courses upgraded to A)
    const allA = new Map<string, Grade>();
    for (const c of courses) {
      if (GRADE_POINTS[c.grade] !== null && c.grade !== 'A') {
        allA.set(c.id, 'A');
      }
    }
    const maxGPA = allA.size > 0 ? gpaWith(courses, allA) : currentGPA;
    const reachable = maxGPA >= target;

    return { target, reachingPlans, partialPlans, reachable, maxGPA };
  }, [courses, targetGPA, currentGPA]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-purple-50 text-purple-600 p-2 rounded-lg">
            <Target size={20} />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold text-gray-900">GPA Improvement Planner</h2>
            <p className="text-xs text-gray-400">Find the easiest retakes to reach your target GPA</p>
          </div>
        </div>
        {open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Current GPA:</span>
              <span className="text-2xl font-bold text-gray-900">{currentGPA.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Target GPA:</label>
              <input
                type="number"
                step="0.01"
                min={currentGPA + 0.001}
                max="5.0"
                placeholder="e.g. 4.0"
                value={targetGPA}
                onChange={e => setTargetGPA(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {analysis && (
            <div className="space-y-5">
              {!analysis.reachable && (
                <div className="rounded-lg p-4 bg-red-50 border border-red-200">
                  <div className="flex items-start gap-2">
                    <Lightbulb size={18} className="text-red-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-red-800">
                        {analysis.target.toFixed(2)} is not reachable by retaking courses alone.
                      </p>
                      <p className="text-red-700 mt-1">
                        The maximum possible GPA (all courses upgraded to A) is <strong>{analysis.maxGPA.toFixed(4)}</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {analysis.reachingPlans.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-purple-500" />
                    Ways to reach {analysis.target.toFixed(2)}:
                  </h3>
                  <div className="space-y-3">
                    {analysis.reachingPlans.map((plan, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                            Option {i + 1} — {plan.changes.length} retake{plan.changes.length > 1 ? 's' : ''}
                          </span>
                          <span className="text-sm font-bold text-emerald-700">
                            → {plan.gpaAfter.toFixed(4)} GPA
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {plan.changes.map((ch, j) => (
                            <div key={j} className="flex items-center gap-2 text-sm">
                              <span className="text-gray-700 flex-1">{ch.course.name}</span>
                              <span className="text-gray-400">({ch.course.credits} hp)</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeBadge[ch.from]}`}>
                                {ch.from}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeBadge[ch.to]}`}>
                                {ch.to}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.reachingPlans.length === 0 && analysis.partialPlans.length > 0 && analysis.reachable && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Best retake options (more retakes may be needed to fully reach target):
                  </h3>
                  <div className="space-y-3">
                    {analysis.partialPlans.slice(0, 8).map((plan, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {plan.changes.length} retake{plan.changes.length > 1 ? 's' : ''}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">
                              +{plan.gpaGain.toFixed(4)}
                            </span>
                            <span className="text-sm font-bold text-gray-700">
                              → {plan.gpaAfter.toFixed(4)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {plan.changes.map((ch, j) => (
                            <div key={j} className="flex items-center gap-2 text-sm">
                              <span className="text-gray-700 flex-1">{ch.course.name}</span>
                              <span className="text-gray-400">({ch.course.credits} hp)</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeBadge[ch.from]}`}>
                                {ch.from}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeBadge[ch.to]}`}>
                                {ch.to}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
