import './Quiz.css';
import { useEffect, useRef, useState } from 'react';
import { data } from '../../assets/data';
import { exportCSV, missedQuestions, parseCSV, prepareQuestions, restoreSession, sessionRemaining, validateQuestion } from '../../lib/quiz';
import QuestionManager from './QuestionManager';

function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
const template = 'question,category,difficulty,option1,option2,option3,option4,answer,explanation\nWhich hook adds state?,Web Development,easy,useEffect,useState,useRef,useContext,2,useState stores component state.\n';

export default function Quiz() {
  const [custom, setCustom] = useState(() => {
    const saved = readSaved('quiz-custom', []);
    return Array.isArray(saved) ? saved.filter(validateQuestion).slice(0, 1000) : [];
  });
  const [history, setHistory] = useState(() => {
    const saved = readSaved('quiz-history', []);
    return Array.isArray(saved) ? saved.filter(item => item && Number.isFinite(item.percent) && typeof item.date === 'string').slice(0, 20) : [];
  });
  const [dark, setDark] = useState(() => readSaved('quiz-dark', false) === true);
  const [category, setCategory] = useState('All topics');
  const [difficulty, setDifficulty] = useState('all');
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState('practice');
  const [screen, setScreen] = useState('home');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const [reviewFilter, setReviewFilter] = useState('all');
  const [retrying, setRetrying] = useState(false);
  const [savedSession, setSavedSession] = useState(() => restoreSession(readSaved('quiz-session', null)));
  const started = useRef(0);
  const heading = useRef(null);
  const finishing = useRef(false);
  const bank = [...data, ...custom];
  const categories = ['All topics', ...new Set(bank.map(q => q.category))];
  const available = bank.filter(q => (category === 'All topics' || q.category === category) && (difficulty === 'all' || q.difficulty === difficulty));
  const question = questions[index];
  const answered = answers[index] !== undefined;
  const score = questions.reduce((total, q, i) => total + (answers[i] === q.correctAnswer ? 1 : 0), 0);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('quiz-dark', JSON.stringify(dark)); } catch { /* Theme still works without storage. */ }
  }, [dark]);
  useEffect(() => { heading.current?.focus(); }, [screen, index]);
  useEffect(() => {
    if (screen !== 'quiz' || mode !== 'timed') return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((started.current + questions.length * 30000 - Date.now()) / 1000))), 250);
    return () => clearInterval(timer);
  }, [screen, mode, questions.length]);

  function persist(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { setNotice('Browser storage is unavailable or full. Your changes work for this visit but may not be saved.'); }
  }
  function finish() {
    if (finishing.current) return;
    finishing.current = true;
    const duration = Math.round((Date.now() - started.current) / 1000);
    const seconds = mode === 'timed' ? Math.min(duration, questions.length * 30) : duration;
    setElapsed(seconds);
    const updated = [{ percent: Math.round(score / questions.length * 100), score, total: questions.length, category: retrying ? 'Missed questions' : category, mode, date: new Date().toISOString() }, ...history].slice(0, 20);
    setHistory(updated); persist('quiz-history', updated); persist('quiz-session', null); setSavedSession(null); setScreen('results');
  }
  useEffect(() => {
    if (screen === 'quiz' && mode === 'timed' && remaining === 0) finish();
    // finish uses the latest render's answers when the deadline is reached.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, screen, mode]);

  function start(source = available, retry = false) {
    if (!source.length) return;
    if (savedSession && !window.confirm('Start a new quiz and replace the unfinished one?')) return;
    setSavedSession(null);
    const selection = prepareQuestions(source, retry ? source.length : count);
    setRetrying(retry); setReviewFilter('all');
    if (retry) setMode('practice');
    setQuestions(selection); setAnswers([]); setIndex(0); setRemaining(selection.length * 30);
    started.current = Date.now(); finishing.current = false; setNotice(''); setScreen('quiz');
  }
  function snapshot() {
    return { version: 1, questions, answers: Array.from({ length: questions.length }, (_, i) => answers[i] ?? null), index, mode, category, retrying, startedAt: started.current, elapsedMs: Math.max(0, Date.now() - started.current), savedAt: Date.now() };
  }
  useEffect(() => {
    if (screen !== 'quiz' || finishing.current) return;
    const save = () => { if (!finishing.current) persist('quiz-session', snapshot()); };
    save();
    const interval = setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => { clearInterval(interval); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', save); };
    // Snapshot needs the current question order and answers; the interval covers elapsed practice time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, questions, answers, index, mode, category, retrying]);

  function pause() {
    const session = snapshot(); persist('quiz-session', session); setSavedSession(session); setScreen('home');
  }
  function resume() {
    const session = restoreSession(savedSession);
    if (!session) { setSavedSession(null); persist('quiz-session', null); setNotice('The saved quiz could not be restored. Please start a new quiz.'); return; }
    setQuestions(session.questions); setAnswers(session.answers.map(a => a === null ? undefined : a)); setIndex(session.index);
    setMode(session.mode); setCategory(categories.includes(session.category) ? session.category : 'All topics'); setRetrying(session.retrying); setReviewFilter('all');
    started.current = session.mode === 'timed' ? session.startedAt : Date.now() - session.elapsedMs;
    setRemaining(session.mode === 'timed' ? sessionRemaining(session) : 0);
    finishing.current = false; setScreen('quiz');
  }
  function saveQuestion(question) {
    const updated = custom.some(q => q.id === question.id) ? custom.map(q => q.id === question.id ? question : q) : [...custom, question];
    setCustom(updated); persist('quiz-custom', updated); setNotice('Question saved to your library.');
  }
  function deleteQuestion(id) {
    const updated = custom.filter(q => q.id !== id); setCustom(updated); persist('quiz-custom', updated);
    if (!data.some(q => q.category === category) && !updated.some(q => q.category === category)) setCategory('All topics');
    setNotice('Question deleted.');
  }
  function choose(option) {
    if (answered || (mode === 'timed' && Date.now() >= started.current + questions.length * 30000)) return;
    setAnswers(previous => { if (previous[index] !== undefined) return previous; const next = [...previous]; next[index] = option; return next; });
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a CSV file smaller than 1 MB.');
      const imported = parseCSV(await file.text());
      const seen = new Set(bank.map(q => q.question.toLowerCase().trim()));
      const unique = imported.filter(q => { const key = q.question.toLowerCase().trim(); if (seen.has(key)) return false; seen.add(key); return true; });
      const updated = [...custom, ...unique];
      if (updated.length > 1000) throw new Error('Your library can hold up to 1,000 imported questions.');
      setCustom(updated); persist('quiz-custom', updated);
      setNotice(`Added ${unique.length} questions. ${imported.length - unique.length} duplicates skipped.`);
    } catch (error) { setNotice(error.message); }
  }
  function downloadCSV(content, filename) {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadTemplate() { downloadCSV(template, 'quiz-questions-template.csv'); }
  const time = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="Quizora home">Quizora</a><div className="top-actions">{(screen === 'home' || screen === 'manager') && <nav className="main-nav" aria-label="Main navigation"><button aria-current={screen === 'home' ? 'page' : undefined} onClick={() => setScreen('home')}>Quizzes</button><button aria-current={screen === 'manager' ? 'page' : undefined} onClick={() => setScreen('manager')}>Questions</button></nav>}<button className="theme-button" onClick={() => setDark(!dark)}>{dark ? 'Light mode' : 'Dark mode'}</button></div></header>
    <main>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
      {screen === 'manager' ? <QuestionManager builtIn={data} custom={custom} onSave={saveQuestion} onDelete={deleteQuestion} onBack={() => setScreen('home')}/> : screen === 'home' ? <>
        <section className="page-heading"><div><p className="section-label">PRACTICE & REVISION</p><h1 ref={heading} tabIndex={-1}>What will you test today?</h1><p>Choose a topic, take a quiz, and review what you learned.</p></div><svg className="study-illustration" viewBox="0 0 260 170" fill="none" aria-hidden="true"><ellipse cx="134" cy="149" rx="108" ry="9" fill="currentColor" opacity=".07"/><path d="M27 54Q77 34 130 57Q183 34 233 54V138Q181 122 130 145Q78 122 27 138Z" fill="var(--panel)" stroke="currentColor" strokeWidth="2"/><path d="M36 45Q85 31 130 54Q175 31 224 45V127Q176 115 130 138Q83 115 36 127Z" fill="var(--paper)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M130 54V138M51 65Q83 58 114 72M51 81Q83 74 114 88M51 97Q83 90 102 100M146 73Q177 59 208 65M146 89Q177 75 208 81M146 105Q177 91 196 95" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".5"/><path d="M200 20L210 26L176 87L166 81Z" fill="#e3b363" stroke="currentColor" strokeWidth="2"/><path d="M166 81L164 96L176 87" fill="var(--panel)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M200 20L204 13Q207 9 211 12L214 14Q218 16 215 21L210 26" fill="#c17c65" stroke="currentColor" strokeWidth="2"/><path d="M57 20L61 24L70 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="64" cy="19" r="17" stroke="currentColor" opacity=".3"/></svg></section>
        {savedSession && <section className="resume-banner" aria-label="Unfinished quiz"><div><strong>Continue your quiz</strong><p>{savedSession.category} · Question {savedSession.index + 1} of {savedSession.questions.length} · {savedSession.mode === 'timed' ? 'The timer continues while you are away.' : 'Your answers have been saved.'}</p></div><div className="resume-actions"><button className="primary" onClick={resume}>{savedSession.mode === 'timed' && sessionRemaining(savedSession) === 0 ? 'View expired quiz' : 'Resume quiz'}</button><button className="text-link" onClick={() => { if (window.confirm('Discard this unfinished quiz?')) { setSavedSession(null); persist('quiz-session', null); } }}>Discard</button></div></section>}
        <section className="stats" aria-label="Your learning statistics"><div><strong>{bank.length}</strong><span>Questions</span></div><div><strong>{categories.length - 1}</strong><span>Topics</span></div><div><strong>{history.length ? `${Math.max(...history.map(h => h.percent))}%` : '—'}</strong><span>Best recent score</span></div><div><strong>{history.length}</strong><span>Recent quizzes</span></div></section>
        <div className="workspace"><section className="panel setup" id="setup"><div className="section-heading"><div><h2>Quiz settings</h2></div><span className="pill">{available.length} available</span></div>
          <label className="field-label" htmlFor="topic">Topic</label><select id="topic" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select>
          <div className="field-row"><label>Difficulty<select value={difficulty} onChange={e => setDifficulty(e.target.value)}><option value="all">All levels</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>Questions<select value={count} onChange={e => setCount(Number(e.target.value))}>{[5,10,15,20].map(n => <option key={n} value={n}>{n} questions</option>)}</select></label></div>
          <p className="field-label">Mode</p><div className="mode-grid"><button className={`mode-card ${mode === 'practice' ? 'selected' : ''}`} onClick={() => setMode('practice')} aria-pressed={mode === 'practice'}><strong>Practice</strong><small>No timer. See explanations after each answer.</small></button><button className={`mode-card ${mode === 'timed' ? 'selected' : ''}`} onClick={() => setMode('timed')} aria-pressed={mode === 'timed'}><strong>Timed quiz</strong><small>30 seconds per question, pooled.</small></button></div><p className="helper">{available.length ? `${Math.min(count, available.length)} shuffled questions · ${mode === 'practice' ? 'Instant explanations' : `${time(Math.min(count, available.length) * 30)} total · explanations after finishing`}` : 'No questions match these filters. Try another topic or difficulty.'}</p><button className="primary start-button" onClick={() => start()} disabled={!available.length}>Start quiz</button>
        </section><aside className="sidebar"><section className="panel library"><h2>Custom questions</h2><p>Add questions with a form, or import a CSV file.</p><button className="primary manage-button" onClick={() => setScreen('manager')}>Manage questions</button><button className="secondary" onClick={downloadTemplate}>Download CSV template</button><label className="upload-button">Import CSV<input type="file" accept=".csv,text/csv" onChange={importFile}/></label><button className="secondary" onClick={() => downloadCSV(exportCSV(custom), 'my-quiz-questions.csv')} disabled={!custom.length}>Export my questions</button><small>{custom.length} imported · saved on this browser</small>{custom.length > 0 && <button className="text-link danger" onClick={() => { if (window.confirm('Remove all imported questions from this browser?')) { setCustom([]); persist('quiz-custom', []); setCategory('All topics'); } }}>Clear imported questions</button>}</section><section className="panel activity"><h2>Recent results</h2>{history.length > 0 && <button className="text-link clear-history" onClick={() => { if (window.confirm('Clear recent quiz results from this browser?')) { setHistory([]); persist('quiz-history', []); } }}>Clear history</button>}{history.length ? <ul>{history.slice(0, 3).map((h, i) => <li key={`${h.date}-${i}`}><div><strong>{h.category}</strong><small>{new Date(h.date).toLocaleDateString()} · {h.mode}</small></div><b>{h.percent}%</b></li>)}</ul> : <p>No results yet. Your completed quizzes will appear here.</p>}</section></aside></div>
      </> : screen === 'quiz' ? <section className="panel quiz-panel"><div className="quiz-top"><span className="pill">{question.category} · {question.difficulty}</span><span className={remaining < 30 ? 'timer urgent' : 'timer'}>{mode === 'timed' ? `◷ ${time(remaining)}` : 'Practice mode'}</span></div><div className="question-meta"><span>QUESTION {index + 1} OF {questions.length}</span><span>{Math.round((index + (answered ? 1 : 0)) / questions.length * 100)}% complete</span></div><progress value={index + (answered ? 1 : 0)} max={questions.length} aria-label="Quiz progress"/><h1 ref={heading} tabIndex={-1} className="question-title">{question.question}</h1><div className="options">{question.options.map((option, i) => <button key={i} disabled={answered} onClick={() => choose(i)} className={`answer ${answers[index] === i ? 'picked' : ''} ${answered && mode === 'practice' && i === question.correctAnswer ? 'correct' : ''} ${answered && mode === 'practice' && answers[index] === i && i !== question.correctAnswer ? 'wrong' : ''}`}><span className="answer-letter">{String.fromCharCode(65 + i)}</span><span>{option}</span>{answered && mode === 'practice' && i === question.correctAnswer && <span className="answer-mark">✓ Correct</span>}{answered && mode === 'practice' && answers[index] === i && i !== question.correctAnswer && <span className="answer-mark">✕ Your answer</span>}{answered && mode === 'timed' && answers[index] === i && <span className="answer-mark">Selected</span>}</button>)}</div>{answered && <div className="feedback" role="status">{mode === 'practice' ? <><strong>{answers[index] === question.correctAnswer ? 'Correct' : 'Incorrect'}</strong><p>{question.explanation}</p></> : 'Answer saved.'}</div>}<div className="quiz-bottom"><button className="text-link" onClick={pause}>Save & exit</button><button className="primary" disabled={!answered} onClick={() => index === questions.length - 1 ? finish() : setIndex(i => i + 1)}>{index === questions.length - 1 ? 'View results' : 'Next question'} →</button></div>{!answered && <p className="helper">Choose an answer to continue.</p>}</section> : <section className="results"><div className="panel result-summary"><h1 ref={heading} tabIndex={-1}>Quiz results</h1><div className="score-circle"><strong>{Math.round(score / questions.length * 100)}<span>%</span></strong><small>correct answers</small></div><p>{score} of {questions.length} correct · {time(elapsed)} elapsed</p>{answers.filter(a => a !== undefined).length < questions.length && <p>Time’s up. Unanswered questions count as incorrect.</p>}<div className="result-actions"><button className="primary" onClick={() => setScreen('home')}>New quiz</button>{missedQuestions(questions, answers).length > 0 && <button className="secondary" onClick={() => start(missedQuestions(questions, answers), true)}>Practice missed questions ({missedQuestions(questions, answers).length})</button>}</div></div><div className="section-heading review-heading"><div><h2>Answer review</h2></div><label className="review-filter">Show<select value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}><option value="all">All answers</option><option value="missed">Incorrect & unanswered</option></select></label></div>{reviewFilter === 'missed' && missedQuestions(questions, answers).length === 0 && <p className="empty-state">All answers were correct.</p>}{questions.map((q, i) => (reviewFilter === 'all' || answers[i] !== q.correctAnswer) && <article className="panel review" key={q.id}><span className={`review-status ${answers[i] === q.correctAnswer ? 'success' : ''}`}>{answers[i] === q.correctAnswer ? '✓ Correct' : answers[i] === undefined ? '○ Unanswered' : '✕ Incorrect'}</span><h3>{i + 1}. {q.question}</h3>{answers[i] !== undefined && answers[i] !== q.correctAnswer && <p>Your answer: {q.options[answers[i]]}</p>}<p><strong>Correct answer: {q.options[q.correctAnswer]}</strong></p><p>{q.explanation}</p></article>)}</section>}
    </main><footer><span className="brand footer-brand">Quizora</span><p>Practice quizzes</p><span>Scores & imports stay on this browser.</span></footer>
  </div>;
}
