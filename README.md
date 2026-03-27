# ProductivityDash

A personal productivity dashboard with a dark glassmorphism design. Manage tomorrow's tasks, project ideas, a learning path, and a Kanban board — all synced to Supabase in real time.

## Features

- **Tomorrow's Tasks** — add, complete, and delete tasks for the next day
- **Claude Ideas** — capture project/feature ideas in a running list
- **Learning Path** — ordered steps you can reorder with ▲▼ buttons
- **Projects Kanban** — three-column board: To Start → In Progress → Completed
- **Floating Motivational Statement** — customizable floating quote with Drift or Pulse animation
- **Real-time sync** — changes appear instantly across devices via Supabase Realtime
- **Offline-first** — all data cached in localStorage; works without a connection

## Stack

- Vanilla HTML / CSS / JavaScript (no build step)
- [Supabase](https://supabase.com) — auth, PostgreSQL database, realtime subscriptions
- Hosted via GitHub Pages (static files)

## Setup

### 1. Supabase tables

Run the SQL migration at the top of `db.js` in your Supabase project's SQL Editor. It creates the five tables (`tasks`, `claude_ideas`, `learning_path`, `projects`, `floater_state`) with Row-Level Security.

Enable Realtime replication for `tasks`, `claude_ideas`, `learning_path`, and `projects` in **Database → Replication**.

### 2. Credentials

In `db.js`, fill in your project URL and anon key:

```js
const SUPABASE_URL  = 'https://<your-project>.supabase.co'
const SUPABASE_ANON = '<your-anon-key>'
```

### 3. Run

Open `index.html` directly in a browser, or serve with any static server:

```bash
npx serve .
```

## File structure

```
index.html    — markup and layout
app.js        — UI logic, event handlers, render functions
db.js         — Supabase client, localStorage cache, CRUD operations
floater.js    — floating motivational statement module
style.css     — design system, glassmorphism cards, animations
```
