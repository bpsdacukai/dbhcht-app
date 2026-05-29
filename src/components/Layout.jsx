import { useAuth } from '../hooks/useAuth.jsx'
import { useApp } from '../hooks/useApp.jsx'
import { supabase } from '../lib/supabase.js'
import { TAHUN_LIST } from '../lib/constants.js'

export function Topbar() {
  const { profile } = useAuth()
  const { tahun, setTahun, jenis, setJenis, dark, toggleDark } = useApp()

  const logout = async () => { await supabase.auth.signOut() }

  return (
    <div className="topbar">
      <span style={{ fontSize:'1.3rem' }}>🌿</span>
      <div>
        <div className="topbar-title">SIMDBHCHT</div>
        <span className="topbar-sub">Sistem Informasi DBH Cukai Hasil Tembakau</span>
      </div>
      <div className="topbar-spacer" />
      {profile && (
        <>
          <select value={tahun} onChange={e=>setTahun(Number(e.target.value))}
            style={{ background:'transparent', color:'#bbb', border:'1px solid #3a5a3c', borderRadius:5, padding:'3px 7px', fontSize:'.75rem' }}>
            {TAHUN_LIST.map(y=><option key={y} value={y} style={{ background:'#1a3a1c' }}>{y}</option>)}
          </select>
          <select value={jenis} onChange={e=>setJenis(e.target.value)}
            style={{ background:'transparent', color:'#bbb', border:'1px solid #3a5a3c', borderRadius:5, padding:'3px 7px', fontSize:'.75rem' }}>
            <option style={{ background:'#1a3a1c' }}>Murni</option>
            <option style={{ background:'#1a3a1c' }}>Perubahan</option>
          </select>
        </>
      )}
      <button className="btn-ghost" style={{ color:'#ccc' }} onClick={toggleDark}>{dark?'☀️':'🌙'}</button>
      {profile && (
        <>
          <span style={{ fontSize:'.78rem', color:'#aaa' }}>{profile.role==='sekretariat'?'👑':'👤'} {profile.nama?.split(' ').slice(0,2).join(' ')}</span>
          <button className="btn btn-sm" style={{ background:'rgba(192,57,43,.25)', color:'#ffaaaa', border:'1px solid rgba(192,57,43,.4)' }} onClick={logout}>Logout</button>
        </>
      )}
    </div>
  )
}

export function Sidebar({ page, onNav }) {
  const { profile } = useAuth()
  if (!profile) return null
  const isSkrt = profile.role === 'sekretariat'

  const menus = [
    { id:'dashboard',     icon:'🏠', label:'Dashboard' },
    { id:'pagu',          icon:'💰', label:'Pagu Alokasi',    sekOnly:true },
    { section:'PERENCANAAN' },
    { id:'rkp',           icon:'📄', label:'Penyusunan RKP' },
    { id:'asistensi',     icon:'🤝', label:'Asistensi RKP',   sekOnly:true },
    { section:'MONITORING' },
    { id:'realisasi',     icon:'📈', label:'Realisasi' },
    { id:'rekonsiliasi',  icon:'🔄', label:'Rekonsiliasi',    sekOnly:true },
    { section:'LAPORAN' },
    { id:'laporan',       icon:'🖨️', label:'Laporan & Cetak' },
    { section:'REFERENSI' },
    { id:'regulasi',      icon:'📚', label:'Regulasi' },
    { section:'ADMIN', sekOnly:true },
    { id:'manajemen',     icon:'👥', label:'Manajemen OPD',   sekOnly:true },
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-user">
        <strong>{profile.nama?.split(' ').slice(0,3).join(' ')}</strong>
        {profile.role==='sekretariat'?'Sekretariat Tim':'OPD Pengguna'}
      </div>
      {menus.map((m,i) => {
        if (m.sekOnly && !isSkrt) return null
        if (m.section) return <div key={i} className="nav-section">{m.section}</div>
        return (
          <div key={m.id} className={`nav-item ${page===m.id?'active':''}`} onClick={()=>onNav(m.id)}>
            <span>{m.icon}</span> {m.label}
          </div>
        )
      })}
    </div>
  )
}
