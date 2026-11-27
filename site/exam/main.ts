/**
 * Exam demo (/exam/): a five-question timed quiz with pixiformui/exam. The page has the questions only;
 * the answer key is on the website's server (POST /api/exam-demo in site/worker.ts), which scores the
 * answers, as a real exam server would.
 */
import { mountExam } from '../../src/lib/exam';

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const payload = $('#exam-payload');
const scoreEl = $('#exam-score');
const again = $<HTMLButtonElement>('#exam-again');
again.addEventListener('click', () => location.reload());

await mountExam(
  $('#exam'),
  {
    title: 'Space quiz',
    subtitle: 'Five questions, three minutes.',
    maxWidth: 640,
    popout: true,
    form: { botGuard: false },
    onSubmit: async (values) => {
      payload.textContent = JSON.stringify(values, null, 2);
      again.hidden = false;
      try {
        const res = await fetch('/api/exam-demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers: values }) });
        const r = (await res.json()) as { score?: number; max?: number; message?: string };
        scoreEl.textContent = typeof r.score === 'number' ? `Scored by the server: ${r.score} of ${r.max} correct (the open question isn’t scored).` : (r.message ?? 'The server couldn’t score this right now.');
      } catch {
        scoreEl.textContent = 'The server couldn’t score this right now.';
      }
      return { ok: true, message: 'Answers sent. See what your server receives →' };
    },
  },
  {
    timeLimit: 3 * 60,
    shuffleOptions: true,
    questions: [
      { id: 'q1', text: 'Which planet is the largest in our solar system?', options: ['Earth', 'Jupiter', 'Mars', 'Venus'] },
      { id: 'q2', text: 'Which planet is closest to the Sun?', options: ['Mercury', 'Venus', 'Neptune'] },
      { id: 'q3', text: 'How many moons does Mars have?', options: ['None', 'One', 'Two', 'Five'] },
      { id: 'q4', text: 'What is the Sun mostly made of?', options: ['Oxygen and carbon', 'Hydrogen and helium', 'Iron and nickel'] },
      { id: 'q5', text: 'In one sentence: why does Earth have seasons?', answer: 'long' },
    ],
  },
);
