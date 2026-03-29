// ── Hash-based SPA router ────────────────────────────────────────
window.Router = (() => {
  const PAGES   = ['home', 'learning', 'calendar']
  const DEFAULT = 'home'

  function _getHash() {
    const h = location.hash.replace('#', '').trim()
    return PAGES.includes(h) ? h : DEFAULT
  }

  function _apply(pageId) {
    document.querySelectorAll('.page').forEach(el => {
      el.classList.toggle('page--active', el.id === `page-${pageId}`)
    })
    document.querySelectorAll('.nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageId)
    })
    if (typeof window._onPageActivate === 'function') window._onPageActivate(pageId)
  }

  return {
    init() {
      window.addEventListener('hashchange', () => _apply(_getHash()))
      _apply(_getHash())
    },
    navigate(pageId) {
      if (!PAGES.includes(pageId)) pageId = DEFAULT
      location.hash = pageId
    },
    getPage() { return _getHash() },
  }
})()
