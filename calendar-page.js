// ── Calendar / Time Planner Page ─────────────────────────────────

;(() => {
  const CAL_START_HOUR = 6    // 6 AM
  const CAL_END_HOUR   = 23   // 11 PM
  const SLOT_MINUTES   = 30   // 30-min increments
  const SLOT_PX        = 48   // px per slot

  const COLOR_MAP = {
    teal:  '#00C9A7',
    cyan:  '#00B4D8',
    amber: '#FFB347',
    jade:  '#00D4AA',
    rose:  '#FF6B8A',
  }

  let _view       = 'tomorrow'
  let _weekOffset = 0
  let _nowTimer   = null

  // ── Date helpers ───────────────────────────────────────────────
  function _tomorrowStr() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }

  function _todayStr() {
    return new Date().toISOString().slice(0, 10)
  }

  function _getDateRange() {
    if (_view === 'tomorrow') return [_tomorrowStr()]

    // Week view: Mon–Sun of the week containing tomorrow, offset by _weekOffset weeks
    const base = new Date(_tomorrowStr() + 'T00:00:00')
    base.setDate(base.getDate() + _weekOffset * 7)
    const day = base.getDay()                     // 0=Sun…6=Sat
    const mon = new Date(base)
    mon.setDate(base.getDate() - ((day + 6) % 7)) // back to Monday

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon)
      d.setDate(mon.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }

  function _fmtDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const months   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${weekdays[dt.getDay()]} ${months[m - 1]} ${d}`
  }

  function _fmtTime(slotIdx) {
    const totalMin = CAL_START_HOUR * 60 + slotIdx * SLOT_MINUTES
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const ampm = h < 12 ? 'AM' : 'PM'
    const hh = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${hh} ${ampm}` : `${hh}:${String(m).padStart(2,'0')}`
  }

  function _slotTime(slotIdx) {
    const totalMin = CAL_START_HOUR * 60 + slotIdx * SLOT_MINUTES
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  }

  function _timeToSlot(timeStr) {
    if (!timeStr) return -1
    const [h, m] = timeStr.split(':').map(Number)
    return ((h - CAL_START_HOUR) * 60 + m) / SLOT_MINUTES
  }

  const TOTAL_SLOTS = ((CAL_END_HOUR - CAL_START_HOUR) * 60) / SLOT_MINUTES

  // ── Conflict detection ─────────────────────────────────────────
  function _conflictIds(tasks) {
    const conflicted = new Set()
    const byDate = {}
    for (const t of tasks) {
      if (!t.scheduled_date || !t.start_time) continue
      if (!byDate[t.scheduled_date]) byDate[t.scheduled_date] = []
      byDate[t.scheduled_date].push(t)
    }
    for (const dateStr of Object.keys(byDate)) {
      const day = byDate[dateStr]
      for (let i = 0; i < day.length; i++) {
        for (let j = i + 1; j < day.length; j++) {
          const a = day[i], b = day[j]
          const aStart = _timeToSlot(a.start_time)
          const aEnd   = aStart + (a.duration_minutes || 60) / SLOT_MINUTES
          const bStart = _timeToSlot(b.start_time)
          const bEnd   = bStart + (b.duration_minutes || 60) / SLOT_MINUTES
          if (aStart < bEnd && bStart < aEnd) {
            conflicted.add(a.id)
            conflicted.add(b.id)
          }
        }
      }
    }
    return conflicted
  }

  // ── Drag state ─────────────────────────────────────────────────
  let _dragId       = null
  let _dragDuration = 60

  // ── Build task block element ───────────────────────────────────
  function _buildTaskBlock(task, conflicted) {
    const div = document.createElement('div')
    div.className = [
      'task-block',
      `task-block--${task.color || 'teal'}`,
      task.completed ? 'completed' : '',
      conflicted.has(task.id) ? 'task-block--conflict' : '',
    ].filter(Boolean).join(' ')
    div.draggable = true
    div.dataset.id = task.id

    const slotH = (task.duration_minutes || 60) / SLOT_MINUTES * SLOT_PX
    div.style.height = `${slotH}px`

    div.innerHTML = `
      <div class="block-time">${task.start_time || ''}</div>
      <div class="block-title">${_esc(task.title)}</div>
      ${task.description ? `<div class="block-desc">${_esc(task.description)}</div>` : ''}
      <div class="block-resize-handle"></div>
      <button class="block-done-btn" title="Mark done">✓</button>
      <button class="block-delete-btn" title="Delete">×</button>
    `

    // Drag start
    div.addEventListener('dragstart', e => {
      _dragId       = task.id
      _dragDuration = task.duration_minutes || 60
      e.dataTransfer.setData('taskId', task.id)
      e.dataTransfer.effectAllowed = 'move'
      setTimeout(() => div.style.opacity = '0.4', 0)
    })
    div.addEventListener('dragend', () => { div.style.opacity = '' })

    // Done button
    div.querySelector('.block-done-btn').addEventListener('click', e => {
      e.stopPropagation()
      DB.updateTask(task.id, { completed: !task.completed })
      window.renderCalendar()
      window.renderTasksPreview?.()
    })

    // Delete button
    div.querySelector('.block-delete-btn').addEventListener('click', e => {
      e.stopPropagation()
      div.style.opacity = '0'
      setTimeout(() => {
        DB.deleteTask(task.id)
        window.renderCalendar()
        window.renderTasksPreview?.()
      }, 150)
    })

    // Resize handle
    _attachResize(div, task)

    return div
  }

  function _attachResize(div, task) {
    const handle = div.querySelector('.block-resize-handle')
    if (!handle) return
    let startY = 0, origDur = 0

    handle.addEventListener('mousedown', e => {
      e.preventDefault()
      e.stopPropagation()
      startY  = e.clientY
      origDur = task.duration_minutes || 60

      function onMove(ev) {
        const delta      = ev.clientY - startY
        const newDur     = Math.max(30, Math.round((origDur + delta / SLOT_PX * SLOT_MINUTES) / 30) * 30)
        div.style.height = `${newDur / SLOT_MINUTES * SLOT_PX}px`
      }
      function onUp(ev) {
        const delta  = ev.clientY - startY
        const newDur = Math.max(30, Math.round((origDur + delta / SLOT_PX * SLOT_MINUTES) / 30) * 30)
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        DB.updateTask(task.id, { duration_minutes: newDur })
        window.renderCalendar()
      }
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  // ── Build time grid ────────────────────────────────────────────
  function _buildGrid(dates, tasks) {
    const grid = document.getElementById('cal-grid')
    if (!grid) return
    grid.innerHTML = ''

    const today   = _todayStr()
    const ncols   = dates.length
    grid.style.gridTemplateColumns = `56px repeat(${ncols}, 1fr)`

    const conflicted = _conflictIds(tasks)

    // Header row: empty corner + day labels
    const corner = document.createElement('div')
    corner.className = 'cal-day-header cal-corner'
    grid.appendChild(corner)

    dates.forEach(d => {
      const hdr = document.createElement('div')
      hdr.className = 'cal-day-header' + (d === today ? ' today' : '')
      hdr.dataset.date = d
      hdr.textContent = _fmtDateLabel(d)
      grid.appendChild(hdr)
    })

    // Time rows
    for (let s = 0; s < TOTAL_SLOTS; s++) {
      // Time label (left col)
      const label = document.createElement('div')
      label.className = 'cal-time-label'
      label.textContent = s % 2 === 0 ? _fmtTime(s) : ''
      grid.appendChild(label)

      // Slot cells per date
      dates.forEach(dateStr => {
        const cell = document.createElement('div')
        cell.className = 'cal-slot'
        cell.dataset.date = dateStr
        cell.dataset.time = _slotTime(s)

        // Drop target
        cell.addEventListener('dragover', e => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          cell.classList.add('drag-over')
        })
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'))
        cell.addEventListener('drop', e => {
          e.preventDefault()
          cell.classList.remove('drag-over')
          const taskId = e.dataTransfer.getData('taskId') || _dragId
          if (!taskId) return
          DB.scheduleTask(taskId, {
            scheduled_date: cell.dataset.date,
            start_time:     cell.dataset.time,
            duration_minutes: _dragDuration,
          })
          window.renderCalendar()
          window.renderTasksPreview?.()
        })

        grid.appendChild(cell)
      })
    }

    // Place task blocks over cells
    _placeBlocks(tasks, grid, dates, conflicted)

    // Current time line (week view, today visible)
    if (_view === 'week' && dates.includes(today)) {
      _drawNowLine(grid, today, dates)
    }
  }

  function _placeBlocks(tasks, grid, dates, conflicted) {
    for (const task of tasks) {
      if (!task.scheduled_date || !task.start_time) continue
      const dateIdx = dates.indexOf(task.scheduled_date)
      if (dateIdx < 0) continue

      const slotIdx = _timeToSlot(task.start_time)
      if (slotIdx < 0 || slotIdx >= TOTAL_SLOTS) continue

      // Find the matching cell: row = slotIdx + 1 (header row is first), col = dateIdx + 2 (label col)
      // We query by data attributes for simplicity
      const cell = grid.querySelector(`.cal-slot[data-date="${task.scheduled_date}"][data-time="${task.start_time}"]`)
      if (!cell) continue

      cell.style.position = 'relative'
      const block = _buildTaskBlock(task, conflicted)
      block.style.position = 'absolute'
      block.style.top  = '2px'
      block.style.left = '2px'
      block.style.right = '2px'
      block.style.height = `${(task.duration_minutes || 60) / SLOT_MINUTES * SLOT_PX - 4}px`
      block.style.zIndex = '2'
      cell.appendChild(block)
    }
  }

  // ── Current time line ──────────────────────────────────────────
  function _drawNowLine(grid, today, dates) {
    if (_nowTimer) clearInterval(_nowTimer)

    function _update() {
      grid.querySelectorAll('.time-now-line').forEach(el => el.remove())
      const now      = new Date()
      const minFromStart = (now.getHours() - CAL_START_HOUR) * 60 + now.getMinutes()
      if (minFromStart < 0 || minFromStart > (CAL_END_HOUR - CAL_START_HOUR) * 60) return

      const yPx    = minFromStart / SLOT_MINUTES * SLOT_PX
      const dayHdr = grid.querySelector(`.cal-day-header[data-date="${today}"]`)
      if (!dayHdr) return

      // Find the column index
      const dateIdx = dates.indexOf(today)
      const line    = document.createElement('div')
      line.className = 'time-now-line'

      // Position relative to grid
      const gridRect  = grid.getBoundingClientRect()
      const hdrRect   = dayHdr.getBoundingClientRect()
      const colLeft   = hdrRect.left - gridRect.left + grid.scrollLeft
      const colWidth  = hdrRect.width

      // rowHeight of header = ~36px; slots start at ~36px top
      const headerH = dayHdr.offsetHeight || 36
      line.style.position = 'absolute'
      line.style.top      = `${headerH + yPx}px`
      line.style.left     = `${colLeft}px`
      line.style.width    = `${colWidth}px`
      grid.style.position = 'relative'
      grid.appendChild(line)
    }

    _update()
    _nowTimer = setInterval(_update, 60000)
  }

  // ── Render pool ────────────────────────────────────────────────
  function _renderPool(tasks) {
    const pool  = document.getElementById('cal-pool-items')
    const badge = document.getElementById('cal-pool-badge')
    if (!pool) return

    const unscheduled = tasks.filter(t => !t.scheduled_date && !t.completed)
    if (badge) badge.textContent = unscheduled.length

    pool.innerHTML = ''
    unscheduled.forEach(task => {
      const chip = document.createElement('div')
      chip.className = `pool-chip chip-${task.color || 'teal'}`
      chip.draggable = true
      chip.dataset.id = task.id
      chip.innerHTML = `
        <span class="chip-dot"></span>
        <span class="chip-label">${_esc(task.title)}</span>
        <button class="chip-delete" title="Delete">×</button>
      `

      chip.addEventListener('dragstart', e => {
        _dragId       = task.id
        _dragDuration = task.duration_minutes || 60
        e.dataTransfer.setData('taskId', task.id)
        e.dataTransfer.effectAllowed = 'move'
        setTimeout(() => chip.style.opacity = '0.4', 0)
      })
      chip.addEventListener('dragend', () => { chip.style.opacity = '' })

      chip.querySelector('.chip-delete').addEventListener('click', e => {
        e.stopPropagation()
        DB.deleteTask(task.id)
        window.renderCalendar()
        window.renderTasksPreview?.()
      })

      pool.appendChild(chip)
    })

    // Pool is a drop target (unschedule)
    pool.addEventListener('dragover', e => { e.preventDefault(); pool.classList.add('drag-over') })
    pool.addEventListener('dragleave', () => pool.classList.remove('drag-over'))
    pool.addEventListener('drop', e => {
      e.preventDefault()
      pool.classList.remove('drag-over')
      const taskId = e.dataTransfer.getData('taskId') || _dragId
      if (taskId) {
        DB.unscheduleTask(taskId)
        window.renderCalendar()
        window.renderTasksPreview?.()
      }
    })
  }

  // ── Main render ────────────────────────────────────────────────
  window.renderCalendar = function () {
    const tasks = DB.getTasks()
    const dates = _getDateRange()

    // Update view tabs
    document.querySelectorAll('.cal-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === _view)
    })

    // Show/hide week nav
    const weekNav = document.getElementById('cal-week-nav')
    if (weekNav) weekNav.classList.toggle('hidden', _view === 'tomorrow')

    // Update week label
    if (_view === 'week') {
      const label = document.getElementById('cal-week-label')
      if (label) {
        const first = _fmtDateLabel(dates[0]).replace(/\w+ /, '')
        const last  = _fmtDateLabel(dates[6]).replace(/\w+ /, '')
        label.textContent = `${first} – ${last}`
      }
    }

    _renderPool(tasks)
    _buildGrid(dates, tasks.filter(t => t.scheduled_date))
  }

  // ── Page setup (called from app.js DOMContentLoaded) ──────────
  window.setupCalendarPage = function () {
    // View tabs
    document.querySelectorAll('.cal-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _view = btn.dataset.view
        window.renderCalendar()
      })
    })

    // Week navigation
    document.getElementById('cal-prev-week')?.addEventListener('click', () => {
      _weekOffset--
      window.renderCalendar()
    })
    document.getElementById('cal-next-week')?.addEventListener('click', () => {
      _weekOffset++
      window.renderCalendar()
    })

    // + Task button toggles form
    const addBtn  = document.getElementById('cal-add-btn')
    const form    = document.getElementById('cal-task-form')
    const titleIn = document.getElementById('cal-title')

    addBtn?.addEventListener('click', () => {
      const hidden = form?.classList.contains('hidden')
      form?.classList.toggle('hidden', !hidden)
      if (hidden) {
        // Pre-fill date with tomorrow
        const dateIn = document.getElementById('cal-sched-date')
        if (dateIn && !dateIn.value) dateIn.value = _tomorrowStr()
        titleIn?.focus()
      }
    })

    // Color swatches
    let _selectedColor = 'teal'
    document.getElementById('cal-color-picker')?.addEventListener('click', e => {
      const sw = e.target.closest('.color-swatch')
      if (!sw) return
      document.querySelectorAll('#cal-color-picker .color-swatch').forEach(s => s.classList.remove('active'))
      sw.classList.add('active')
      _selectedColor = sw.dataset.color
    })

    // Form save
    document.getElementById('cal-form-save')?.addEventListener('click', async () => {
      const title = document.getElementById('cal-title')?.value.trim()
      if (!title) { document.getElementById('cal-title')?.focus(); return }

      const desc     = document.getElementById('cal-desc')?.value.trim() || null
      const date     = document.getElementById('cal-sched-date')?.value || null
      const time     = document.getElementById('cal-sched-time')?.value || null
      const duration = parseInt(document.getElementById('cal-duration')?.value || '60', 10)

      const task = await DB.addTask(title, desc, _selectedColor)
      if (date && time) {
        await DB.scheduleTask(task.id, { scheduled_date: date, start_time: time, duration_minutes: duration })
      }

      // Reset form
      document.getElementById('cal-title').value = ''
      document.getElementById('cal-desc').value  = ''
      document.getElementById('cal-sched-time').value = ''
      form?.classList.add('hidden')

      window.renderCalendar()
      window.renderTasksPreview?.()
    })

    // Form cancel + Escape
    document.getElementById('cal-form-cancel')?.addEventListener('click', () => form?.classList.add('hidden'))
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') form?.classList.add('hidden')
    })
  }

  // ── Escape helper ──────────────────────────────────────────────
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
})()
