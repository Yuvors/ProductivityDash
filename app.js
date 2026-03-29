// ── Utilities ───────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function $(id) { return document.getElementById(id) }

// ── Date header ─────────────────────────────────────────────────
function updateDate() {
  const now  = new Date()
  const tmrw = new Date(now)
  tmrw.setDate(tmrw.getDate() + 1)

  const fmt = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  $('header-date').textContent = `Today: ${fmt(now)}  ·  Planning for: ${fmt(tmrw)}`
}

// ── Scroll reveal ────────────────────────────────────────────────
function setupScrollReveal() {
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible')
    }),
    { threshold: 0.08 }
  )
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
}

// ── Tasks Preview (home page) ─────────────────────────────────────
function _tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function renderTasksPreview() {
  const tasks  = DB.getTasks()
  const tmrw   = _tomorrowStr()
  const badge  = $('tasks-badge')
  const list   = $('tasks-preview-list')
  const note   = $('tasks-unscheduled-note')
  if (!list) return

  const scheduled   = tasks.filter(t => t.scheduled_date === tmrw && !t.completed)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  const unscheduled = tasks.filter(t => !t.scheduled_date && !t.completed)

  badge.textContent = unscheduled.length

  const colorMap = { teal: '#00C9A7', cyan: '#00B4D8', amber: '#FFB347', jade: '#00D4AA', rose: '#FF6B8A' }

  list.innerHTML = scheduled.slice(0, 4).map(t => `
    <div class="preview-block">
      <span class="preview-dot" style="background:${colorMap[t.color] || colorMap.teal}"></span>
      <span class="preview-time">${t.start_time || ''}</span>
      <span class="preview-title">${esc(t.title)}</span>
    </div>
  `).join('') || (scheduled.length === 0 && unscheduled.length === 0
    ? '<p class="tasks-unscheduled-note" style="margin:0">Nothing planned yet</p>' : '')

  if (note) {
    note.textContent = unscheduled.length
      ? `${unscheduled.length} unscheduled task${unscheduled.length > 1 ? 's' : ''} — open planner to schedule`
      : (scheduled.length > 4 ? `+${scheduled.length - 4} more scheduled` : '')
  }
}

function setupTaskInput() {
  const input  = $('task-input')
  const addBtn = $('task-add-btn')
  if (!input) return

  function add() {
    const val = input.value.trim()
    if (!val) return
    input.value = ''
    DB.addTask(val)
    renderTasksPreview()
    window.renderCalendar?.()
  }

  addBtn.addEventListener('click', add)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') add() })
}

// ── Claude Ideas ─────────────────────────────────────────────────
function renderIdeas() {
  const ideas = DB.getIdeas()
  const list  = $('ideas-list')
  const empty = $('ideas-empty')

  const items = ideas.map(i => `
    <li class="idea-item" data-id="${esc(i.id)}">
      <span class="item-dot"></span>
      <span class="item-text">${esc(i.content)}</span>
      <button class="item-delete" data-id="${esc(i.id)}" aria-label="Delete">×</button>
    </li>
  `).join('')

  list.innerHTML = items
  if (!ideas.length) list.appendChild(empty)
  else empty.style.display = 'none'

  list.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.idea-item')
      li.classList.add('removing')
      setTimeout(() => {
        DB.deleteIdea(btn.dataset.id)
        renderIdeas()
      }, 190)
    })
  })
}

function setupIdeaInput() {
  const addBtn    = $('idea-add-btn')
  const inputRow  = $('idea-input-row')
  const input     = $('idea-input')
  const saveBtn   = $('idea-save-btn')
  const cancelBtn = $('idea-cancel-btn')

  function openInput() {
    inputRow.classList.remove('hidden')
    input.focus()
    addBtn.textContent = '−'
  }

  function closeInput() {
    inputRow.classList.add('hidden')
    input.value = ''
    addBtn.textContent = '+'
  }

  function save() {
    const val = input.value.trim()
    if (!val) return
    closeInput()
    DB.addIdea(val)
    renderIdeas()
  }

  addBtn.addEventListener('click', () => inputRow.classList.contains('hidden') ? openInput() : closeInput())
  saveBtn.addEventListener('click', save)
  cancelBtn.addEventListener('click', closeInput)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') closeInput() })
}

