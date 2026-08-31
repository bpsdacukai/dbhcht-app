import { useState, useEffect, useRef } from 'react'
import { signInWithUsername } from '../lib/supabase.js'

/* ────────────────────────────────────────────────────────────
   Geometry helpers for the excise-seal (rosette) mark.
   Real pita cukai (excise tape) carries a fine engraved rosette
   with a guilloché sunburst and a tick-marked perimeter ring —
   the same convention used on currency and duty stamps. We
   generate that geometry rather than hand-plotting every line.
   ──────────────────────────────────────────────────────────── */
const polar = (cx, cy, r, deg) => {
  const rad = (deg - 90) * (Math.PI / 180)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

function SealRosette({ size = 116 }) {
  const cx = size / 2, cy = size / 2
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const deg = (360 / 48) * i
    const [x1, y1] = polar(cx, cy, size * 0.44, deg)
    const [x2, y2] = polar(cx, cy, size * 0.40, deg)
    return <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C9A227" strokeWidth="0.7" opacity="0.55" />
  })
  const rays = Array.from({ length: 32 }, (_, i) => {
    const deg = (360 / 32) * i
    const long = i % 2 === 0
    const [x1, y1] = polar(cx, cy, size * 0.185, deg)
    const [x2, y2] = polar(cx, cy, long ? size * 0.355 : size * 0.30, deg)
    return <line key={`r${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#C9A227" strokeWidth="0.6" opacity={long ? 0.5 : 0.3} />
  })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={size * 0.46} fill="none" stroke="#C9A227" strokeWidth="1" opacity="0.6" />
      <circle cx={cx} cy={cy} r={size * 0.385} fill="none" stroke="#C9A227" strokeWidth="0.6" opacity="0.4" />
      {ticks}
      {rays}
      <circle cx={cx} cy={cy} r={size * 0.20} fill="#0E2418" stroke="#C9A227" strokeWidth="1" opacity="0.85" />
      {/* engraved tobacco leaf */}
      <g transform={`translate(${cx} ${cy}) scale(${size / 116})`}>
        <path
          d="M0,-15.5 C7,-11 11.5,-3 10,6 C8.7,13.5 3.8,18.6 0,21.5
             C-3.8,18.6 -8.7,13.5 -10,6 C-11.5,-3 -7,-11 0,-15.5 Z"
          fill="#E8C766" opacity="0.16" stroke="#E8C766" strokeWidth="1"
        />
        <path d="M0,-14 L0,20.5" stroke="#E8C766" strokeWidth="0.8" opacity="0.9" />
        <path d="M0,-6 C3.5,-4.4 6.6,-2 8.3,2 M0,-6 C-3.5,-4.4 -6.6,-2 -8.3,2" fill="none" stroke="#E8C766" strokeWidth="0.6" opacity="0.75" />
        <path d="M0,0 C3.4,1.7 6,4.4 7,8 M0,0 C-3.4,1.7 -6,4.4 -7,8" fill="none" stroke="#E8C766" strokeWidth="0.6" opacity="0.75" />
        <path d="M0,7 C2.6,8.4 4.6,10.6 5.3,13.4 M0,7 C-2.6,8.4 -4.6,10.6 -5.3,13.4" fill="none" stroke="#E8C766" strokeWidth="0.6" opacity="0.7" />
      </g>
    </svg>
  )
}

/* Small decorative bar-code flourish — echoes the printed code
   strip on an excise tape, next to the serial number. */
function BarcodeStrip() {
  const widths = [2,1,3,1,1,2,1,3,2,1,1,2,3,1,2,1,1,3,2,1]
  return (
    <svg width="72" height="16" viewBox="0 0 72 16">
      {widths.reduce((acc, w, i) => {
        const x = acc.x
        acc.els.push(<rect key={i} x={x} y="0" width={w} height="16" fill="#6b8f76" opacity="0.55" />)
        acc.x += w + 1.6
        return acc
      }, { x: 0, els: [] }).els}
    </svg>
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [pass,     setPass]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [mounted,  setMounted]  = useState(false)
  const [focusedField, setFocusedField] = useState(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    setMounted(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const root = canvas.parentElement

    const resize = () => {
      canvas.width  = root.offsetWidth
      canvas.height = root.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Slow drifting motes — reads as suspended gold leaf-dust,
    // not a generic "network" particle field.
    const motes = Array.from({ length: 40 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.3 + 0.3,
      vy:    -(Math.random() * 0.12 + 0.03),
      vx:    (Math.random() - 0.5) * 0.06,
      alpha: Math.random() * 0.35 + 0.08,
    }))

    let animId
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      motes.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.y < -4) { p.y = canvas.height + 4; p.x = Math.random() * canvas.width }
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(201,162,39,${p.alpha})`
        ctx.fill()
      })
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const doLogin = async () => {
    if (!username || !pass) { setError('Username dan password wajib diisi.'); return }
    setLoading(true); setError('')
    try {
      await signInWithUsername(username.trim(), pass)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const focusStyle = {
    borderColor: 'rgba(201,162,39,0.55)',
    background:  'rgba(201,162,39,0.06)',
    boxShadow:   '0 0 0 3px rgba(201,162,39,0.08)',
  }
  const blurStyle = {
    borderColor: 'rgba(201,162,39,0.16)',
    background:  'rgba(237,230,200,0.03)',
    boxShadow:   'none',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:wght@400;500;600&family=Manrope:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');

        .lp-root {
          min-height: 100vh;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, #123122 0%, #0A1F14 55%, #071609 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Manrope', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 2.5rem 1rem 2rem;
        }

        /* excise-tape colour band along the very top of the page —
           the one loud gesture the rest of the page stays quiet around */
        .lp-band {
          position: absolute; top: 0; left: 0; right: 0; height: 6px;
          background: repeating-linear-gradient(
            -35deg,
            #C9A227 0px, #C9A227 22px,
            #EDE3C8 22px, #EDE3C8 26px,
            #B5432D 26px, #B5432D 48px,
            #EDE3C8 48px, #EDE3C8 52px
          );
          background-size: 200% 100%;
          animation: lp-band-shift 14s linear infinite;
          opacity: 0.9;
        }
        .lp-band::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 8%, transparent 16%);
          animation: lp-band-sheen 6s ease-in-out infinite;
        }

        .lp-weave {
          position: absolute; inset: 0;
          pointer-events: none;
          opacity: 0.5;
        }

        .lp-card {
          position: relative;
          width: 100%; max-width: 420px;
          background: rgba(8,26,17,0.92);
          border: 1px solid rgba(201,162,39,0.22);
          border-radius: 4px;
          backdrop-filter: blur(18px);
          transition: opacity .6s ease, transform .6s ease;
          box-shadow:
            0 30px 80px rgba(0,0,0,0.45),
            0 0 0 1px rgba(201,162,39,0.05),
            inset 0 1px 0 rgba(237,230,200,0.06);
        }

        .lp-header {
          position: relative;
          padding: 2.1rem 2rem 1.5rem;
          display: flex; flex-direction: column; align-items: center;
          overflow: hidden;
        }
        .lp-header::before {
          content: '';
          position: absolute; inset: 0;
          background:
            radial-gradient(circle at 50% 30%, rgba(201,162,39,0.10) 0%, transparent 65%);
          pointer-events: none;
        }

        .lp-perf {
          position: relative;
          height: 0;
          border-top: 1.5px dashed rgba(201,162,39,0.28);
          margin: 0 0 1.6rem;
        }
        .lp-perf::before, .lp-perf::after {
          content: '';
          position: absolute; top: -7px;
          width: 14px; height: 14px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #123122, #071609);
          box-shadow: inset 0 0 0 1px rgba(201,162,39,0.25);
        }
        .lp-perf::before { left: -1.5rem; }
        .lp-perf::after  { right: -1.5rem; }

        .lp-body { padding: 0 2rem 2rem; }

        .lp-input {
          width: 100%;
          padding: 11px 42px 11px 14px;
          background: transparent;
          border: none;
          color: #EDE6D4;
          font-size: 14px;
          font-family: 'Manrope', system-ui, sans-serif;
          letter-spacing: 0.01em;
        }
        .lp-input:focus { outline: none; }
        .lp-input::placeholder { color: #4a6152; font-size: 13px; }
        .lp-input-solo { padding: 11px 14px; }

        .lp-submit {
          width: 100%;
          padding: 13px 20px;
          background: linear-gradient(135deg, #1b4a30, #0f3320);
          border: 1px solid rgba(201,162,39,0.4);
          border-radius: 3px;
          color: #EDE6D4;
          font-size: 13px;
          font-family: 'Manrope', system-ui, sans-serif;
          font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: all .2s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.35);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .lp-submit:hover:not(:disabled) {
          border-color: rgba(201,162,39,0.7);
          box-shadow: 0 6px 26px rgba(201,162,39,0.18);
          transform: translateY(-1px);
        }
        .lp-submit:disabled { opacity: .7; cursor: not-allowed; }

        .lp-eye-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          padding: 4px; display: flex; align-items: center;
          opacity: .65; transition: opacity .2s;
        }
        .lp-eye-btn:hover { opacity: 1; }

        .lp-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.9rem 1.4rem;
          border-top: 1px solid rgba(201,162,39,0.14);
          background: rgba(0,0,0,0.15);
        }

        @keyframes lp-band-shift {
          from { background-position: 0% 0; }
          to   { background-position: -200% 0; }
        }
        @keyframes lp-band-sheen {
          0%, 100% { transform: translateX(-120%); }
          50%      { transform: translateX(220%); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .lp-header { padding: 1.8rem 1.4rem 1.3rem; }
          .lp-body { padding: 0 1.4rem 1.6rem; }
        }
      `}</style>

      <div className="lp-root">
        <div className="lp-band" />
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />

        {/* faint engraved guilloché texture, tiled full-bleed */}
        <svg className="lp-weave" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="lp-guilloche" width="64" height="64" patternUnits="userSpaceOnUse">
              <path d="M0,32 C16,4 48,60 64,32" fill="none" stroke="#C9A227" strokeWidth="0.5" opacity="0.5" />
              <path d="M0,32 C16,60 48,4 64,32" fill="none" stroke="#C9A227" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#lp-guilloche)" />
        </svg>

        <div
          className="lp-card"
          style={{
            opacity:   mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            animation: mounted ? 'lp-fade-in .7s ease forwards' : 'none',
          }}
        >
          {/* ── Header / seal ── */}
          <div className="lp-header">
            <div style={{ marginBottom: '1.1rem' }}>
              <SealRosette size={112} />
            </div>

            <div style={{ textAlign:'center' }}>
              <p style={{ fontFamily:"'Space Mono', monospace", fontSize:9.5, color:'#C9A227', letterSpacing:'0.32em', marginBottom:8, opacity:0.8 }}>
                PEMERINTAH KOTA BATU
              </p>
              <h1 style={{ fontFamily:"'Spectral',serif", fontSize:27, fontWeight:600, letterSpacing:'0.06em', color:'#F2ECD8', marginBottom:6 }}>
                SIMDBHCHT
              </h1>
              <p style={{ fontSize:11.5, color:'#8FA893', lineHeight:1.5, maxWidth:280, margin:'0 auto' }}>
                Sistem Informasi Manajemen Dana Bagi Hasil Cukai Hasil Tembakau
              </p>
            </div>
          </div>

          <div className="lp-perf" />

          {/* ── Form ── */}
          <div className="lp-body">
            <div style={{ display:'flex', flexDirection:'column', gap:'1.15rem', marginBottom:'1.25rem' }}>

              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                <label style={{ fontSize:10.5, color:'#8FA893', letterSpacing:'0.05em', fontFamily:"'Manrope',sans-serif", fontWeight:600 }}>
                  Username
                </label>
                <div style={{ position:'relative', borderRadius:3, border:'1px solid', transition:'all .2s', ...(focusedField === 'user' ? focusStyle : blurStyle) }}>
                  <input
                    className="lp-input lp-input-solo"
                    type="text"
                    placeholder="Contoh: sekretariat"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError('') }}
                    onFocus={() => setFocusedField('user')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                <label style={{ fontSize:10.5, color:'#8FA893', letterSpacing:'0.05em', fontFamily:"'Manrope',sans-serif", fontWeight:600 }}>
                  Password
                </label>
                <div style={{ position:'relative', borderRadius:3, border:'1px solid', transition:'all .2s', ...(focusedField === 'pass' ? focusStyle : blurStyle) }}>
                  <input
                    className="lp-input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => { setPass(e.target.value); setError('') }}
                    onFocus={() => setFocusedField('pass')}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => e.key === 'Enter' && doLogin()}
                    autoComplete="current-password"
                  />
                  <button type="button" className="lp-eye-btn" onClick={() => setShowPass(s => !s)}>
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:7, color:'#f0b4a8', fontSize:12, marginBottom:'1rem', padding:'8px 12px', background:'rgba(181,67,45,0.12)', border:'1px solid rgba(181,67,45,0.3)', borderRadius:3 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <button className="lp-submit" onClick={doLogin} disabled={loading} style={{ marginBottom:'1.25rem' }}>
              {loading ? (
                <>
                  <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(201,162,39,0.3)', borderTopColor:'#C9A227', borderRadius:'50%', animation:'lp-spin .7s linear infinite' }} />
                  Memverifikasi...
                </>
              ) : (
                <>
                  Masuk ke Sistem
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>

            <div style={{ display:'flex', gap:10, background:'rgba(201,162,39,0.05)', border:'1px solid rgba(201,162,39,0.14)', borderRadius:3, padding:'12px 14px' }}>
              <div style={{ flexShrink:0, marginTop:2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A227" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize:10.5, fontFamily:"'Manrope',sans-serif", fontWeight:700, color:'#C9A227', marginBottom:4 }}>
                  Cara login
                </p>
                <p style={{ fontSize:11.5, color:'#8FA893', lineHeight:1.6 }}>
                  Gunakan <strong style={{ color:'#E8C766' }}>username</strong> (bukan email) yang diberikan Sekretariat Tim Koordinasi. Lupa password? Hubungi Sekretariat untuk reset.
                </p>
              </div>
            </div>
          </div>

          {/* ── Footer: serial strip, echoing the printed code on a real excise tape ── */}
          <div className="lp-footer">
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9.5, color:'#5a7a63', letterSpacing:'0.08em' }}>
              NO. SERI DBHCHT/KTB/2026
            </span>
            <BarcodeStrip />
          </div>
        </div>
      </div>
    </>
  )
}
