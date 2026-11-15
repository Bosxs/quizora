import { useEffect, useRef, useState } from 'react';
import { validateQuestion } from '../../lib/quiz';

const empty = () => ({ question: '', category: '', difficulty: 'easy', options: ['', '', '', ''], correctAnswer: 0, explanation: '' });

export default function QuestionManager({ builtIn, custom, onSave, onDelete, onBack }) {
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const editor = useRef(null);
  const title = useRef(null);
  useEffect(() => { title.current?.focus(); }, []);
  const all = [...builtIn, ...custom];
  const customIds = new Set(custom.map(q => q.id));
  const filtered = all.filter(q => (source === 'all' || customIds.has(q.id)) && (category === 'all' || q.category === category) && `${q.question} ${q.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  function open(question = null, isCopy = false) {
    setEditingId(isCopy ? null : question?.id ?? null);
    setDraft(question ? { ...question, options: [...question.options] } : empty());
    setError(isCopy ? 'Change the question text before saving your own version.' : '');
    setTimeout(() => { editor.current?.scrollIntoView({ behavior: 'auto', block: 'start' }); editor.current?.focus(); }, 0);
  }
  function submit(event) {
    event.preventDefault();
    const question = { ...draft, id: editingId || `custom-${crypto.randomUUID()}`, question: draft.question.trim(), category: draft.category.trim(), explanation: draft.explanation.trim(), options: draft.options.map(option => option.trim()) };
    if (!validateQuestion(question)) { setError('Fill in every field and use four different answer options.'); return; }
    if (all.some(q => q.id !== editingId && q.question.trim().toLowerCase() === question.question.toLowerCase())) { setError('That question already exists. Change the text or edit the existing custom question.'); return; }
    if (!editingId && custom.length >= 1000) { setError('The custom library is full. Delete a question before adding another.'); return; }
    onSave(question); setDraft(null); setEditingId(null); setError('');
  }
  return <section className="manager">
    <div className="manager-heading"><div><h1 ref={title} tabIndex={-1}>Question manager</h1><p>Browse the question bank, or add and edit your own questions.</p></div><button className="secondary" onClick={onBack}>Back to quizzes</button></div>
    <div className="manager-toolbar"><label>Search questions<input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by question or topic"/></label><label>Topic<select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="all">All topics</option>{[...new Set(all.map(q => q.category))].map(c => <option key={c}>{c}</option>)}</select></label><label>Library<select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}><option value="all">All questions</option><option value="custom">My questions</option></select></label><button className="primary" onClick={() => open()}>Add question</button></div>
    {draft && <form className="question-editor" onSubmit={submit}><h2 ref={editor} tabIndex={-1}>{editingId ? 'Edit question' : 'Add question'}</h2><label>Question<textarea required maxLength={1000} value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })}/></label><div className="field-row"><label>Topic<input required maxLength={80} list="question-topics" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/><datalist id="question-topics">{[...new Set(all.map(q => q.category))].map(c => <option key={c} value={c}/>)}</datalist></label><label>Difficulty<select value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value })}>{['easy', 'medium', 'hard'].map(d => <option key={d}>{d}</option>)}</select></label></div><fieldset><legend>Answers — select the correct one</legend>{draft.options.map((option, i) => <div className="option-editor" key={i}><input type="radio" name="correct" aria-label={`Option ${i + 1} is correct`} checked={draft.correctAnswer === i} onChange={() => setDraft({ ...draft, correctAnswer: i })}/><label>Option {i + 1}<input required maxLength={300} value={option} onChange={e => setDraft({ ...draft, options: draft.options.map((value, j) => j === i ? e.target.value : value) })}/></label></div>)}</fieldset><label>Explanation<textarea required maxLength={2000} value={draft.explanation} onChange={e => setDraft({ ...draft, explanation: e.target.value })}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="editor-actions"><button className="primary" type="submit">Save question</button><button className="secondary" type="button" onClick={() => { setDraft(null); setError(''); }}>Cancel</button></div></form>}
    <p className="helper">{filtered.length} questions · {custom.length} custom. Built-in questions are read-only. Custom questions stay in this browser.</p>
    <div className="question-list">{filtered.slice((currentPage - 1) * 12, currentPage * 12).map(q => <article key={q.id}><div className="question-list-meta">{q.category} · {q.difficulty} · {customIds.has(q.id) ? 'Custom' : 'Built-in'}</div><h2>{q.question}</h2><details><summary>View answer and explanation</summary><p><strong>{q.options[q.correctAnswer]}</strong></p><p>{q.explanation}</p></details><div className="question-list-actions">{customIds.has(q.id) ? <><button className="text-link" onClick={() => open(q)}>Edit</button><button className="text-link danger" onClick={() => { if (window.confirm('Delete this custom question?')) { onDelete(q.id); if (category === q.category && !all.some(item => item.id !== q.id && item.category === category)) setCategory('all'); if (editingId === q.id) setDraft(null); } }}>Delete</button></> : <button className="text-link" onClick={() => open(q, true)}>Use as template</button>}</div></article>)}</div>
    {!filtered.length && <p className="empty-state">No questions match your search.</p>}
    <nav className="pagination" aria-label="Question pages"><button className="secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button className="secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
  </section>;
}
