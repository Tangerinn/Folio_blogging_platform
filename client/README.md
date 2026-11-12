# Folio — client

React 18 + Vite + Tailwind v4. Runs entirely on **mock data** (saved in your browser) until you connect the backend.

## Run
```bash
npm install
cp .env.example .env     # VITE_USE_MOCK=true
npm run dev              # http://localhost:5173
```
Demo logins: `student@demo.com / password123` · `admin@demo.com / admin123`
Reset the mock data: run `localStorage.clear()` in the browser console.

## Where things live
- `src/services/api/` — **the only place that talks to data.** `mockApi.js` and `realApi.js` expose identical methods; `index.js` picks one.
- `src/pages/` — one file per screen (auth, student, admin). `src/App.jsx` — all routes.
- `src/state/` — Auth and Notifications context. `src/layouts/` — student shell and admin shell.
- `src/components/` — shared UI (`common/ui.jsx`), post renderer/editor, comments.
- `src/index.css` — design tokens from DESIGN.md.

## Connecting the backend later
1. Set `VITE_USE_MOCK=false` and `VITE_API_URL=http://localhost:5000/api` in `.env`.
2. For each method in `realApi.js`, make the server return what `mockApi.js` returns. Where they differ, fix the server to match the mock (the mock is your UI's contract).
3. Methods marked `(assumed)` use endpoints **not in api.md** — add them to api.md or change them.

## Assumptions to confirm
- Editor is TipTap; post content is stored as its JSON. Images are external URLs only.
- A category with posts can't be deleted (not in docs).
- Admin "Remove content" on a report deletes the post/comment and marks the report resolved.
- Access token goes in the `Authorization: Bearer` header; refresh token kept in localStorage (simple for v1; revisit with cookies for production).
- Extra endpoints assumed: GET /users/me, GET /users/:id, PATCH /users/me, GET /posts?mine=true, GET /categories.
