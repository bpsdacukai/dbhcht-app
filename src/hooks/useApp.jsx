import { createContext, useContext, useState, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [tahun, setTahun]           = useState(2026)
  const [jenis, setJenis]           = useState('Murni')
  const [dark, setDark]             = useState(() => localStorage.getItem('simdbh_dark') === '1')
  const [notifs, setNotifs]         = useState([])
  const [sidebarOpen, setSidebar]   = useState(true)

  const toggleDark = () => {
    setDark(d => { localStorage.setItem('simdbh_dark', d ? '0' : '1'); return !d })
  }

  const notify = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setNotifs(n => [...n, { id, msg, type }])
    setTimeout(() => setNotifs(n => n.filter(x => x.id !== id)), 4000)
  }, [])

  return (
    <AppContext.Provider value={{ tahun, setTahun, jenis, setJenis, dark, toggleDark, notifs, notify, sidebarOpen, setSidebar }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() { return useContext(AppContext) }
