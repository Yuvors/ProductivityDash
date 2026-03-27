/* ============================================================
   SUPABASE SQL MIGRATION
   Run this once in your Supabase project → SQL Editor

   create table if not exists tasks (
     id         text primary key,
     user_id    uuid references auth.users not null,
     title      text not null,
     completed  boolean not null default false,
     created_at timestamptz not null default now()
   );
   alter table tasks enable row level security;
   create policy "owner_all" on tasks for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create table if not exists claude_ideas (
     id         text primary key,
     user_id    uuid references auth.users not null,
     content    text not null,
     created_at timestamptz not null default now()
   );
   alter table claude_ideas enable row level security;
   create policy "owner_all" on claude_ideas for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create table if not exists learning_path (
     id         text primary key,
     user_id    uuid references auth.users not null,
     topic      text not null,
     position   integer not null default 0,
     created_at timestamptz not null default now()
   );
   alter table learning_path enable row level security;
   create policy "owner_all" on learning_path for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create table if not exists projects (
     id          text primary key,
     user_id     uuid references auth.users not null,
     name        text not null,
     description text,
     status      text not null default 'tostart',
     created_at  timestamptz not null default now()
   );
   alter table projects enable row level security;
   create policy "owner_all" on projects for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);

   create table if not exists floater_state (
     user_id    uuid primary key references auth.users,
     note       text,
     visible    boolean not null default true,
     style      text not null default 'drift',
     updated_at timestamptz not null default now()
   );
   alter table floater_state enable row level security;
   create policy "owner_all" on floater_state for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);

   -- Enable Realtime for tasks, claude_ideas, learning_path, projects
   -- in Supabase: Database → Replication → enable for each table
   ============================================================ */

// ── Credentials — fill these in ───────────────────────────────
const SUPABASE_URL  = 'https://cpohvlxdgyzsjsbyhvdz.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb2h2bHhkZ3l6c2pzYnlodmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MDgwOTcsImV4cCI6MjA5MDE4NDA5N30.yRGvzwRCIMNqyvi_uFIPlSoUcC4gv-KGZm-pK3alKC0'
// ─────────────────────────────────────────────────────────────

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON)

// Cache key map
const CK = {
  tasks:    'pdash_tasks',
  ideas:    'pdash_ideas',
  learning: 'pdash_learning',
  projects: 'pdash_projects',
  floater:  'pdash_floater',
}

function _readArr(key) {
  try { return JSON.parse(localStorage.getItem(CK[key])) ?? [] } catch { return [] }
}
function _writeArr(key, arr) {
  localStorage.setItem(CK[key], JSON.stringify(arr))
}

