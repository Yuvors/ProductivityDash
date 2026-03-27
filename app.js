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

// ── Tasks ────────────────────────────────────────────────────────
function renderTasks() {
  const tasks = DB.getTasks()
  const list  = $('tasks-list')
  const badge = $('tasks-badge')
  const empty = $('tasks-empty')

  const pending = tasks.filter(t => !t.completed).length
  badge.textContent = pending

  const items = tasks.map(t => `
    <li class="task-item${t.completed ? ' done' : ''}" data-id="${esc(t.id)}">
      <button class="task-check" data-id="${esc(t.id)}" aria-label="Toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
      <span class="task-text">${esc(t.title)}</span>
      <button class="task-delete" data-id="${esc(t.id)}" aria-label="Delete">×</button>
    </li>
  `).join('')

  // Replace all except the empty-state li (keep it in DOM, toggle visibility)
  list.innerHTML = items
  if (!tasks.length) list.appendChild(empty)
  else empty.style.display = 'none'

  // Events
  list.querySelectorAll('.task-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const task = DB.getTasks().find(t => t.id === btn.dataset.id)
      if (!task) return
      DB.updateTask(btn.dataset.id, { completed: !task.completed })
      renderTasks()
    })
  })

  list.querySelectorAll('.task-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.task-item')
      li.classList.add('removing')
      setTimeout(() => {
        DB.deleteTask(btn.dataset.id)
        renderTasks()
      }, 190)
    })
  })
}

function setupTaskInput() {
  const input = $('task-input')
  const addBtn = $('task-add-btn')

  function add() {
    const val = input.value.trim()
    if (!val) return
    input.value = ''
    DB.addTask(val)
    renderTasks()
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

// ── Learning Path ────────────────────────────────────────────────
function renderLearning() {
  const items = DB.getLearningItems()
  const list  = $('learning-list')
  const empty = $('learning-empty')

  const html = items.map((l, idx) => `
    <li class="learning-item" data-id="${esc(l.id)}">
      <span class="step-num">${idx + 1}</span>
      <span class="item-text">${esc(l.topic)}</span>
      <div class="step-controls">
        <button class="step-btn step-up" data-id="${esc(l.id)}" title="Move up" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button class="step-btn step-down" data-id="${esc(l.id)}" title="Move down" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <button class="item-delete" data-id="${esc(l.id)}" aria-label="Delete">×</button>
    </li>
  `).join('')

  list.innerHTML = html
  if (!items.length) list.appendChild(empty)
  else empty.style.display = 'none'

  list.querySelectorAll('.step-up').forEach(btn => {
    btn.addEventListener('click', () => {
      DB.moveLearningItem(btn.dataset.id, 'up')
      renderLearning()
    })
  })

  list.querySelectorAll('.step-down').forEach(btn => {
    btn.addEventListener('click', () => {
      DB.moveLearningItem(btn.dataset.id, 'down')
      renderLearning()
    })
  })

  list.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.learning-item')
      li.classList.add('removing')
      setTimeout(() => {
        DB.deleteLearningItem(btn.dataset.id)
        renderLearning()
      }, 190)
    })
  })
}

function setupLearningInput() {
  const addBtn    = $('learning-add-btn')
  const inputRow  = $('learning-input-row')
  const input     = $('learning-input')
  const saveBtn   = $('learning-save-btn')
  const cancelBtn = $('learning-cancel-btn')

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
    DB.addLearningItem(val)
    renderLearning()
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

  // Render all sections
  renderTasks()
  renderIdeas()
  renderLearning()
  renderProjects()
  renderQuoteCard()

  // Start floater
  Floater.init()

  // Subscribe to realtime
  DB.subscribeAll({
    onTasksChange:    renderTasks,
    onIdeasChange:    renderIdeas,
    onLearningChange: renderLearning,
    onProjectsChange: renderProjects,
  })

  // Scroll reveal
  setupScrollReveal()

  // Date
  updateDate()
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
  setupLearningInput()
  setupProjectForm()
  setupQuoteCard()

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
