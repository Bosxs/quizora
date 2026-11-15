# Quizora

A React + Vite quiz app with 75 built-in questions across Technology, Web Development, Science, General Knowledge, and Ghana.

## Run locally

```sh
npm ci
npm run dev
```

Build for hosting with `npm run build`. The static output is `dist/`.

## Features

- Searchable question manager with forms to add, edit, and delete custom questions. Built-in questions can be used as templates.
- Automatic quiz saves and a Save & exit button. Practice mode resumes with its saved elapsed time; timed quizzes keep running while you are away.
- Topic, difficulty, and question-count filters. If fewer questions match, the quiz uses all available matches.
- Shuffled questions and answer options.
- Practice mode with immediate explanations.
- Timed mode with a pooled budget of 30 seconds per question, and explanations after finishing. Unanswered questions count as incorrect.
- Answer review with an incorrect/unanswered filter and practice mode for missed questions.
- Dark mode and the latest 20 scores in browser storage, with a clear-history option.
- CSV question import with validation and duplicate-question detection. Export imported questions as CSV for backup or reuse.

## Add questions

Download the CSV template from the home screen. Required headers:

```csv
question,category,difficulty,option1,option2,option3,option4,answer,explanation
Which hook adds state?,Web Development,easy,useEffect,useState,useRef,useContext,2,useState stores component state.
```

`answer` is numbered **1–4**. `difficulty` must be `easy`, `medium`, or `hard`. Quote fields containing commas or newlines, and escape quotes by doubling them. Imports are limited to 500 questions per file, 1 MB per file, and 1,000 imported questions in this browser.

Imported questions and scores stay in the current browser. They are not shared with other visitors and may disappear if browser data is cleared. To publish questions for everyone, add them to `src/assets/data.js` and redeploy. Check question accuracy before publishing.

Built-in question objects use zero-based `correctAnswer` values (0–3). No API keys or backend are required. The site uses system fonts and a small inline book-and-pencil illustration.

## Checks

```sh
npm test
npm run build
```

## Saved quizzes

One unfinished quiz is saved in this browser. Starting another quiz asks before replacing it. The saved snapshot preserves question order, shuffled answer options, selected answers, and the current question. Completing or discarding an attempt clears its saved state. Saving occurs after answers and navigation, periodically, and when the page is hidden. Storage failures are reported; progress cannot be recovered after browser storage is cleared.

Custom question changes apply to future quizzes. An unfinished quiz keeps its original question snapshot. Built-in questions are read-only; to create a variant, use the template action and change the question text. Custom questions can be exported as CSV from the home screen.

## Deploy to Vercel

Import this repository into Vercel. Keep the **Root Directory** at the repository root (`./`).

- Framework: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables or external services are required. Browser data belongs to the site origin, so questions and scores saved on another hosted URL will not automatically move to the Vercel URL. Export custom questions as CSV before switching hosts.
