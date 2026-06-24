import { GraduationCap, Upload, Trash2 } from 'lucide-react';
import { useCourses } from './useCourses';
import { StatsCards } from './components/StatsCards';
import { GPAChart } from './components/GPAChart';
import { GradeDistribution } from './components/GradeDistribution';
import { CourseTable } from './components/CourseTable';
import { AddCourseForm } from './components/AddCourseForm';
import { FileUploader } from './components/FileUploader';
import { GPASimulator } from './components/GPASimulator';
import { useState } from 'react';

function App() {
  const { courses, addCourse, importCourses, updateCourse, deleteCourse, clearAll, isEmpty } = useCourses();
  const [showImport, setShowImport] = useState(false);

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

  return (
    <div className="min-h-screen bg-gray-50">
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
            <FileUploader onImport={(c) => { importCourses(c); setShowImport(false); }} />
          </div>
        )}

        <StatsCards courses={courses} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GPAChart courses={courses} />
          <GradeDistribution courses={courses} />
        </div>

        <GPASimulator courses={courses} />

        <CourseTable courses={courses} onUpdate={updateCourse} onDelete={deleteCourse} />

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
