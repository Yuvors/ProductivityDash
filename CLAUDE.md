# ProductivityDash

**Location:** `C:\Users\yuval\CursorProjects\ProductivityDash`
**Repo:** GitHub, branch `main`, remote `origin/main`

## Next Steps
- Run the 2 Supabase SQL migrations (if not done yet — see DB section)
- Test the app: open in browser, log in, navigate to Learning Path page
- Try the AI tutor: enter Anthropic API key when prompted, ask it to build a curriculum
- Potential future improvements: Projects page, Tasks page, drag-to-reorder milestones

## What it is
Personal productivity dashboard — dark glassmorphism multi-page SPA. Vanilla HTML/CSS/JS frontend, Supabase (PostgreSQL) backend. No build step; served as static files.

## Features built
- **Tomorrow's Tasks** — add/complete/delete tasks
- **Claude Ideas** — expandable idea list
- **Projects Kanban** — 3-column board (To Start / In Progress / Completed)
- **Floating Motivational Statement** — customizable, animated, toggleable
- **Supabase realtime sync** — local-first with localStorage cache + WebSocket live updates
- **Multi-page SPA with nav bar** — hash-based router (#home / #learning)
- **Visual Learning Path page** — winding milestone map with SVG path, todo/current/done states, pulsing glow, progress bar, auto-advance
- **Claude Code Tutor chat agent** — Anthropic API with tool use; can design and insert learning steps directly. API key syncs across devices via Supabase.

## Tech stack
- Frontend: Vanilla JS, HTML5, CSS3 (glassmorphism, IntersectionObserver scroll-reveal)
- Backend: Supabase (auth, RLS, realtime subscriptions)
- AI: Anthropic API (claude-sonnet-4-6, browser fetch, tool use)
- Key files: `index.html`, `app.js`, `db.js`, `floater.js`, `style.css`, `router.js`, `learning-path-page.js`, `chat-agent.js`

## DB tables (Supabase, all with RLS `owner_all` policy)
`tasks`, `claude_ideas`, `learning_path`, `projects`, `floater_state`

### Pending migrations (run in Supabase SQL Editor)
```sql
ALTER TABLE learning_path
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'current', 'done'));

ALTER TABLE floater_state
  ADD COLUMN IF NOT EXISTS anthropic_key text;
```

## Design system
Dark-first. Base `#0D0F12`, accent teal `#00C9A7` / cyan `#00B4D8`. Frosted glass cards, bento grid on home, 2-column layout on learning page.

## Key Decisions
- **Hash-based router** over history API — simpler, no server-side routing needed for static file serving
- **Visual milestone map** uses SVG for the connecting path with `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"` so the path scales responsively while stroke stays crisp
- **Shared fixed popup** for milestone actions — avoids overflow clipping issues from absolutely-positioned popups inside scroll containers
- **API key in Supabase** (floater_state.anthropic_key) not just localStorage — syncs across devices on login
- **Auto-advance** when marking a step done — automatically sets the next todo step to current
- **Learning path removed from home page** — now its own dedicated page; claude-card only shows Ideas

## Notes
- Supabase credentials hardcoded in `db.js` (project: `cpohvlxdgyzsjsbyhvdz`)
- No package.json — CDN-loaded Supabase JS
- Anthropic API key is entered by user on first visit to Learning Path page; stored in Supabase

## Session Log
- **2026-03-29** — Added multi-page router, redesigned Learning Path as visual milestone map with winding SVG path and todo/current/done states, built Claude Code Tutor chat agent with full tool-use support. Committed and pushed to GitHub.
