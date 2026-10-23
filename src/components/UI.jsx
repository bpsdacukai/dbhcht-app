import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../hooks/useApp.jsx'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── Notifications ──────────────────────────────────────────────
export function Notifs() {
  const { notifs } = useApp()
  return (
    <div className="notif-wrap" role="region" aria-label="Notifikasi" aria-live="polite">
      {notifs.map(n => (
        <div key={n.id} className={`notif notif-${n.type}`} role={n.type === 'error' ? 'alert' : 'status'}>
          <span>{n.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ── Modal wrapper ──────────────────────────────────────────────
// Aksesibel: role=dialog, tombol Esc menutup, fokus terkunci di dalam dialog,
// fokus dikembalikan ke tombol pemicu, dan scroll halaman di belakang dikunci.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Modal({ title, onClose, children, wide }) {
  const boxRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const titleId = useId()

  useEffect(() => {
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const box = boxRef.current
    const items = () => [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
    // fokus awal: kolom isian pertama (lewati tombol tutup)
    const first = items().find(el => !el.classList.contains('modal-x')) || box
    first.focus({ preventScroll: true })

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const list = items()
      if (!list.length) return
      const a = list[0], z = list[list.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        tabIndex={-1} style={wide ? { maxWidth: 760 } : {}}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Tutup dialog">✕</button>
        <div className="modal-title" id={titleId}>{title}</div>
        {children}
      </div>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────
export function ProgressBar({ value, color, height = 7 }) {
  const v = Math.max(0, Math.min(Number(value) || 0, 100))
  return (
    <div className="pbar" style={{ height }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
      <div className="pbar-fill"
        style={{ width: v + '%', ...(color ? { background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 55%, #fff))` } : {}) }} />
    </div>
  )
}

// ── Animasi hitung naik untuk angka statistik ──────────────────
// Mengenali "Rp 1.234.567", "12.3%", "42" — selain itu ditampilkan apa adanya.
function parseValue(v) {
  if (typeof v === 'number' && isFinite(v)) return { pre: '', n: v, dec: 0, suf: '', id: true }
  if (typeof v !== 'string') return null
  const m = /^(\D*?)(\d[\d.,]*)(\D*)$/.exec(v.trim())
  if (!m) return null
  const [, pre, raw, suf] = m
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) {
    const dec = raw.includes(',') ? raw.split(',')[1].length : 0
    return { pre, suf, dec, id: true, n: parseFloat(raw.replace(/\./g, '').replace(',', '.')) }
  }
  if (/^\d+,\d+$/.test(raw)) return { pre, suf, dec: raw.split(',')[1].length, id: true, n: parseFloat(raw.replace(',', '.')) }
  if (/^\d+\.\d{1,2}$/.test(raw)) return { pre, suf, dec: raw.split('.')[1].length, id: false, n: parseFloat(raw) }
  if (/^\d+$/.test(raw)) return { pre, suf, dec: 0, id: true, n: parseInt(raw, 10) }
  return null
}
const fmtAnim = (p, n) => p.pre + (p.id
  ? new Intl.NumberFormat('id-ID', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }).format(n)
  : n.toFixed(p.dec)) + p.suf

function AnimatedValue({ value }) {
  const parsed = parseValue(value)
  const target = parsed ? parsed.n : 0
  const [shown, setShown] = useState(parsed && !prefersReducedMotion() ? 0 : target)
  const fromRef = useRef(0)

  useEffect(() => {
    if (!parsed) return
    if (prefersReducedMotion()) { setShown(target); return }
    const from = fromRef.current, dur = 900, t0 = performance.now()
    let raf
    const tick = (t) => {
      const k = Math.min((t - t0) / dur, 1)
      const e = 1 - Math.pow(1 - k, 3) // easeOutCubic
      setShown(from + (target - from) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  if (!parsed) return <>{value}</>
  return (
    <>
      <span aria-hidden="true">{fmtAnim(parsed, shown)}</span>
      <span className="sr-only">{String(value)}</span>
    </>
  )
}

// ── Stat card ──────────────────────────────────────────────────
// tone: green | blue | violet | amber | rose | teal  (opsional — otomatis berselang-seling bila kosong)
export function StatBox({ label, value, sub, color, tone }) {
  return (
    <div className={`stat-box ${tone ? 'tone-' + tone : ''}`}>
      <div className="stat-lbl">{label}</div>
      <div className="stat-val" style={color ? { color } : {}}><AnimatedValue value={value} /></div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ── Empty table row ────────────────────────────────────────────
export function EmptyRow({ cols, msg = 'Belum ada data.' }) {
  return (
    <tr><td colSpan={cols} className="empty-state"><span className="empty-ic" aria-hidden="true">🗂️</span>{msg}</td></tr>
  )
}

// ── Confirm delete button ──────────────────────────────────────
export function DelBtn({ onClick }) {
  return <button type="button" className="btn btn-sm" title="Hapus" aria-label="Hapus"
    style={{ background: 'rgba(244,63,94,.14)', color: 'var(--rose)', border: 'none' }} onClick={onClick}>🗑️</button>
}

// ── Edit button ────────────────────────────────────────────────
export function EditBtn({ onClick }) {
  return <button type="button" className="btn btn-outline btn-sm" title="Ubah" aria-label="Ubah" onClick={onClick}>✏️</button>
}

// ── Loading spinner ────────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return <span className="spin" role="status" aria-label="Memuat" style={{ fontSize: size }}>⏳</span>
}

// ── Skeleton (kerangka saat memuat) ────────────────────────────
export function Skeleton({ h = 16, w = '100%', mt = 0 }) {
  return <div className="skeleton" aria-hidden="true" style={{ height: h, width: w, marginTop: mt }} />
}

export function PageSkeleton() {
  return (
    <div role="status" aria-label="Memuat halaman">
      <Skeleton h={30} w="42%" />
      <div className="g4" style={{ marginTop: 18 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} h={92} />)}
      </div>
      <Skeleton h={240} mt={16} />
    </div>
  )
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
export function BidangBadge({ bidangId }) {
  const map = {
    kesmas:     { label: 'Kesej. Masyarakat', cls: 'badge-green' },
    kesehatan:  { label: 'Kesehatan',          cls: 'badge-blue'  },
    hukum:      { label: 'Penegakan Hukum',    cls: 'badge-red'   },
    koordinasi: { label: 'Koordinasi DBH CHT', cls: 'badge-brown' },
  }
  const b = map[bidangId] || { label: bidangId, cls: 'badge-gray' }
  return <span className={`badge ${b.cls}`}>{b.label}</span>
}
