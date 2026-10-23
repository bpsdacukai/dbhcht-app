import { createContext, useContext, useState, useCallback, useRef } from 'react'

const AppContext = createContext(null)

// Tema: ikuti pilihan tersimpan; bila belum pernah memilih, ikuti pengaturan perangkat.
function initialDark() {
  try {
    const v = localStorage.getItem('simdbh_dark')
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* penyimpanan bisa diblokir */ }
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function AppProvider({ children }) {
  const [tahun, setTahun]           = useState(2026)
  const [jenis, setJenis]           = useState('Murni')
  const [dark, setDark]             = useState(initialDark)
  const [notifs, setNotifs]         = useState([])
  const [sidebarOpen, setSidebar]   = useState(true)
  const seq = useRef(0)

  const toggleDark = () => {
    const next = !dark
    try { localStorage.setItem('simdbh_dark', next ? '1' : '0') } catch { /* abaikan */ }
    setDark(next)
  }

  const notify = useCallback((msg, type = 'info') => {
    const id = ++seq.current // id unik (Date.now() bisa kembar bila 2 notifikasi muncul bersamaan)
    setNotifs(n => [...n.slice(-3), { id, msg, type }])
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <AppContext.Provider value={{ tahun, setTahun, jenis, setJenis, dark, toggleDark, notifs, notify, sidebarOpen, setSidebar }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
