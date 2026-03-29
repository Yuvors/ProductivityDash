// ── Claude Code Tutor Chat Agent ─────────────────────────────────
window.ChatAgent = (() => {
  const API_URL   = 'https://api.anthropic.com/v1/messages'
  const MODEL     = 'claude-sonnet-4-6'
  const MAX_TOKENS = 2048

  const SYSTEM = `You are an expert Claude Code teacher helping a developer build their personal learning path for mastering Claude Code — Anthropic's AI-powered CLI tool for developers.

Claude Code is a CLI tool that lets developers use Claude AI directly from their terminal: editing files, running commands, writing code, managing projects, and more.

A well-structured Claude Code learning path typically progresses through:
1. Installation & initial setup
2. Basic prompting — asking Claude to do simple tasks
3. File editing and multi-file code workflows
4. Slash commands (/help, /clear, /compact, /memory, etc.)
5. Context management and CLAUDE.md project files
6. Custom slash commands and project-level instructions
7. Hooks — pre/post-tool automation scripts
8. Memory system — persistent context across sessions
9. Multi-agent workflows — spawning subagents
10. MCP (Model Context Protocol) servers
11. Advanced settings and customization

You have tools to directly manage the user's learning path steps in their dashboard. Use them to make changes.

Guidelines:
- Always call get_current_steps before proposing a replace_all_steps, so you know what exists
- Keep step names concise (under 70 chars) and action-oriented
- Be conversational and encouraging — you are a tutor
- When replacing all steps, briefly explain the new structure
- If the user says "build my path", "design a curriculum", or similar: call get_current_steps first, then use replace_all_steps to set a complete, ordered curriculum`

  const TOOLS = [
    {
      name: 'get_current_steps',
      description: 'Returns the current ordered list of learning path steps with their statuses.',
      input_schema: { type: 'object', properties: {}, required: [] }
    },
    {
      name: 'add_steps',
      description: 'Appends one or more new steps to the end of the learning path.',
      input_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' }, description: 'Ordered array of step topic strings to add' }
        },
        required: ['steps']
      }
    },
    {
      name: 'replace_all_steps',
      description: 'Replaces the entire learning path with a new ordered list. Use for complete curriculum proposals.',
      input_schema: {
        type: 'object',
        properties: {
          steps: { type: 'array', items: { type: 'string' } }
        },
        required: ['steps']
      }
    },
    {
      name: 'clear_steps',
      description: 'Removes all steps from the learning path.',
      input_schema: { type: 'object', properties: {}, required: [] }
    }
  ]

  let _msgs = []  // conversation history

  // ── Tool executor ─────────────────────────────────────────────
  async function _exec(name, input) {
    if (name === 'get_current_steps') {
      const items = DB.getLearningItems()
      if (!items.length) return 'The learning path is currently empty.'
      return JSON.stringify(items.map((it, i) => ({ position: i + 1, topic: it.topic, status: it.status || 'todo' })))
    }
    if (name === 'add_steps') {
      const steps = Array.isArray(input.steps) ? input.steps : []
      for (const topic of steps) await DB.addLearningItem(String(topic).trim())
      window.renderLearningPath?.()
      return `Added ${steps.length} step(s).`
    }
    if (name === 'replace_all_steps') {
      const steps = Array.isArray(input.steps) ? input.steps : []
      await DB.replaceLearningItems(steps)
      window.renderLearningPath?.()
      return `Replaced learning path with ${steps.length} step(s).`
    }
    if (name === 'clear_steps') {
      await DB.clearLearningItems()
      window.renderLearningPath?.()
      return 'Learning path cleared.'
    }
    return `Unknown tool: ${name}`
  }

  // ── Minimal markdown → HTML ───────────────────────────────────
  function _md(text) {
    return text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
  }

  // ── UI helpers ────────────────────────────────────────────────
  function _append(role, html) {
    const msgs = document.getElementById('chat-messages')
    if (!msgs) return
    const div = document.createElement('div')
    div.className = `chat-msg chat-msg--${role}`
    div.innerHTML = html
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  function _appendTool(toolName) {
    const labels = {
      get_current_steps: 'Reading current steps…',
      add_steps:         'Adding steps to path…',
      replace_all_steps: 'Updating learning path…',
      clear_steps:       'Clearing path…',
    }
    _append('tool', labels[toolName] || `Using ${toolName}…`)
  }

  function _setThinking(on) {
    document.getElementById('chat-thinking')?.classList.toggle('hidden', !on)
    const btn = document.getElementById('chat-send-btn')
    if (btn) btn.disabled = on
  }

  // ── Agent loop ────────────────────────────────────────────────
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
        body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM, tools: TOOLS, messages: _msgs })
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

      break // unexpected stop reason
    }
  }

  // ── Public: send message ──────────────────────────────────────
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

  // ── API key overlay ───────────────────────────────────────────
  function _showKeyOverlay() {
    document.getElementById('api-key-overlay')?.classList.remove('hidden')
  }

  function _hideKeyOverlay() {
    document.getElementById('api-key-overlay')?.classList.add('hidden')
  }

  function _setupKeyOverlay() {
    const keyBtn = document.getElementById('chat-api-key-btn')
    const input  = document.getElementById('api-key-input')
    const save   = document.getElementById('api-key-save')
    const cancel = document.getElementById('api-key-cancel')
    if (!keyBtn) return

    keyBtn.addEventListener('click', () => {
      if (input) input.value = DB.getApiKey()
      _showKeyOverlay()
    })
    save?.addEventListener('click', async () => {
      const k = input?.value.trim()
      if (!k) return
      await DB.saveApiKey(k)
      _hideKeyOverlay()
    })
    cancel?.addEventListener('click', _hideKeyOverlay)
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') save?.click() })
  }

  // ── Setup chat input ──────────────────────────────────────────
  function _setupInput() {
    const input   = document.getElementById('chat-input')
    const sendBtn = document.getElementById('chat-send-btn')
    const propose = document.getElementById('chat-propose-btn')
    if (!input) return

    function submit() {
      const val = input.value.trim()
      if (!val) return
      if (!DB.getApiKey()) { _showKeyOverlay(); return }
      input.value = ''
      input.style.height = 'auto'
      sendMessage(val)
    }

    sendBtn?.addEventListener('click', submit)
    input.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit() }
    })
    propose?.addEventListener('click', () => {
      input.value = 'Design a complete Claude Code learning path for a developer who knows programming but has never used Claude Code before.'
      input.focus()
    })
  }

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    _setupKeyOverlay()
    _setupInput()
    if (!DB.getApiKey()) _showKeyOverlay()
  }

  return { init, sendMessage }
})()
