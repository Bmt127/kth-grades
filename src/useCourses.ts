import { useState, useEffect } from 'react';
import type { Course } from './types';

const STORAGE_KEY = 'kth-grades-courses';

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

  const [initialized, setInitialized] = useState(
    () => localStorage.getItem(STORAGE_KEY) !== null
  );

  useEffect(() => {
    if (initialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    }
  }, [courses, initialized]);

  function addCourse(course: Course) {
    setInitialized(true);
    setCourses(prev => [...prev, course]);
  }

  function importCourses(newCourses: Course[]) {
    setInitialized(true);
    setCourses(prev => [...prev, ...newCourses]);
  }

  function updateCourse(id: string, updates: Partial<Course>) {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  function deleteCourse(id: string) {
    setCourses(prev => prev.filter(c => c.id !== id));
  }

  function clearAll() {
    setCourses([]);
  }

  return { courses, addCourse, importCourses, updateCourse, deleteCourse, clearAll, isEmpty: !initialized };
}
