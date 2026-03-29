// ── Calendar Schedule Assistant Agent ────────────────────────────
window.CalendarAgent = (() => {
  const API_URL    = 'https://api.anthropic.com/v1/messages'
  const MODEL      = 'claude-sonnet-4-6'
  const MAX_TOKENS = 2048

  function _buildSystem() {
    const today    = new Date()
    const tmrw     = new Date(today)
    tmrw.setDate(today.getDate() + 1)
    const fmt = d => d.toISOString().slice(0, 10)
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

    return `You are an expert time management coach helping the user schedule and organize their tasks.

Current date: ${fmt(today)} (${days[today.getDay()]})
Tomorrow: ${fmt(tmrw)} (${days[tmrw.getDay()]})

You have tools to read and manage the user's task schedule directly.

Guidelines:
- Always call get_schedule first before making any scheduling decisions
- Schedule deep work / focus tasks in the morning (8–11 AM), meetings in the afternoon (1–4 PM), admin/personal in the evening
- Avoid scheduling more than 6 hours of tasks per day — leave buffer time
- Keep duration realistic: 30 min for quick tasks, 60–90 min for focused work, 30 min for meetings
- Use color coding: teal=work, cyan=focus/deep-work, amber=meetings, jade=health, rose=personal
- When the user says "plan tomorrow" or "schedule my day": call get_schedule, then use schedule_task or reschedule_bulk to assign times
- When creating new tasks via create_task, include a color and duration that match the task type
- Be concise and direct — briefly summarize what you scheduled and why`
  }

  const TOOLS = [
    {
      name: 'get_schedule',
      description: 'Returns all tasks (scheduled and unscheduled) with their full details including scheduled_date, start_time, duration_minutes, color, and completed status.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'create_task',
      description: 'Creates a new task and optionally schedules it. Use this when the user wants to add a task to their list.',
      input_schema: {
        type: 'object',
        properties: {
          title:            { type: 'string', description: 'Task title (required)' },
          description:      { type: 'string', description: 'Optional details' },
          color:            { type: 'string', enum: ['teal','cyan','amber','jade','rose'], description: 'teal=work, cyan=focus, amber=meeting, jade=health, rose=personal' },
          scheduled_date:   { type: 'string', description: 'YYYY-MM-DD, omit to leave unscheduled' },
          start_time:       { type: 'string', description: 'HH:MM (24h), omit to leave unscheduled' },
          duration_minutes: { type: 'number', description: 'Duration in minutes, default 60' },
        },
        required: ['title']
      }
    },
    {
      name: 'schedule_task',
      description: 'Schedules an existing task to a specific date and time. Use task IDs from get_schedule.',
      input_schema: {
        type: 'object',
        properties: {
          id:               { type: 'string', description: 'Task ID from get_schedule' },
          scheduled_date:   { type: 'string', description: 'YYYY-MM-DD' },
          start_time:       { type: 'string', description: 'HH:MM (24h)' },
          duration_minutes: { type: 'number', description: 'Duration in minutes' },
        },
        required: ['id', 'scheduled_date', 'start_time']
      }
    },
    {
      name: 'reschedule_bulk',
      description: 'Schedules multiple tasks at once. More efficient than calling schedule_task repeatedly.',
      input_schema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            description: 'Array of schedule assignments',
            items: {
              type: 'object',
              properties: {
                id:               { type: 'string' },
                scheduled_date:   { type: 'string' },
                start_time:       { type: 'string' },
                duration_minutes: { type: 'number' },
              },
              required: ['id', 'scheduled_date', 'start_time']
            }
          }
        },
        required: ['tasks']
      }
    },
    {
      name: 'complete_task',
      description: 'Marks a task as completed.',
      input_schema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Task ID' } },
        required: ['id']
      }
    }
  ]

  let _msgs = []

  // ── Tool executor ──────────────────────────────────────────────
  async function _exec(name, input) {
    if (name === 'get_schedule') {
      const tasks = DB.getTasks()
      if (!tasks.length) return 'No tasks yet.'
      return JSON.stringify(tasks.map(t => ({
        id: t.id, title: t.title, description: t.description || null,
        color: t.color || 'teal', completed: t.completed,
        scheduled_date: t.scheduled_date || null,
        start_time: t.start_time || null,
        duration_minutes: t.duration_minutes || 60,
      })))
    }

    if (name === 'create_task') {
      const task = await DB.addTask(
        String(input.title || '').trim(),
        input.description ? String(input.description).trim() : null,
        input.color || 'teal'
      )
      if (input.scheduled_date && input.start_time) {
        await DB.scheduleTask(task.id, {
          scheduled_date:   input.scheduled_date,
          start_time:       input.start_time,
          duration_minutes: input.duration_minutes || 60,
        })
      }
      window.renderCalendar?.()
      window.renderTasksPreview?.()
      return `Created task "${task.title}" (id: ${task.id})${input.scheduled_date ? ` scheduled for ${input.scheduled_date} at ${input.start_time}` : ' (unscheduled)'}.`
    }

    if (name === 'schedule_task') {
      await DB.scheduleTask(input.id, {
        scheduled_date:   input.scheduled_date,
        start_time:       input.start_time,
        duration_minutes: input.duration_minutes || 60,
      })
      window.renderCalendar?.()
      window.renderTasksPreview?.()
      return `Scheduled task ${input.id} on ${input.scheduled_date} at ${input.start_time}.`
    }

    if (name === 'reschedule_bulk') {
      const tasks = Array.isArray(input.tasks) ? input.tasks : []
      for (const t of tasks) {
        await DB.scheduleTask(t.id, {
          scheduled_date:   t.scheduled_date,
          start_time:       t.start_time,
          duration_minutes: t.duration_minutes || 60,
        })
      }
      window.renderCalendar?.()
      window.renderTasksPreview?.()
      return `Scheduled ${tasks.length} task(s).`
    }

    if (name === 'complete_task') {
      await DB.updateTask(input.id, { completed: true })
      window.renderCalendar?.()
      window.renderTasksPreview?.()
      return `Marked task ${input.id} as complete.`
    }

    return `Unknown tool: ${name}`
  }

  // ── Minimal markdown → HTML ────────────────────────────────────
  function _md(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
  }

  // ── UI helpers ─────────────────────────────────────────────────
  function _append(role, html) {
    const msgs = document.getElementById('cal-chat-messages')
    if (!msgs) return
    const div = document.createElement('div')
    div.className = `chat-msg chat-msg--${role}`
    div.innerHTML = html
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  function _appendTool(name) {
    const labels = {
      get_schedule:    'Reading schedule…',
      create_task:     'Creating task…',
      schedule_task:   'Scheduling task…',
      reschedule_bulk: 'Scheduling tasks…',
      complete_task:   'Completing task…',
    }
    _append('tool', labels[name] || `Using ${name}…`)
  }

  function _setThinking(on) {
    document.getElementById('cal-chat-thinking')?.classList.toggle('hidden', !on)
    const btn = document.getElementById('cal-chat-send')
    if (btn) btn.disabled = on
  }

  // ── Agent loop ─────────────────────────────────────────────────
  async function _loop() {
    for (;;) {
      const resp = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key':    DB.getApiKey(),
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL, max_tokens: MAX_TOKENS,
          system: _buildSystem(),
          tools: TOOLS, messages: _msgs
        })
      })

      if (!resp.ok) {
        const body = await resp.text()
        throw new Error(`API ${resp.status}: ${body}`)
      }

      const data = await resp.json()
      _msgs.push({ role: 'assistant', content: data.content })

      if (data.stop_reason === 'end_turn') {
        const txt = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        if (txt.trim()) _append('assistant', _md(txt))
        break
      }

      if (data.stop_reason === 'tool_use') {
        const results = []
        for (const blk of data.content) {
          if (blk.type === 'text' && blk.text.trim()) _append('assistant', _md(blk.text))
          if (blk.type === 'tool_use') {
            _appendTool(blk.name)
            const result = await _exec(blk.name, blk.input)
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: result })
          }
        }
        _msgs.push({ role: 'user', content: results })
        continue
      }

      break
    }
  }

  // ── Public: send message ───────────────────────────────────────
  async function sendMessage(text) {
    const val = text.trim()
    if (!val) return
    _msgs.push({ role: 'user', content: val })
    _append('user', _md(val))
    _setThinking(true)
    try {
      await _loop()
    } catch (err) {
      _append('error', `Error: ${_md(err.message)}`)
    } finally {
      _setThinking(false)
    }
  }

  // ── Chat input setup ───────────────────────────────────────────
  function _setupInput() {
    const input   = document.getElementById('cal-chat-input')
    const sendBtn = document.getElementById('cal-chat-send')
    if (!input) return

    function submit() {
      const val = input.value.trim()
      if (!val) return
      if (!DB.getApiKey()) {
        document.getElementById('api-key-overlay')?.classList.remove('hidden')
        return
      }
      input.value = ''
      input.style.height = 'auto'
      sendMessage(val)
    }

    sendBtn?.addEventListener('click', submit)
    input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit() }
    })

    document.getElementById('cal-propose-tomorrow')?.addEventListener('click', () => {
      input.value = 'Plan my tomorrow — look at my unscheduled tasks and schedule them for optimal productivity.'
      input.focus()
    })
    document.getElementById('cal-propose-week')?.addEventListener('click', () => {
      input.value = 'Optimize my week — review all my tasks and create an efficient schedule across the week.'
      input.focus()
    })

    // API key button opens shared overlay
    document.getElementById('cal-api-key-btn')?.addEventListener('click', () => {
      const overlay = document.getElementById('api-key-overlay')
      const keyInput = document.getElementById('api-key-input')
      if (keyInput) keyInput.value = DB.getApiKey()
      overlay?.classList.remove('hidden')
    })
  }

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    _setupInput()
  }

  return { init, sendMessage }
})()
