# ProductivityDash

**Location:** `C:\Users\yuval\CursorProjects\ProductivityDash`
**Repo:** GitHub, branch `main`, remote `origin/main`

## Next Steps
- **Run the Supabase SQL migration for Calendar** (see DB section) — adds 5 new columns to `tasks` table
- Run the 2 earlier migrations if not done yet (learning_path status, floater_state anthropic_key)
- Test the Planner page: log in, go to #calendar, create tasks, drag to time slots, try the AI agent
- Potential future improvements: Projects page, drag-to-reorder milestones, recurring tasks

## What it is
Personal productivity dashboard — dark glassmorphism multi-page SPA. Vanilla HTML/CSS/JS frontend, Supabase (PostgreSQL) backend. No build step; served as static files.

## Features built
- **Tomorrow's Tasks → Planner preview** — compact home card shows scheduled blocks for tomorrow; quick-add creates unscheduled task
- **Time Planner page** (#calendar) — full calendar with Tomorrow and This Week views; draggable time blocks on a time grid; drag from unscheduled pool to schedule; native HTML5 drag-and-drop
- **Task time blocks** — title, description, color category (teal/cyan/amber/jade/rose), duration; resize by dragging bottom edge; conflict detection (red border); mark done / delete on hover
- **Schedule Assistant AI agent** — Anthropic API with tool use (get_schedule, create_task, schedule_task, reschedule_bulk, complete_task); schedules tasks directly on the calendar
- **Claude Ideas** — expandable idea list
- **Projects Kanban** — 3-column board (To Start / In Progress / Completed)
- **Floating Motivational Statement** — customizable, animated, toggleable
- **Supabase realtime sync** — local-first with localStorage cache + WebSocket live updates
- **Multi-page SPA with nav bar** — hash-based router (#home / #calendar / #learning)
- **Visual Learning Path page** — winding milestone map with SVG path, todo/current/done states, pulsing glow, progress bar, auto-advance
- **Claude Code Tutor chat agent** — Anthropic API with tool use; can design and insert learning steps directly. API key syncs across devices via Supabase.

## Tech stack
- Frontend: Vanilla JS, HTML5, CSS3 (glassmorphism, IntersectionObserver scroll-reveal)
- Backend: Supabase (auth, RLS, realtime subscriptions)
- AI: Anthropic API (claude-sonnet-4-6, browser fetch, tool use)
- Key files: `index.html`, `app.js`, `db.js`, `floater.js`, `style.css`, `router.js`, `learning-path-page.js`, `chat-agent.js`, `calendar-page.js`, `calendar-agent.js`

## DB tables (Supabase, all with RLS `owner_all` policy)
`tasks`, `claude_ideas`, `learning_path`, `projects`, `floater_state`

### Pending migrations (run in Supabase SQL Editor)
```sql
-- Learning path status (session 2026-03-29)
ALTER TABLE learning_path
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'current', 'done'));

ALTER TABLE floater_state
  ADD COLUMN IF NOT EXISTS anthropic_key text;

-- Calendar / Task scheduling (session 2026-03-29)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS description      text,
  ADD COLUMN IF NOT EXISTS scheduled_date   text,
  ADD COLUMN IF NOT EXISTS start_time       text,
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS color            text    NOT NULL DEFAULT 'teal'
    CHECK (color IN ('teal','cyan','amber','jade','rose'));
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
- **Tasks card → "Tomorrow Preview"** — home card now shows compact scheduled blocks for tomorrow; full calendar is its own #calendar page
- **Native HTML5 drag-and-drop** for time blocks — no libraries; drop targets are per-cell with data-date/data-time attrs; snap is implicit (cell = 30min slot)
- **Task scheduling stored as text fields** (scheduled_date: 'YYYY-MM-DD', start_time: 'HH:MM') rather than timestamptz — simpler for timezone-free local time display
- **Conflict detection at render time** — scanned client-side before rendering, marked with CSS class; no server validation needed
- **Calendar agent uses same API key overlay** as learning chat — single overlay, both agents check `DB.getApiKey()`

## Notes
- Supabase credentials hardcoded in `db.js` (project: `cpohvlxdgyzsjsbyhvdz`)
- No package.json — CDN-loaded Supabase JS
- Anthropic API key is entered by user on first visit to Learning Path page; stored in Supabase

## Session Log
- **2026-03-29** — Added multi-page router, redesigned Learning Path as visual milestone map with winding SVG path and todo/current/done states, built Claude Code Tutor chat agent with full tool-use support. Committed and pushed to GitHub.
- **2026-03-29** — Added Time Planner page (#calendar): full calendar grid (Tomorrow/This Week views), draggable time blocks with color categories, resize handle, conflict detection, current-time indicator. Replaced home Tasks card with compact "Tomorrow Preview". Added Schedule Assistant AI agent (calendar-agent.js) with 5 tools. Needs Supabase migration for new tasks columns.
