import { useApp } from '../hooks/useApp.jsx'

// ── Notifications ──────────────────────────────────────────────
export function Notifs() {
  const { notifs } = useApp()
  return (
    <div className="notif-wrap">
      {notifs.map(n => (
        <div key={n.id} className={`notif notif-${n.type}`}>{n.msg}</div>
      ))}
    </div>
  )
}

// ── Modal wrapper ──────────────────────────────────────────────
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={wide ? { maxWidth: 700 } : {}}>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────
export function ProgressBar({ value, color, height = 7 }) {
  return (
    <div className="pbar" style={{ height }}>
      <div className="pbar-fill" style={{ width: Math.min(value || 0, 100) + '%', background: color }} />
    </div>
  )
}

// ── Stat card ──────────────────────────────────────────────────
export function StatBox({ label, value, sub, color }) {
  return (
    <div className="stat-box">
      <div className="stat-lbl">{label}</div>
      <div className="stat-val" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ── Empty table row ────────────────────────────────────────────
export function EmptyRow({ cols, msg = 'Belum ada data.' }) {
  return (
    <tr><td colSpan={cols} className="empty-state">{msg}</td></tr>
  )
}

// ── Confirm delete button ──────────────────────────────────────
export function DelBtn({ onClick }) {
  return <button className="btn btn-sm" style={{ background: 'rgba(192,57,43,.12)', color: 'var(--danger)', border: 'none' }} onClick={onClick}>🗑️</button>
}

// ── Edit button ────────────────────────────────────────────────
export function EditBtn({ onClick }) {
  return <button className="btn btn-outline btn-sm" onClick={onClick}>✏️</button>
}

// ── Loading spinner ────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return <span className="spin" style={{ fontSize: size }}>⏳</span>
}

// ── Page header row ────────────────────────────────────────────
export function PageHeader({ title, children }) {
  return (
    <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '.5rem', marginBottom: '1rem' }}>
      <div className="page-title" style={{ margin: 0 }}>{title}</div>
      {children && <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

// ── Persen badge ──────────────────────────────────────────────
export function PctBadge({ value }) {
  const v = Number(value) || 0
  const cls = v >= 80 ? 'badge-green' : v >= 50 ? 'badge-amber' : 'badge-red'
  return <span className={`badge ${cls}`}>{v.toFixed(1)}%</span>
}

// ── Bidang badge ──────────────────────────────────────────────
export function BidangBadge({ bidangId, semua }) {
  const map = {
    kesmas:     { label: 'Kesej. Masyarakat', cls: 'badge-green' },
    kesehatan:  { label: 'Kesehatan',          cls: 'badge-blue'  },
    hukum:      { label: 'Penegakan Hukum',    cls: 'badge-red'   },
    koordinasi: { label: 'Koordinasi DBH CHT', cls: 'badge-brown' },
  }
  const b = map[bidangId] || { label: bidangId, cls: 'badge-gray' }
  return <span className={`badge ${b.cls}`}>{b.label}</span>
}
