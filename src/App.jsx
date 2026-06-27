import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth.jsx'
import { useApp } from './hooks/useApp.jsx'
import { Topbar, Sidebar } from './components/Layout.jsx'
import { Notifs } from './components/UI.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import RKP from './pages/RKP.jsx'
import Realisasi from './pages/Realisasi.jsx'
import Laporan from './pages/Laporan.jsx'
import { Asistensi, Rekonsiliasi } from './pages/OtherPages.jsx'
import { Pagu, ManajemenOPD, Regulasi } from './pages/OtherPagesExtra.jsx'

export default function App() {
  const { user, profile, loading } = useAuth()
  const { dark } = useApp()
  const [page, setPage] = useState('dashboard')
  // Sidebar open by default, bisa disembunyikan
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // Responsive: tutup sidebar otomatis di layar kecil
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 768) setSidebarOpen(false)
      else setSidebarOpen(true)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#162a17' }}>
        <div style={{ textAlign:'center', color:'#52b788' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>🌿</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem' }}>SIMDBHCHT</div>
          <div style={{ fontSize:'.8rem', opacity:.7, marginTop:'.5rem' }}>Memuat sistem...</div>
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
      <Topbar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
      />
      <div className="layout">
        <Sidebar page={page} onNav={setPage} open={sidebarOpen} />
        <main className="main-content">
          {pages[page] || <Dashboard />}
        </main>
      </div>
      <Notifs />
    </div>
  )
}