// ── Projects ─────────────────────────────────────────────────────
const STATUS_ORDER = ['tostart', 'inprogress', 'completed']

function renderProjects() {
  const projects = DB.getProjects()

  STATUS_ORDER.forEach(status => {
    const col   = $(`${status}-items`)
    const badge = $(`${status}-badge`)
    const group = projects.filter(p => p.status === status)

    badge.textContent = group.length

    col.innerHTML = group.map(p => {
      const canLeft  = STATUS_ORDER.indexOf(status) > 0
      const canRight = STATUS_ORDER.indexOf(status) < STATUS_ORDER.length - 1

      return `
        <div class="project-card" data-id="${esc(p.id)}">
          <div class="project-card-title">${esc(p.name)}</div>
          ${p.description ? `<div class="project-card-desc">${esc(p.description)}</div>` : ''}
          <div class="project-card-actions">
            ${canLeft  ? `<button class="btn btn-ghost proj-left"  data-id="${esc(p.id)}">← Move</button>` : ''}
            ${canRight ? `<button class="btn btn-ghost proj-right" data-id="${esc(p.id)}">Move →</button>` : ''}
            <button class="btn btn-danger proj-delete" data-id="${esc(p.id)}">Delete</button>
          </div>
        </div>
      `
    }).join('')

    col.querySelectorAll('.proj-left').forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) - 1]
        DB.updateProject(btn.dataset.id, { status: newStatus })
        renderProjects()
      })
    })

    col.querySelectorAll('.proj-right').forEach(btn => {
      btn.addEventListener('click', () => {
        const newStatus = STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]
        DB.updateProject(btn.dataset.id, { status: newStatus })
        renderProjects()
      })
    })

    col.querySelectorAll('.proj-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.project-card')
        card.classList.add('removing')
        setTimeout(() => {
          DB.deleteProject(btn.dataset.id)
          renderProjects()
        }, 190)
      })
    })
  })
}

function setupProjectForm() {
  const addBtn    = $('project-add-btn')
  const form      = $('project-form')
  const nameInput = $('project-name')
  const descInput = $('project-desc')
  const statusSel = $('project-status-select')
  const saveBtn   = $('project-save-btn')
  const cancelBtn = $('project-cancel-btn')

  function openForm() {
    form.classList.remove('hidden')
    nameInput.focus()
    addBtn.textContent = '− Cancel'
  }

  function closeForm() {
    form.classList.add('hidden')
    nameInput.value = ''
    descInput.value = ''
    statusSel.value = 'tostart'
    addBtn.textContent = '+ New Project'
  }

  function save() {
    const name = nameInput.value.trim()
    if (!name) { nameInput.focus(); return }
    closeForm()
    DB.addProject({ name, description: descInput.value.trim(), status: statusSel.value })
    renderProjects()
  }

  addBtn.addEventListener('click', () => form.classList.contains('hidden') ? openForm() : closeForm())
  saveBtn.addEventListener('click', save)
  cancelBtn.addEventListener('click', closeForm)
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') save() })
}

// ── Quote / Floater editor ───────────────────────────────────────
function renderQuoteCard() {
  const state   = DB.getFloaterState()
  const preview = $('quote-preview')
  preview.textContent = state.text || '(no statement set)'
  $('quote-text').value  = state.text
  $('quote-style').value = state.style || 'drift'
}

