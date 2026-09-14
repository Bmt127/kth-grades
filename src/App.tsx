import { GraduationCap, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { useCourses } from './useCourses';
import { StatsCards } from './components/StatsCards';
import { GPAChart } from './components/GPAChart';
import { GradeDistribution } from './components/GradeDistribution';
import { CourseTable } from './components/CourseTable';
import { AddCourseForm } from './components/AddCourseForm';
import { FileUploader } from './components/FileUploader';
import { GPASimulator } from './components/GPASimulator';
import { StudyAdvisor } from './components/StudyAdvisor';
import { useState, useEffect, useMemo } from 'react';
import { calculateGPA } from './gpaUtils';
import { parseLadokText } from './ladokParser';
import { LADOK_MESSAGE_SOURCE } from './ladokBookmarklet';

const ALL_PROGRAMS = '__all__';
const SELECTED_PROGRAM_KEY = 'kth-grades-selected-program';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFirstName(name: string): string {
  return name.split(' ')[0];
}

function App() {
  const { courses, studentName, addCourse, importCourses, updateCourse, deleteCourse, clearAll, isEmpty } = useCourses();
  const [showImport, setShowImport] = useState(false);
  const [ladokToast, setLadokToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<string>(() => {
    try {
      return localStorage.getItem(SELECTED_PROGRAM_KEY) || ALL_PROGRAMS;
    } catch {
      return ALL_PROGRAMS;
    }
  });

  const programs = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      if (c.program) map.set(c.program, c.programName || c.program);
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [courses]);

  useEffect(() => {
    try {
      localStorage.setItem(SELECTED_PROGRAM_KEY, selectedProgram);
    } catch {
      // Remembering the choice is a nice-to-have, not essential.
    }
  }, [selectedProgram]);

  // Courses with no program tag (added manually, or imported from a PDF/CSV)
  // are always shown — we simply don't know which program they belong to.
  const filteredCourses = useMemo(
    () =>
      selectedProgram === ALL_PROGRAMS
        ? courses
        : courses.filter((c) => !c.program || c.program === selectedProgram),
    [courses, selectedProgram]
  );

  // Always listening, regardless of which screen is showing — this is what the
  // Ladok extension (and the bookmarklet) posts into, so an import from either
  // one lands here even if you never opened the "Import" panel.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (!e.data || e.data.source !== LADOK_MESSAGE_SOURCE) return;
      if (!Array.isArray(e.data.courses) && typeof e.data.text !== 'string') return;

      const { courses: newCourses, studentName: name } = Array.isArray(e.data.courses)
        ? { courses: e.data.courses, studentName: null }
        : parseLadokText(e.data.text);
      if (newCourses.length === 0) {
        setLadokToast({ ok: false, message: 'Got data from Ladok, but found no graded courses on that page.' });
        return;
      }
      importCourses(newCourses, name);
      setLadokToast({ ok: true, message: `Imported ${newCourses.length} course${newCourses.length === 1 ? '' : 's'} from Ladok.` });
      setShowImport(false);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [importCourses]);

  useEffect(() => {
    if (!ladokToast) return;
    const timer = setTimeout(() => setLadokToast(null), 5000);
    return () => clearTimeout(timer);
  }, [ladokToast]);

  if (isEmpty && courses.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-10 max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">KTH GPA Tracker</h1>
            <p className="text-gray-500">
              Upload your grades from Ladok as a PDF or CSV file, or add courses manually.
            </p>
          </div>

          <FileUploader onImport={importCourses} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400">or</span>
            </div>
          </div>

          <button
            onClick={() => {
              addCourse({
                id: crypto.randomUUID(),
                code: '',
                name: '',
                credits: 7.5,
                grade: 'A',
                date: new Date().toISOString().slice(0, 10),
                period: '',
              });
            }}
            className="w-full px-5 py-3 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors font-medium cursor-pointer text-sm"
          >
            Start Adding Courses Manually
          </button>

          <p className="text-xs text-gray-400 mt-6 text-center">
            Your data stays in your browser — nothing is sent to any server.
          </p>
        </div>
      </div>
    );
  }

  const gpa = calculateGPA(filteredCourses);

  return (
    <div className="min-h-screen bg-gray-50">
      {ladokToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-white shadow-lg ${
            ladokToast.ok ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {ladokToast.ok && <CheckCircle2 size={16} />} {ladokToast.message}
        </div>
      )}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <GraduationCap size={22} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">KTH GPA Tracker</h1>
              <p className="text-xs text-gray-400">ECTS Grading Scale — A=5 B=4.5 C=4 D=3.5 E=3</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {programs.length > 1 && (
              <select
                value={selectedProgram}
                onChange={(e) => setSelectedProgram(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-2 text-gray-700 bg-white cursor-pointer max-w-[220px]"
                title="Show GPA for a specific program"
              >
                <option value={ALL_PROGRAMS}>All programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowImport(!showImport)}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm cursor-pointer"
            >
              <Upload size={16} /> Import
            </button>
            <AddCourseForm onAdd={addCourse} />
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm cursor-pointer"
              title="Clear all courses"
            >
              <Trash2 size={16} /> Clear
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Personal greeting */}
        {studentName && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white shadow-md">
            <h2 className="text-2xl font-bold">
              {getGreeting()}, {getFirstName(studentName)}
            </h2>
            <p className="text-blue-100 mt-1 text-sm">
              Your current GPA is <strong className="text-white">{gpa.toFixed(4)}</strong> — keep it up!
            </p>
          </div>
        )}

        {showImport && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Import More Courses</h2>
              <button
                onClick={() => setShowImport(false)}
                className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                Close
              </button>
            </div>
            <FileUploader onImport={(c, name) => { importCourses(c, name); setShowImport(false); }} />
          </div>
        )}

        <StatsCards courses={filteredCourses} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GPAChart courses={filteredCourses} />
          <GradeDistribution courses={filteredCourses} />
        </div>

        <GPASimulator courses={filteredCourses} />

        <StudyAdvisor courses={filteredCourses} />

        <CourseTable courses={filteredCourses} onUpdate={updateCourse} onDelete={deleteCourse} />

        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            GPA is calculated as credit-weighted average: A=5.0, B=4.5, C=4.0, D=3.5, E=3.0. Pass/Fail courses are excluded.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
