# ProductivityDash

**Location:** `C:\Users\yuval\CursorProjects\ProductivityDash`
**Repo:** GitHub, branch `main`, remote `origin/main`

## What it is
Personal productivity dashboard — dark glassmorphism bento-grid SPA. Vanilla HTML/CSS/JS frontend, Supabase (PostgreSQL) backend. No build step; served as static files.

## Features built
- **Tomorrow's Tasks** — add/complete/delete tasks
- **Claude Ideas** — expandable idea list
- **Learning Path** — ordered steps with reorder (▲▼)
- **Projects Kanban** — 3-column board (To Start / In Progress / Completed)
- **Floating Motivational Statement** — customizable, animated, toggleable
- **Supabase realtime sync** — local-first with localStorage cache + WebSocket live updates

## Tech stack
- Frontend: Vanilla JS, HTML5, CSS3 (glassmorphism, IntersectionObserver scroll-reveal)
- Backend: Supabase (auth, RLS, realtime subscriptions)
- Key files: `index.html`, `app.js`, `db.js`, `floater.js`, `style.css`

## DB tables (Supabase, all with RLS `owner_all` policy)
`tasks`, `claude_ideas`, `learning_path`, `projects`, `floater_state`

## Design system
Dark-first. Base `#0D0F12`, accent teal `#00C9A7` / cyan `#00B4D8`. Frosted glass cards, bento grid layout.

## Notes
- Supabase credentials hardcoded in `db.js` (project: `cpohvlxdgyzsjsbyhvdz`)
- No package.json — CDN-loaded Supabase JS
- One uncommitted change: db.js credentials added after initial commit
