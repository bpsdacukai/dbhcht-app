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
import { Asistensi, Rekonsiliasi, Pagu, ManajemenOPD, Regulasi } from './pages/OtherPages.jsx'

export default function App() {
  const { user, profile, loading } = useAuth()
  const { dark } = useApp()
  const [page, setPage] = useState('dashboard')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

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
      <Topbar />
      <div className="layout">
        <Sidebar page={page} onNav={setPage} />
        <main className="main-content">
          {pages[page] || <Dashboard />}
        </main>
      </div>
      <Notifs />
    </div>
  )
}
