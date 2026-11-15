export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function prepareQuestions(bank, count) {
  return shuffle(bank).slice(0, count).map(question => {
    const options = shuffle(question.options.map((text, index) => ({ text, correct: index === question.correctAnswer })));
    return { ...question, options: options.map(option => option.text), correctAnswer: options.findIndex(option => option.correct) };
  });
}

// Supports quoted commas, escaped quotes, CRLF, and multiline CSV fields.
export function parseCSV(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || field === '') quoted = !quoted;
      else throw new Error('Unexpected quote in CSV. Quote the entire field.');
    } else if (c === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (quoted) throw new Error('A quoted field is missing its closing quote.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift();
  const required = ['question', 'category', 'difficulty', 'option1', 'option2', 'option3', 'option4', 'answer', 'explanation'];
  if (!headers || required.some(key => !headers.includes(key))) throw new Error('Use the template headers: ' + required.join(', '));
  if (!rows.length) throw new Error('Add at least one question below the headers.');
  if (rows.length > 500) throw new Error('Import up to 500 questions at a time.');
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2}: column count does not match the headers.`);
    const item = Object.fromEntries(headers.map((key, i) => [key, values[i]]));
    const options = [item.option1, item.option2, item.option3, item.option4];
    if (!item.question || !item.category || !item.explanation || options.some(value => !value)) throw new Error(`Row ${index + 2}: fill every required field.`);
    if (!['easy', 'medium', 'hard'].includes(item.difficulty.toLowerCase())) throw new Error(`Row ${index + 2}: difficulty must be easy, medium, or hard.`);
    if (!/^[1-4]$/.test(item.answer)) throw new Error(`Row ${index + 2}: answer must be 1, 2, 3, or 4.`);
    if (new Set(options.map(value => value.toLowerCase())).size !== 4) throw new Error(`Row ${index + 2}: answer options must be different.`);
    return { id: `import-${Date.now()}-${index}`, question: item.question, category: item.category, difficulty: item.difficulty.toLowerCase(), options, correctAnswer: Number(item.answer) - 1, explanation: item.explanation };
  });
}

export function exportCSV(questions) {
  const escape = value => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [['question', 'category', 'difficulty', 'option1', 'option2', 'option3', 'option4', 'answer', 'explanation']];
  for (const q of questions) rows.push([q.question, q.category, q.difficulty, ...q.options, q.correctAnswer + 1, q.explanation]);
  return rows.map(row => row.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function missedQuestions(questions, answers) {
  return questions.filter((q, index) => answers[index] !== q.correctAnswer);
}

export function validateQuestion(question) {
  if (!question || typeof question.id !== 'string' || !question.id ||
      !['question', 'category', 'explanation'].every(key => typeof question[key] === 'string' && question[key].trim()) ||
      !['easy', 'medium', 'hard'].includes(question.difficulty) ||
      !Array.isArray(question.options) || question.options.length !== 4 ||
      question.options.some(option => typeof option !== 'string' || !option.trim()) ||
      new Set(question.options.map(option => option.trim().toLowerCase())).size !== 4 ||
      !Number.isInteger(question.correctAnswer) || question.correctAnswer < 0 || question.correctAnswer > 3) {
    return false;
  }
  return true;
}

export function restoreSession(value, now = Date.now()) {
  if (!value || value.version !== 1 || !Array.isArray(value.questions) ||
      value.questions.length < 1 || value.questions.length > 1000 || !value.questions.every(validateQuestion) ||
      new Set(value.questions.map(q => q.id)).size !== value.questions.length ||
      !Array.isArray(value.answers) || value.answers.length > value.questions.length ||
      !value.answers.every(a => a === null || (Number.isInteger(a) && a >= 0 && a < 4)) ||
      !Number.isInteger(value.index) || value.index < 0 || value.index >= value.questions.length ||
      !['practice', 'timed'].includes(value.mode) || typeof value.category !== 'string' ||
      !Number.isFinite(value.startedAt) || value.startedAt <= 0 || value.startedAt > now ||
      !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
      !Number.isFinite(value.savedAt) || value.savedAt > now || value.savedAt < value.startedAt) return null;
  // Earlier questions must already have answers; later questions cannot have answers.
  if (value.questions.some((_, i) => i < value.index && value.answers[i] == null) ||
      value.answers.some((answer, i) => i > value.index && answer !== null)) return null;
  return { ...value, retrying: value.retrying === true };
}

export function sessionRemaining(session, now = Date.now()) {
  return Math.max(0, Math.ceil((session.startedAt + session.questions.length * 30000 - now) / 1000));
}