function genId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2,9)}`
}

let _user = null

window.DB = {
  // ── Auth ─────────────────────────────────────────────────────
  async init() {
    const { data: { session } } = await _sb.auth.getSession()
    _user = session?.user ?? null
    _sb.auth.onAuthStateChange((_e, session) => {
      _user = session?.user ?? null
      if (typeof window.onAuthChange === 'function') window.onAuthChange(_user)
    })
    return _user
  },

  async signIn(email, password) {
    const { data, error } = await _sb.auth.signInWithPassword({ email, password })
    if (!error) _user = data.user
    return { user: data?.user, error }
  },

  async signOut() {
    await _sb.auth.signOut()
    _user = null
  },

  // ── Tasks ─────────────────────────────────────────────────────
  getTasks() { return _readArr('tasks') },

  async addTask(title) {
    const item = { id: genId(), title, completed: false, created_at: new Date().toISOString() }
    _writeArr('tasks', [item, ..._readArr('tasks')])
    if (_user) await _sb.from('tasks').insert({ ...item, user_id: _user.id }).catch(console.error)
    return item
  },

  async updateTask(id, changes) {
    _writeArr('tasks', _readArr('tasks').map(t => t.id === id ? { ...t, ...changes } : t))
    if (_user) await _sb.from('tasks').update(changes).eq('id', id).catch(console.error)
  },

  async deleteTask(id) {
    _writeArr('tasks', _readArr('tasks').filter(t => t.id !== id))
    if (_user) await _sb.from('tasks').delete().eq('id', id).catch(console.error)
  },

  // ── Claude Ideas ──────────────────────────────────────────────
  getIdeas() { return _readArr('ideas') },

  async addIdea(content) {
    const item = { id: genId(), content, created_at: new Date().toISOString() }
    _writeArr('ideas', [..._readArr('ideas'), item])
    if (_user) await _sb.from('claude_ideas').insert({ ...item, user_id: _user.id }).catch(console.error)
    return item
  },

  async deleteIdea(id) {
    _writeArr('ideas', _readArr('ideas').filter(i => i.id !== id))
    if (_user) await _sb.from('claude_ideas').delete().eq('id', id).catch(console.error)
  },

  // ── Learning Path ─────────────────────────────────────────────
  getLearningItems() { return _readArr('learning') },

  async addLearningItem(topic) {
    const items = _readArr('learning')
    const item = { id: genId(), topic, position: items.length, created_at: new Date().toISOString() }
    _writeArr('learning', [...items, item])
    if (_user) await _sb.from('learning_path').insert({ ...item, user_id: _user.id }).catch(console.error)
    return item
  },

  async deleteLearningItem(id) {
    const updated = _readArr('learning').filter(l => l.id !== id).map((l, i) => ({ ...l, position: i }))
    _writeArr('learning', updated)
    if (_user) {
      await _sb.from('learning_path').delete().eq('id', id).catch(console.error)
    }
  },

  async moveLearningItem(id, direction) {
    const items = _readArr('learning')
    const idx = items.findIndex(l => l.id === id)
    if (idx < 0) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= items.length) return

    ;[items[idx], items[newIdx]] = [items[newIdx], items[idx]]
    const reordered = items.map((l, i) => ({ ...l, position: i }))
    _writeArr('learning', reordered)

    if (_user) {
      await Promise.all(reordered.map(l =>
        _sb.from('learning_path').update({ position: l.position }).eq('id', l.id)
      )).catch(console.error)
    }
  },

  // ── Projects ──────────────────────────────────────────────────
  getProjects() { return _readArr('projects') },

  async addProject(data) {
    const item = { id: genId(), ...data, created_at: new Date().toISOString() }
    _writeArr('projects', [..._readArr('projects'), item])
    if (_user) await _sb.from('projects').insert({ ...item, user_id: _user.id }).catch(console.error)
    return item
  },

  async updateProject(id, changes) {
    _writeArr('projects', _readArr('projects').map(p => p.id === id ? { ...p, ...changes } : p))
    if (_user) await _sb.from('projects').update(changes).eq('id', id).catch(console.error)
  },

  async deleteProject(id) {
    _writeArr('projects', _readArr('projects').filter(p => p.id !== id))
    if (_user) await _sb.from('projects').delete().eq('id', id).catch(console.error)
  },

  // ── Floater State ─────────────────────────────────────────────
  getFloaterState() {
    try {
      const stored = localStorage.getItem(CK.floater)
      return stored ? JSON.parse(stored) : { text: 'Consistency beats perfection. Show up every day.', visible: true, style: 'drift' }
    } catch {
      return { text: 'Consistency beats perfection. Show up every day.', visible: true, style: 'drift' }
    }
  },

  async saveFloaterState(state) {
    localStorage.setItem(CK.floater, JSON.stringify(state))
    if (_user) {
      await _sb.from('floater_state')
        .upsert({ user_id: _user.id, note: state.text, visible: state.visible, style: state.style, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .catch(console.error)
    }
  },

  // ── Full sync from Supabase (called after login) ───────────────
  async syncAll() {
    if (!_user) return
    try {
      const [t, i, l, p, f] = await Promise.all([
        _sb.from('tasks').select('*').order('created_at', { ascending: false }),
        _sb.from('claude_ideas').select('*').order('created_at'),
        _sb.from('learning_path').select('*').order('position'),
        _sb.from('projects').select('*').order('created_at'),
        _sb.from('floater_state').select('*').eq('user_id', _user.id).maybeSingle(),
      ])
      if (t.data) _writeArr('tasks', t.data)
      if (i.data) _writeArr('ideas', i.data)
      if (l.data) _writeArr('learning', l.data)
      if (p.data) _writeArr('projects', p.data)
      if (f.data) {
        const cur = this.getFloaterState()
        localStorage.setItem(CK.floater, JSON.stringify({
          text:    f.data.note    ?? cur.text,
          visible: f.data.visible ?? cur.visible,
          style:   f.data.style   ?? cur.style,
        }))
      }
    } catch (e) { console.warn('Sync failed (offline?):', e) }
  },

  // ── Realtime subscriptions ─────────────────────────────────────
  subscribeAll(callbacks) {
    if (!_user) return

    const tables = [
      { table: 'tasks',        key: 'tasks',    cb: callbacks.onTasksChange },
      { table: 'claude_ideas', key: 'ideas',    cb: callbacks.onIdeasChange },
      { table: 'learning_path',key: 'learning', cb: callbacks.onLearningChange },
      { table: 'projects',     key: 'projects', cb: callbacks.onProjectsChange },
    ]

    tables.forEach(({ table, key, cb }) => {
      _sb.channel(`${table}-live`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table,
          filter: `user_id=eq.${_user.id}`,
        }, payload => {
          const items = _readArr(key)
          if (payload.eventType === 'INSERT') {
            if (!items.find(x => x.id === payload.new.id))
              _writeArr(key, key === 'tasks' ? [payload.new, ...items] : [...items, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            _writeArr(key, items.map(x => x.id === payload.new.id ? payload.new : x))
          } else if (payload.eventType === 'DELETE') {
            _writeArr(key, items.filter(x => x.id !== payload.old.id))
          }
          cb?.()
        })
        .subscribe()
    })
  },
}
