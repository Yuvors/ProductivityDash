// ── Floating Motivational Statement ──────────────────────────────
// Initialized by app.js after the dashboard is shown.

window.Floater = (() => {
  let _el, _textEl, _closeBtn, _state

  function _render() {
    if (!_el) return
    _textEl.textContent = _state.text

    if (!_state.text) {
      _el.style.display = 'none'
      return
    }

    _el.style.display = _state.visible ? 'flex' : 'none'

    // Update animation class
    _el.className = `floater floater--${_state.style || 'drift'}`

    // Trigger entry animation
    void _el.offsetWidth // force reflow
    _el.classList.add('floater--entering')
    setTimeout(() => _el.classList.remove('floater--entering'), 450)
  }

  return {
    init() {
      _el      = document.getElementById('floater')
      _textEl  = _el.querySelector('.floater__text')
      _closeBtn = _el.querySelector('.floater__close')
      _state   = DB.getFloaterState()

      _closeBtn.addEventListener('click', () => {
        _state = { ..._state, visible: false }
        DB.saveFloaterState(_state)
        _el.style.display = 'none'
      })

      _render()
    },

    setState(newState) {
      _state = { ..._state, ...newState }
      DB.saveFloaterState(_state)
      _render()
    },

    getState() { return { ..._state } },

    show() {
      _state = { ..._state, visible: true }
      DB.saveFloaterState(_state)
      _render()
    },
  }
})()
