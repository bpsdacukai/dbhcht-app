import { useAuth } from '../hooks/useAuth.jsx'
import { useApp } from '../hooks/useApp.jsx'
import { supabase } from '../lib/supabase.js'
import { TAHUN_LIST } from '../lib/constants.js'

// Daftar menu tunggal — dipakai Sidebar & BottomNav
export const NAV_MENUS = [
  { id: 'dashboard',    icon: '🏠', label: 'Dashboard',        c: '#10b981' },
  { id: 'pagu',         icon: '💰', label: 'Pagu Alokasi',     c: '#f59e0b', sekOnly: true },
  { section: 'PERENCANAAN' },
  { id: 'rkp',          icon: '📄', label: 'Penyusunan RKP',   c: '#0ea5e9' },
  { id: 'asistensi',    icon: '🤝', label: 'Asistensi RKP',    c: '#8b5cf6' },
  { section: 'MONITORING' },
  { id: 'realisasi',    icon: '📈', label: 'Realisasi',        c: '#14b8a6' },
  { id: 'rekonsiliasi', icon: '🔄', label: 'Rekonsiliasi',     c: '#f43f5e' },
  { section: 'LAPORAN' },
  { id: 'laporan',      icon: '🖨️', label: 'Laporan & Cetak',  c: '#f97316' },
  { section: 'REFERENSI' },
  { id: 'regulasi',     icon: '📚', label: 'Regulasi',         c: '#6366f1' },
  { section: 'ADMIN', sekOnly: true },
  { id: 'manajemen',    icon: '👥', label: 'Manajemen OPD',    c: '#3b82f6', sekOnly: true },
]
export const pageLabel = (id) => NAV_MENUS.find(m => m.id === id)?.label || 'Dashboard'

const initials = (nama = '') => nama.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

export function Topbar({ onToggleSidebar, sidebarOpen }) {
  const { profile } = useAuth()
  const { tahun, setTahun, jenis, setJenis, dark, toggleDark } = useApp()
  const logout = async () => { await supabase.auth.signOut() }

  return (
    <header className="topbar">
      <button type="button" className="topbar-burger" onClick={onToggleSidebar}
        aria-label={sidebarOpen ? 'Sembunyikan menu' : 'Tampilkan menu'} aria-expanded={sidebarOpen} aria-controls="sidebar">
        <span aria-hidden="true">{sidebarOpen ? '✕' : '☰'}</span>
      </button>
      <div className="brand">
        <span className="brand-logo" aria-hidden="true">🌿</span>
        <div className="brand-text" style={{ minWidth: 0 }}>
          <div className="topbar-title">SIMDBHCHT</div>
          <span className="topbar-sub">Sistem Informasi DBH Cukai Hasil Tembakau</span>
        </div>
      </div>
      <div className="topbar-spacer" />
      {profile && (
        <>
          <select className="topbar-select" value={tahun} onChange={e => setTahun(Number(e.target.value))} aria-label="Tahun anggaran">
            {TAHUN_LIST.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="topbar-select" value={jenis} onChange={e => setJenis(e.target.value)} aria-label="Jenis RKP (Murni atau Perubahan)">
            <option value="Murni">Murni</option>
            <option value="Perubahan">Perubahan</option>
          </select>
        </>
      )}
      <button type="button" className="topbar-btn" onClick={toggleDark} aria-pressed={dark}
        aria-label={dark ? 'Beralih ke tema terang' : 'Beralih ke tema gelap'} title={dark ? 'Tema terang' : 'Tema gelap'}>
        <span aria-hidden="true">{dark ? '☀️' : '🌙'}</span>
      </button>
      {profile && (
        <>
          <span className="topbar-user hide-xs" title={profile.nama}>
            <span className="avatar" aria-hidden="true">{initials(profile.nama)}</span>
            <span className="nm hide-sm">{profile.role === 'sekretariat' ? '👑 ' : ''}{profile.nama?.split(' ').slice(0, 2).join(' ')}</span>
          </span>
          <button type="button" className="topbar-btn danger" onClick={logout} aria-label="Keluar dari aplikasi">
            <span aria-hidden="true">⏻</span><span className="hide-xs"> Keluar</span>
          </button>
        </>
      )}
    </header>
  )
}

export function Sidebar({ page, onNav, open, onClose }) {
  const { profile } = useAuth()
  if (!profile) return null
  const isSkrt = profile.role === 'sekretariat'

  return (
    <>
      <nav id="sidebar" className={`sidebar ${open ? '' : 'collapsed'}`} aria-label="Menu utama" aria-hidden={!open}>
        <div className="sidebar-inner">
          <div className="sidebar-user">
            <strong>{profile.nama?.split(' ').slice(0, 3).join(' ')}</strong>
            <span>{isSkrt ? 'Sekretariat Tim' : 'OPD Pengguna'}</span>
          </div>
          {NAV_MENUS.map((m, i) => {
            if (m.sekOnly && !isSkrt) return null
            if (m.section) return <div key={i} className="nav-section" role="presentation">{m.section}</div>
            const active = page === m.id
            return (
              <button key={m.id} type="button" className={`nav-item ${active ? 'active' : ''}`}
                style={{ '--nav-c': m.c }} aria-current={active ? 'page' : undefined} onClick={() => onNav(m.id)}>
                <span className="nav-ic" aria-hidden="true">{m.icon}</span>
                <span>{m.label}</span>
                {!isSkrt && (m.id === 'asistensi' || m.id === 'rekonsiliasi') && <span className="nav-pill">Lihat</span>}
              </button>
            )
          })}
        </div>
      </nav>
      {/* Latar gelap penutup laci — hanya tampil di layar kecil (lihat CSS) saat menu terbuka */}
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
    </>
  )
}

// Navigasi bawah untuk ponsel — akses cepat satu tangan
export function BottomNav({ page, onNav, onMenu, menuOpen }) {
  const { profile } = useAuth()
  if (!profile) return null
  const items = ['dashboard', 'rkp', 'realisasi', 'laporan'].map(id => NAV_MENUS.find(m => m.id === id))
  return (
    <nav className="bottom-nav no-print" aria-label="Navigasi cepat">
      {items.map(m => (
        <button key={m.id} type="button" className={`bn-item ${page === m.id ? 'active' : ''}`} style={{ '--nav-c': m.c }}
          aria-current={page === m.id ? 'page' : undefined} onClick={() => onNav(m.id)}>
          <span className="bn-ic" aria-hidden="true">{m.icon}</span>
          <span className="lb">{m.label.replace(' & Cetak', '').replace('Penyusunan ', '')}</span>
        </button>
      ))}
      <button type="button" className={`bn-item ${menuOpen ? 'active' : ''}`} style={{ '--nav-c': '#6366f1' }}
        aria-expanded={menuOpen} aria-controls="sidebar" onClick={onMenu}>
        <span className="bn-ic" aria-hidden="true">☰</span>
        <span className="lb">Menu</span>
      </button>
    </nav>
  )
}
