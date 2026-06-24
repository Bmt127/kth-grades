import { useState, useEffect } from 'react';
import type { Course } from './types';

const STORAGE_KEY = 'kth-grades-courses';
const NAME_KEY = 'kth-grades-student-name';

export function useCourses() {
  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [studentName, setStudentName] = useState<string | null>(
    () => localStorage.getItem(NAME_KEY)
  );

  const [initialized, setInitialized] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== null
  );

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    }
  }, [courses, initialized]);

  useEffect(() => {
    if (studentName) {
      localStorage.setItem(NAME_KEY, studentName);
    } else {
      localStorage.removeItem(NAME_KEY);
    }
  }, [studentName]);

  function addCourse(course: Course) {
    setInitialized(true);
    setCourses(prev => [...prev, course]);
  }

  function importCourses(newCourses: Course[], name?: string | null) {
    setInitialized(true);
    setCourses(prev => [...prev, ...newCourses]);
    if (name) setStudentName(name);
  }

  function updateCourse(id: string, updates: Partial<Course>) {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  function deleteCourse(id: string) {
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  function clearAll() {
    setCourses([]);
    setStudentName(null);
  }

  return { courses, studentName, addCourse, importCourses, updateCourse, deleteCourse, clearAll, isEmpty: !initialized };
}
