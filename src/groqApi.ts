import type { Course } from './types';
import { GRADE_POINTS } from './types';
import { calculateGPA, getTotalCredits } from './gpaUtils';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function buildSystemPrompt(courses: Course[]): string {
  const gpa = calculateGPA(courses);
  const totalCredits = getTotalCredits(courses);
  const gradedCourses = courses.filter(c => GRADE_POINTS[c.grade] !== null);

  const courseList = gradedCourses
    .map(c => `- ${c.name} (${c.credits} hp): ${c.grade} (${GRADE_POINTS[c.grade]} pts)${c.date ? ', ' + c.date : ''}`)
    .join('\n');

  return `You are a helpful KTH study advisor AI. You have access to a student's complete grade data from their Ladok transcript.

STUDENT DATA:
- Current GPA: ${gpa.toFixed(4)} / 5.00
- Total credits earned: ${totalCredits} hp
- Number of courses: ${courses.length} (${gradedCourses.length} graded)

GRADE SCALE (KTH ECTS):
A = 5.0, B = 4.5, C = 4.0, D = 3.5, E = 3.0, F/Fx = 0 (fail), P = Pass (not in GPA)

GPA FORMULA: Credit-weighted average = sum(grade_points × credits) / sum(credits) for all graded courses.

COURSES:
${courseList}

INSTRUCTIONS:
- Give specific, personalized advice based on the student's actual courses and grades
- When suggesting retakes, calculate the exact GPA impact
- Be encouraging but realistic
- Use Swedish course names if the student writes in Swedish
- Keep responses concise and actionable
- If asked about reaching a target GPA, calculate exactly which courses to retake and the resulting GPA`;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendChat(
  apiKey: string,
  courses: Course[],
  messages: ChatMessage[]
): Promise<string> {
  const systemPrompt = buildSystemPrompt(courses);

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    if (response.status === 401) {
      throw new Error('Invalid API key. Check your Groq API key and try again.');
    }
    if (response.status === 429) {
      throw new Error('Rate limit reached. Wait a moment and try again.');
    }
    throw new Error(err?.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response received.';
}
