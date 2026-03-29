// ── Learning Path Page — Visual Milestone Map ────────────────────

// ── Layout constants ─────────────────────────────────────────────
const LP_COLS       = 4
const LP_NODE_SIZE  = 54      // px — diameter of milestone circle
const LP_NODE_R     = LP_NODE_SIZE / 2
const LP_ROW_H      = 180     // px — vertical distance between rows
const LP_Y_START    = 60      // px — top padding before first row
const LP_PAD_BOT    = 80      // px — bottom padding
const LP_X_PCTS     = [10, 36.5, 63, 89.5] // x% per column (left→right)

// ── HTML escape helper ───────────────────────────────────────────
function _lpEsc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── Position calculator ──────────────────────────────────────────
function _calcPositions(n) {
  const rows   = Math.max(1, Math.ceil(n / LP_COLS))
  const height = LP_Y_START + rows * LP_ROW_H + LP_PAD_BOT
  const pos    = Array.from({ length: n }, (_, i) => {
    const row  = Math.floor(i / LP_COLS)
    const col  = i % LP_COLS
    const xPct = row % 2 === 0 ? LP_X_PCTS[col] : LP_X_PCTS[LP_COLS - 1 - col]
    const y    = LP_Y_START + row * LP_ROW_H
    return { xPct, y, row }
  })
  return { height, pos }
}