function setupQuoteCard() {
  const editBtn   = $('quote-edit-btn')
  const toggleBtn = $('quote-toggle-btn')
  const form      = $('quote-form')
  const controls  = $('quote-controls')
  const saveBtn   = $('quote-save-btn')
  const cancelBtn = $('quote-cancel-btn')
  const textArea  = $('quote-text')
  const styleSel  = $('quote-style')

  editBtn.addEventListener('click', () => {
    controls.classList.add('hidden')
    form.classList.remove('hidden')
    textArea.focus()
  })

  cancelBtn.addEventListener('click', () => {
    form.classList.add('hidden')
    controls.classList.remove('hidden')
    renderQuoteCard()
  })

  saveBtn.addEventListener('click', () => {
    const text  = textArea.value.trim()
    const style = styleSel.value
    Floater.setState({ text, visible: true, style })
    form.classList.add('hidden')
    controls.classList.remove('hidden')
    renderQuoteCard()
  })

  toggleBtn.addEventListener('click', () => {
    const state = DB.getFloaterState()
    Floater.setState({ ...state, visible: !state.visible })
    const label = state.visible ? 'Show' : 'Hide'
    toggleBtn.textContent = `${label} / ${state.visible ? 'Hide' : 'Show'}`
    setTimeout(() => { toggleBtn.textContent = 'Hide / Show' }, 1500)
  })
}

// ── Login ────────────────────────────────────────────────────────
function setupLogin() {
  const emailInput = $('login-email')
  const passInput  = $('login-password')
  const loginBtn   = $('login-btn')
  const btnText    = $('login-btn-text')
  const spinner    = $('login-spinner')
  const errorEl    = $('login-error')

  async function doLogin() {
    const email    = emailInput.value.trim()
    const password = passInput.value
    if (!email || !password) { errorEl.textContent = 'Please enter your email and password.'; return }

    btnText.classList.add('hidden')
    spinner.classList.remove('hidden')
    loginBtn.disabled = true
    errorEl.textContent = ''

    const { error } = await DB.signIn(email, password)

    btnText.classList.remove('hidden')
    spinner.classList.add('hidden')
    loginBtn.disabled = false

    if (error) {
      errorEl.textContent = error.message || 'Login failed. Check your credentials.'
    }
    // Auth state change listener handles showing the dashboard
  }

  loginBtn.addEventListener('click', doLogin)
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })

  $('signout-btn').addEventListener('click', async () => {
    await DB.signOut()
  })
}

// ── Dashboard init ───────────────────────────────────────────────
async function showDashboard() {
  $('login-modal').style.display = 'none'
  $('dashboard').classList.remove('hidden')

  // Pull fresh data from Supabase
  await DB.syncAll()

  // Render home page sections
  renderTasksPreview()
  renderIdeas()
  renderProjects()
  renderQuoteCard()

  // Start floater
  Floater.init()

  // Subscribe to realtime
  DB.subscribeAll({
    onTasksChange:    () => { renderTasksPreview(); window.renderCalendar?.() },
    onIdeasChange:    renderIdeas,
    onLearningChange: () => window.renderLearningPath?.(),
    onProjectsChange: renderProjects,
  })

  // Scroll reveal
  setupScrollReveal()

  // Date
  updateDate()

  // Page activation handler
  window._onPageActivate = pageId => {
    if (pageId === 'learning') window.renderLearningPath?.()
    if (pageId === 'calendar') window.renderCalendar?.()
  }

  // Start router (renders initial page, calls _onPageActivate)
  Router.init()
}

function showLogin() {
  $('login-modal').style.display = 'flex'
  $('dashboard').classList.add('hidden')
}

// ── Boot ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupLogin()
  setupTaskInput()
  setupIdeaInput()
  setupLearningPageInput()
  setupProjectForm()
  setupQuoteCard()
  ChatAgent.init()
  setupCalendarPage()
  CalendarAgent.init()

  window.onAuthChange = user => {
    if (user) showDashboard()
    else showLogin()
  }

  const user = await DB.init()
  if (user) {
    await showDashboard()
  } else {
    showLogin()
  }
})
