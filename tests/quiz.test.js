import assert from 'node:assert/strict';
import test from 'node:test';
import { data } from '../src/assets/data.js';
import { parseCSV, prepareQuestions } from '../src/lib/quiz.js';
const header = 'question,category,difficulty,option1,option2,option3,option4,answer,explanation\r\n';
test('built-in questions contain valid answers and explanations', () => {
  assert.equal(new Set(data.map(q => q.id)).size, data.length);
  for (const q of data) {
    assert.equal(q.options.length, 4);
    assert.ok(q.options[q.correctAnswer]);
    assert.ok(q.question && q.category && q.explanation);
    assert.ok(['easy', 'medium', 'hard'].includes(q.difficulty));
  }
});
test('shuffling preserves answer identity without modifying the bank', () => {
  const before = JSON.stringify(data);
  for (let attempt = 0; attempt < 100; attempt++) {
    const selected = prepareQuestions(data, 10);
    assert.equal(selected.length, 10);
    assert.equal(new Set(selected.map(q => q.id)).size, 10);
    for (const q of selected) {
      const original = data.find(item => item.id === q.id);
      assert.equal(q.options[q.correctAnswer], original.options[original.correctAnswer]);
    }
  }
  assert.equal(JSON.stringify(data), before);
  assert.equal(prepareQuestions(data.slice(0, 2), 10).length, 2);
});
test('CSV supports BOM, quoted commas, escaped quotes, multiline fields and CRLF', () => {
  const [q] = parseCSV('\uFEFF' + header + '"A comma, and ""quote""?",Test,easy,A,B,C,D,2,"Line one\nLine two"\r\n');
  assert.equal(q.question, 'A comma, and "quote"?');
  assert.equal(q.correctAnswer, 1);
  assert.equal(q.explanation, 'Line one\nLine two');
});
test('CSV rejects invalid or incomplete questions', () => {
  for (const row of ['Q,Test,easy,A,B,C,D,0,Why', 'Q,Test,easy,A,A,C,D,1,Why', 'Q,Test,unknown,A,B,C,D,1,Why', 'Q,Test,easy,A,B,C,D,1,', '"unclosed', 'Q,Test']) {
    assert.throws(() => parseCSV(header + row));
  }
  assert.throws(() => parseCSV(header));
  assert.throws(() => parseCSV('question,answer\nQ,1'));
});

test('CSV export round trips questions, including quoted and multiline text', async () => {
  const { exportCSV } = await import('../src/lib/quiz.js');
  const original = [{ ...data[0], question: 'A "quoted", question?', explanation: 'First line\nSecond line' }];
  const [restored] = parseCSV(exportCSV(original));
  for (const key of ['question', 'category', 'difficulty', 'options', 'correctAnswer', 'explanation']) assert.deepEqual(restored[key], original[0][key]);
  assert.equal(parseCSV(exportCSV(data)).length, data.length);
});
test('missed questions include wrong and unanswered responses and keep answer mapping', async () => {
  const { missedQuestions } = await import('../src/lib/quiz.js');
  const questions = prepareQuestions(data, 3);
  const answers = [questions[0].correctAnswer, (questions[1].correctAnswer + 1) % 4];
  const missed = missedQuestions(questions, answers);
  assert.deepEqual(missed.map(q => q.id), [questions[1].id, questions[2].id]);
  const retry = prepareQuestions(missed, missed.length);
  for (const q of retry) {
    const previous = missed.find(item => item.id === q.id);
    assert.equal(q.options[q.correctAnswer], previous.options[previous.correctAnswer]);
  }
  assert.equal(missedQuestions(questions, questions.map(q => q.correctAnswer)).length, 0);
});

test('expanded bank has 15 questions per topic and covers all difficulty levels', () => {
  assert.equal(data.length, 75);
  for (const topic of new Set(data.map(q => q.category))) {
    const questions = data.filter(q => q.category === topic);
    assert.equal(questions.length, 15, topic);
    assert.deepEqual([...new Set(questions.map(q => q.difficulty))].sort(), ['easy', 'hard', 'medium']);
  }
});
test('question validation rejects invalid stored or edited questions', async () => {
  const { validateQuestion } = await import('../src/lib/quiz.js');
  assert.ok(data.every(validateQuestion));
  for (const patch of [{ question: '  ' }, { category: '' }, { difficulty: 'unknown' }, { correctAnswer: 4 }, { options: ['A', 'a', 'C', 'D'] }, { explanation: null }]) assert.equal(validateQuestion({ ...data[0], ...patch }), false);
});
test('sessions restore exact shuffled order and selected answers', async () => {
  const { restoreSession, sessionRemaining } = await import('../src/lib/quiz.js');
  const now = 1700000000000;
  const questions = prepareQuestions(data, 5);
  const session = { version: 1, questions, answers: [questions[0].correctAnswer, null, null, null, null], index: 1, mode: 'practice', category: 'All topics', startedAt: now - 30000, savedAt: now, elapsedMs: 30000 };
  const restored = restoreSession(JSON.parse(JSON.stringify(session)), now);
  assert.deepEqual(restored.questions, questions);
  assert.deepEqual(restored.answers, session.answers);
  assert.equal(restored.index, 1);
  assert.equal(sessionRemaining({ ...session, mode: 'timed' }, now), 120);
  assert.equal(sessionRemaining({ ...session, mode: 'timed' }, now + 121000), 0);
  assert.equal(restoreSession({ ...session, mode: 'timed' }, now + 121000).mode, 'timed');
});
test('session validation rejects corrupted state and impossible answer progression', async () => {
  const { restoreSession } = await import('../src/lib/quiz.js');
  const now = 1700000000000;
  const session = { version: 1, questions: data.slice(0, 3), answers: [0, null, null], index: 1, mode: 'practice', category: 'Science', startedAt: now - 1000, savedAt: now, elapsedMs: 1000 };
  for (const patch of [{ version: 2 }, { index: 3 }, { answers: [null, null, null] }, { answers: [0, null, 2] }, { answers: [8] }, { mode: 'invalid' }, { questions: [] }, { elapsedMs: -1 }, { startedAt: now + 1 }, { questions: [data[0], data[0]] }]) assert.equal(restoreSession({ ...session, ...patch }, now), null);
  assert.equal(restoreSession(null, now), null);
});