// ── SVG path builder ─────────────────────────────────────────────
// viewBox: "0 0 100 {height}" — x is 0-100 (%), y is px matching container height
// vector-effect="non-scaling-stroke" keeps stroke width in screen pixels
function _buildSVG(pos, items, height) {
  if (pos.length < 2) return `<svg style="position:absolute;inset:0;width:100%;height:${height}px;pointer-events:none;z-index:0"></svg>`

  let segs = ''
  for (let i = 0; i < pos.length - 1; i++) {
    const p1    = pos[i]
    const p2    = pos[i + 1]
    const cy    = LP_NODE_R           // y offset to circle center within the node
    const x1    = p1.xPct
    const y1    = p1.y + cy
    const x2    = p2.xPct
    const y2    = p2.y + cy
    const done  = items[i].status === 'done'
    const color = done ? '#00F5C4' : '#2A3045'
    const dash  = done ? '' : ' stroke-dasharray="6 5"'
    segs += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
      stroke="${color}" stroke-width="3" stroke-linecap="round"
      vector-effect="non-scaling-stroke"${dash}/>\n`
  }

  return `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none"
    style="position:absolute;inset:0;width:100%;height:${height}px;pointer-events:none;z-index:0">
    ${segs}
  </svg>`
}

// ── Milestone HTML ───────────────────────────────────────────────
function _buildMilestone(item, idx, p) {
  const sc  = `milestone--${item.status}`
  const lft = `calc(${p.xPct}% - ${LP_NODE_R}px)`
  const top = `${p.y}px`
  return `
    <div class="milestone ${sc}" data-id="${_lpEsc(item.id)}" data-idx="${idx}"
         style="left:${lft};top:${top};--ni:${idx}" tabindex="0" role="button">
      <div class="milestone-pin">
        <span class="milestone-num">${idx + 1}</span>
        <svg class="milestone-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="milestone-label">${_lpEsc(item.topic)}</div>
    </div>`
}

// ── Shared popup ─────────────────────────────────────────────────
let _openPopupId = null

function _closePopup() {
  const p = document.getElementById('milestone-popup')
  if (p) p.classList.add('hidden')
  _openPopupId = null
}

function _showPopup(item, idx, total, anchorEl) {
  const popup = document.getElementById('milestone-popup')
  if (!popup) return

  const labels = { todo: 'To Do', current: 'Current ▶', done: 'Done ✓' }
  const statusBadge = `<span class="popup-status-badge popup-status-${item.status}">${labels[item.status] || 'To Do'}</span>`

  const acts = [
    item.status !== 'done'    && `<button class="btn btn-primary btn-sm popup-btn" data-action="mark-done"   data-id="${_lpEsc(item.id)}">✓ Mark Done</button>`,
    item.status !== 'current' && `<button class="btn btn-ghost   btn-sm popup-btn" data-action="set-current" data-id="${_lpEsc(item.id)}">▶ Set Current</button>`,
    item.status !== 'todo'    && `<button class="btn btn-ghost   btn-sm popup-btn" data-action="mark-todo"   data-id="${_lpEsc(item.id)}">↺ Reset</button>`,
  ].filter(Boolean).join('')

  const reorder = `
    <div class="popup-reorder">
      <button class="btn btn-ghost btn-sm popup-btn" data-action="move-up"   data-id="${_lpEsc(item.id)}" ${idx === 0 ? 'disabled' : ''}>▲</button>
      <button class="btn btn-ghost btn-sm popup-btn" data-action="move-down" data-id="${_lpEsc(item.id)}" ${idx === total - 1 ? 'disabled' : ''}>▼</button>
      <button class="btn btn-danger  btn-sm popup-btn" data-action="delete"   data-id="${_lpEsc(item.id)}">× Delete</button>
    </div>`

  popup.innerHTML = `
    <div class="popup-topic">${_lpEsc(item.topic)}</div>
    ${statusBadge}
    <div class="popup-acts">${acts}</div>
    ${reorder}`

  popup.querySelectorAll('.popup-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      _handleAction(btn.dataset.action, btn.dataset.id)
    })
  })

  // Position via fixed coords from anchor bounding rect
  const rect = anchorEl.querySelector('.milestone-pin').getBoundingClientRect()
  const pw = 230
  let left = rect.left + rect.width / 2 - pw / 2
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8))
  let top = rect.bottom + 8
  // Flip above if near bottom
  if (top + 190 > window.innerHeight) top = rect.top - 190

  popup.style.left = `${left}px`
  popup.style.top  = `${top}px`
  popup.classList.remove('hidden')
  _openPopupId = item.id
}

// ── Action handler ───────────────────────────────────────────────
async function _handleAction(action, id) {
  _closePopup()
  if (action === 'mark-done') {
    await DB.updateLearningStatus(id, 'done')
    // Auto-advance: set next todo to current
    const items = DB.getLearningItems()
    const idx = items.findIndex(i => i.id === id)
    const next = items.slice(idx + 1).find(i => i.status === 'todo')
    if (next) await DB.updateLearningStatus(next.id, 'current')
  } else if (action === 'set-current') {
    const items = DB.getLearningItems()
    for (const item of items) {
      if (item.status === 'current') await DB.updateLearningStatus(item.id, 'todo')
    }
    await DB.updateLearningStatus(id, 'current')
  } else if (action === 'mark-todo') {
    await DB.updateLearningStatus(id, 'todo')
  } else if (action === 'move-up') {
    await DB.moveLearningItem(id, 'up')
  } else if (action === 'move-down') {
    await DB.moveLearningItem(id, 'down')
  } else if (action === 'delete') {
    await DB.deleteLearningItem(id)
  }
  renderLearningPath()
}

// ── Progress bar ─────────────────────────────────────────────────
function _updateProgress(items) {
  const fill = document.getElementById('lp-progress-fill')
  const text = document.getElementById('lp-progress-text')
  if (!fill || !text) return
  const done  = items.filter(i => i.status === 'done').length
  const total = items.length
  const pct   = total > 0 ? Math.round(done / total * 100) : 0
  fill.style.width    = `${pct}%`
  text.textContent    = total > 0 ? `${done} / ${total} steps completed` : 'No steps yet'
}

// ── Main render (global, called by app.js + chat agent) ──────────
window.renderLearningPath = function renderLearningPath() {
  const items = DB.getLearningItems()
  const map   = document.getElementById('learning-path-map')
  if (!map) return

  _updateProgress(items)
  _closePopup()

  if (!items.length) {
    map.style.height = '300px'
    map.innerHTML = `
      <div class="lp-empty">
        <div class="lp-empty-icon">🗺️</div>
        <p>Your path is empty</p>
        <small>Ask the AI tutor to design a curriculum, or add steps manually</small>
      </div>`
    return
  }

  const { height, pos } = _calcPositions(items.length)
  map.style.height = `${height}px`
  map.innerHTML    = _buildSVG(pos, items, height) +
                     items.map((item, i) => _buildMilestone(item, i, pos[i])).join('')

  map.querySelectorAll('.milestone').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation()
      const id    = el.dataset.id
      const all   = DB.getLearningItems()
      const idx   = all.findIndex(i => i.id === id)
      if (idx === -1) return
      if (_openPopupId === id) { _closePopup(); return }
      _showPopup(all[idx], idx, all.length, el)
    })
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        el.click()
      }
    })
  })
}

// ── Add step input ───────────────────────────────────────────────
function setupLearningPageInput() {
  const addBtn    = document.getElementById('lp-add-btn')
  const inputRow  = document.getElementById('lp-add-row')
  const input     = document.getElementById('lp-input')
  const saveBtn   = document.getElementById('lp-save-btn')
  const cancelBtn = document.getElementById('lp-cancel-btn')
  if (!addBtn) return

  function openInput() {
    inputRow.classList.remove('hidden')
    input.focus()
    addBtn.textContent = '−'
  }
  function closeInput() {
    inputRow.classList.add('hidden')
    input.value = ''
    addBtn.textContent = '+ Step'
  }
  async function save() {
    const val = input.value.trim()
    if (!val) return
    closeInput()
    await DB.addLearningItem(val)
    renderLearningPath()
  }

  addBtn.addEventListener('click', () => inputRow.classList.contains('hidden') ? openInput() : closeInput())
  saveBtn.addEventListener('click', save)
  cancelBtn.addEventListener('click', closeInput)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') closeInput()
  })
}

// ── Close popup on outside click ─────────────────────────────────
document.addEventListener('click', e => {
  if (!e.target.closest('.milestone') && !e.target.closest('#milestone-popup')) {
    _closePopup()
  }
})
