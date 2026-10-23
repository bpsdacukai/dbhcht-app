import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './hooks/useAuth.jsx'
import { useApp } from './hooks/useApp.jsx'
import { Topbar, Sidebar, BottomNav, pageLabel } from './components/Layout.jsx'
import { Notifs, PageSkeleton } from './components/UI.jsx'
import Login from './pages/Login.jsx'

// Halaman dimuat sesuai kebutuhan (code-splitting) → pembukaan awal lebih cepat
const Dashboard    = lazy(() => import('./pages/Dashboard.jsx'))
const RKP          = lazy(() => import('./pages/RKP.jsx'))
const Realisasi    = lazy(() => import('./pages/Realisasi.jsx'))
const Laporan      = lazy(() => import('./pages/Laporan.jsx'))
const Asistensi    = lazy(() => import('./pages/OtherPages.jsx').then(m => ({ default: m.Asistensi })))
const Rekonsiliasi = lazy(() => import('./pages/OtherPages.jsx').then(m => ({ default: m.Rekonsiliasi })))
const Pagu         = lazy(() => import('./pages/OtherPagesExtra.jsx').then(m => ({ default: m.Pagu })))
const ManajemenOPD = lazy(() => import('./pages/OtherPagesExtra.jsx').then(m => ({ default: m.ManajemenOPD })))
const Regulasi     = lazy(() => import('./pages/OtherPagesExtra.jsx').then(m => ({ default: m.Regulasi })))

const MOBILE_Q = '(max-width: 900px)'

// Cegah layar putih total bila satu halaman error
class ErrorBoundary extends Component {
  state = { err: null }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { console.error(err) }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="card" role="alert" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
        <div style={{ fontSize: '2.4rem' }}>😵</div>
        <div className="card-title" style={{ justifyContent: 'center', marginTop: '.5rem' }}>Halaman ini mengalami kendala</div>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>Data Anda aman. Silakan muat ulang halaman, atau pilih menu lain.</p>
        <button className="btn btn-primary" onClick={() => location.reload()}>🔄 Muat Ulang</button>
      </div>
    )
  }
}

// Tab (div biasa di banyak halaman) dibuat bisa dijangkau keyboard: Tab, Enter, Spasi.
function useKeyboardTabs() {
  useEffect(() => {
    const decorate = () => document.querySelectorAll('.tab:not([data-kb])').forEach(el => {
      el.setAttribute('data-kb', '1'); el.setAttribute('role', 'tab'); el.tabIndex = 0
    })
    const sync = () => document.querySelectorAll('.tab[data-kb]').forEach(el =>
      el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false'))
    const run = () => { decorate(); sync() }
    run()
    const mo = new MutationObserver(run)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    const onKey = (e) => {
      const el = e.target.closest?.('.tab[data-kb]')
      if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click() }
    }
    document.addEventListener('keydown', onKey)
    return () => { mo.disconnect(); document.removeEventListener('keydown', onKey) }
  }, [])
}

export default function App() {
  const { user, profile, loading } = useAuth()
  const { dark } = useApp()
  const [page, setPage] = useState('dashboard')
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_Q).matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia(MOBILE_Q).matches)
  const mainRef = useRef(null)

  useKeyboardTabs()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1120' : '#065f46')
  }, [dark])

  // Responsif: laci tertutup di layar kecil, sidebar terbuka di layar lebar
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_Q)
    const onChange = (e) => { setIsMobile(e.matches); setSidebarOpen(!e.matches) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Esc menutup laci; scroll halaman dikunci saat laci terbuka di ponsel
  useEffect(() => {
    if (!(isMobile && sidebarOpen)) return
    const onKey = (e) => e.key === 'Escape' && setSidebarOpen(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [isMobile, sidebarOpen])

  useEffect(() => { document.title = `${pageLabel(page)} — SIMDBHCHT` }, [page])

  const navigate = useCallback((id) => {
    setPage(id)
    if (isMobile) setSidebarOpen(false)
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true }) // pembaca layar langsung berada di konten baru
  }, [isMobile])

  if (loading) {
    return (
      <div className="splash" role="status" aria-live="polite">
        <div>
          <div className="splash-logo" aria-hidden="true">🌿</div>
          <h1>SIMDBHCHT</h1>
          <p>Memuat sistem…</p>
          <div className="splash-bar" aria-hidden="true" />
        </div>
      </div>
    )
  }

  if (!user || !profile) return <><Login /><Notifs /></>

  const pages = {
    dashboard:    <Dashboard />,
    rkp:          <RKP />,
    realisasi:    <Realisasi />,
    asistensi:    <Asistensi />,
    rekonsiliasi: <Rekonsiliasi />,
    pagu:         <Pagu />,
    manajemen:    <ManajemenOPD />,
    regulasi:     <Regulasi />,
    laporan:      <Laporan />,
  }

  return (
    <div className="app-shell">
      <a href="#konten" className="skip-link no-print" onClick={(e) => { e.preventDefault(); mainRef.current?.focus() }}>Lewati ke konten utama</a>
      <Topbar sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(v => !v)} />
      <div className="layout">
        <Sidebar page={page} onNav={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main id="konten" className="main-content" ref={mainRef} tabIndex={-1} style={{ outline: 'none' }}>
          <ErrorBoundary resetKey={page}>
            <Suspense fallback={<PageSkeleton />}>
              <div key={page} className="page-enter">
                {pages[page] || <Dashboard />}
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <BottomNav page={page} onNav={navigate} menuOpen={isMobile && sidebarOpen} onMenu={() => setSidebarOpen(v => !v)} />
      <Notifs />
    </div>
  )
}
