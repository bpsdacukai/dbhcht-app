import { useState, useEffect, useRef } from 'react'
import { signInWithUsername } from '../lib/supabase.js'

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

    const particles = Array.from({ length: 55 }, () => ({
      x:     Math.random() * canvas.width,
      y:     Math.random() * canvas.height,
      r:     Math.random() * 1.5 + 0.3,
      vx:    (Math.random() - 0.5) * 0.25,
      vy:    (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.5 + 0.1,
    }))

    let animId
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0)             p.x = canvas.width
        if (p.x > canvas.width)  p.x = 0
        if (p.y < 0)             p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(74,222,128,${p.alpha})`
        ctx.fill()
      })
      particles.forEach((p, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const d = Math.hypot(p.x - particles[j].x, p.y - particles[j].y)
          if (d < 90) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(74,222,128,${0.06 * (1 - d / 90)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
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
    borderColor: 'rgba(74,222,128,0.45)',
    background:  'rgba(74,222,128,0.06)',
    boxShadow:   '0 0 0 3px rgba(74,222,128,0.07)',
  }
  const blurStyle = {
    borderColor: 'rgba(74,222,128,0.12)',
    background:  'rgba(74,222,128,0.03)',
    boxShadow:   'none',
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&family=Rajdhani:wght@500;600;700&display=swap');

        .lp-root {
          min-height: 100vh;
          background: #030f07;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          position: relative;
          overflow: hidden;
          padding: 2rem 1rem;
        }
        .lp-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(74,222,128,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,0.03) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }
        .lp-card {
          position: relative;
          width: 100%; max-width: 430px;
          background: rgba(5,20,12,0.90);
          border: 1px solid rgba(74,222,128,0.15);
          border-radius: 16px;
          padding: 2.5rem 2rem 2rem;
          backdrop-filter: blur(20px);
          transition: opacity .6s ease, transform .6s ease;
          box-shadow:
            0 0 60px rgba(74,222,128,0.05),
            0 0 120px rgba(74,222,128,0.03),
            inset 0 1px 0 rgba(74,222,128,0.10);
        }
        .lp-glow {
          position: absolute; top: -80px; left: 50%;
          transform: translateX(-50%);
          width: 300px; height: 200px;
          background: radial-gradient(ellipse, rgba(74,222,128,0.12) 0%, transparent 70%);
          pointer-events: none;
          animation: lp-glow-pulse 4s ease-in-out infinite;
        }
        .lp-logo-ring {
          position: absolute; inset: 0;
          border-radius: 50%;
          border: 1.5px solid rgba(74,222,128,0.4);
          animation: lp-pulse-ring 3s ease-in-out infinite;
        }
        .lp-badge-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #4ade80;
          display: block;
          animation: lp-dot-blink 2s ease-in-out infinite;
        }
        .lp-divider-line {
          flex: 1; height: 1px;
          background: rgba(74,222,128,0.10);
        }
        .lp-title-underline {
          width: 100%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(74,222,128,0.6), transparent);
          margin-bottom: 8px;
        }
        .lp-input {
          width: 100%;
          padding: 11px 42px 11px 14px;
          background: transparent;
          border: none;
          color: #d4f5e2;
          font-size: 14px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          letter-spacing: 0.02em;
        }
        .lp-input:focus { outline: none; }
        .lp-input::placeholder { color: #3d5a47; font-size: 13px; }
        .lp-input-solo {
          padding: 11px 14px;
        }
        .lp-submit {
          width: 100%;
          padding: 13px 20px;
          background: linear-gradient(135deg, #166534, #15803d);
          border: 1px solid rgba(74,222,128,0.3);
          border-radius: 8px;
          color: #d1fae5;
          font-size: 13px;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all .2s;
          box-shadow: 0 4px 20px rgba(74,222,128,0.15);
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .lp-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #15803d, #16a34a);
          box-shadow: 0 6px 28px rgba(74,222,128,0.25);
        }
        .lp-submit:disabled { opacity: .75; cursor: not-allowed; }
        .lp-eye-btn {
          position: absolute; right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          padding: 4px; display: flex; align-items: center;
          opacity: .7; transition: opacity .2s;
        }
        .lp-eye-btn:hover { opacity: 1; }

        @keyframes lp-glow-pulse {
          0%,100% { opacity: .15; }
          50%      { opacity: .30; }
        }
        @keyframes lp-pulse-ring {
          0%,100% { opacity: .4; transform: scale(1); }
          50%      { opacity: .8; transform: scale(1.08); }
        }
        @keyframes lp-dot-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: .3; }
        }
        @keyframes lp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes lp-fade-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="lp-root">
        <canvas ref={canvasRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }} />
        <div className="lp-grid" />

        <div
          className="lp-card"
          style={{
            opacity:   mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            animation: mounted ? 'lp-fade-in .7s ease forwards' : 'none',
          }}
        >
          <div className="lp-glow" />

          {/* ── Header ── */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'1.75rem' }}>
            <div style={{ position:'relative', width:72, height:72, marginBottom:'1.25rem', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div className="lp-logo-ring" />
              <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M14 3C9.5 3 6 7 6 11.5C6 16 9 19 14 25C19 19 22 16 22 11.5C22 7 18.5 3 14 3Z" fill="#4ade80" opacity="0.9"/>
                  <path d="M14 8C11.5 8 10 10 10 11.8C10 14 11.5 16 14 19C16.5 16 18 14 18 11.8C18 10 16.5 8 14 8Z" fill="#052e16" opacity="0.7"/>
                </svg>
              </div>
            </div>

            <div style={{ textAlign:'center' }}>
              <h1 style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:28, fontWeight:700, letterSpacing:'0.2em', color:'#e8fdf1', marginBottom:6 }}>
                SIMDBHCHT
              </h1>
              <div className="lp-title-underline" />
              <p style={{ fontSize:11, color:'#5a8a6a', letterSpacing:'0.05em', marginBottom:10 }}>
                Sistem Informasi DBH Cukai Hasil Tembakau
              </p>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(74,222,128,0.06)', border:'1px solid rgba(74,222,128,0.2)', borderRadius:20, padding:'3px 10px' }}>
                <span className="lp-badge-dot" />
                <span style={{ fontSize:10, color:'#4ade80', letterSpacing:'0.06em', fontFamily:"'Rajdhani',sans-serif", fontWeight:600 }}>
                  Kota Batu · Sistem Aktif
                </span>
              </div>
            </div>
          </div>

          {/* ── Divider ── */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'1.5rem' }}>
            <div className="lp-divider-line" />
            <span style={{ fontSize:9.5, color:'#3d6b4d', letterSpacing:'0.15em', fontFamily:"'Rajdhani',sans-serif", fontWeight:600 }}>
              AKSES SISTEM
            </span>
            <div className="lp-divider-line" />
          </div>

          {/* ── Form ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:'1.2rem', marginBottom:'1.25rem' }}>

            {/* Username */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <label style={{ fontSize:10.5, color:'#5a8a6a', letterSpacing:'0.1em', fontFamily:"'Rajdhani',sans-serif", fontWeight:700, textTransform:'uppercase', display:'flex', alignItems:'center', gap:5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                Username
              </label>
              <div style={{ position:'relative', borderRadius:8, border:'1px solid', transition:'all .2s', ...(focusedField === 'user' ? focusStyle : blurStyle) }}>
                <div style={{ position:'absolute', top:-1, left:-1, width:8, height:8, borderTop:'2px solid rgba(74,222,128,0.5)', borderLeft:'2px solid rgba(74,222,128,0.5)', borderRadius:'8px 0 0 0' }} />
                <div style={{ position:'absolute', bottom:-1, right:-1, width:8, height:8, borderBottom:'2px solid rgba(74,222,128,0.5)', borderRight:'2px solid rgba(74,222,128,0.5)', borderRadius:'0 0 8px 0' }} />
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

            {/* Password */}
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <label style={{ fontSize:10.5, color:'#5a8a6a', letterSpacing:'0.1em', fontFamily:"'Rajdhani',sans-serif", fontWeight:700, textTransform:'uppercase', display:'flex', alignItems:'center', gap:5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Password
              </label>
              <div style={{ position:'relative', borderRadius:8, border:'1px solid', transition:'all .2s', ...(focusedField === 'pass' ? focusStyle : blurStyle) }}>
                <div style={{ position:'absolute', top:-1, left:-1, width:8, height:8, borderTop:'2px solid rgba(74,222,128,0.5)', borderLeft:'2px solid rgba(74,222,128,0.5)', borderRadius:'8px 0 0 0' }} />
                <div style={{ position:'absolute', bottom:-1, right:-1, width:8, height:8, borderBottom:'2px solid rgba(74,222,128,0.5)', borderRight:'2px solid rgba(74,222,128,0.5)', borderRadius:'0 0 8px 0' }} />
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
                <button
                  type="button"
                  className="lp-eye-btn"
                  onClick={() => setShowPass(s => !s)}
                >
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div style={{ display:'flex', alignItems:'center', gap:7, color:'#fca5a5', fontSize:12, marginBottom:'1rem', padding:'8px 12px', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* ── Submit ── */}
          <button className="lp-submit" onClick={doLogin} disabled={loading} style={{ marginBottom:'1.25rem' }}>
            {loading ? (
              <>
                <span style={{ display:'inline-block', width:14, height:14, border:'2px solid rgba(74,222,128,0.3)', borderTopColor:'#4ade80', borderRadius:'50%', animation:'lp-spin .7s linear infinite' }} />
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

          {/* ── Info ── */}
          <div style={{ display:'flex', gap:10, background:'rgba(74,222,128,0.04)', border:'1px solid rgba(74,222,128,0.10)', borderRadius:8, padding:'12px 14px', marginBottom:'1.5rem' }}>
            <div style={{ flexShrink:0, marginTop:2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize:10.5, fontFamily:"'Rajdhani',sans-serif", fontWeight:700, color:'#4ade80', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>
                Cara Login
              </p>
              <p style={{ fontSize:11.5, color:'#4a7a5a', lineHeight:1.6 }}>
                Gunakan <strong style={{ color:'#4ade80' }}>username</strong> (bukan email) yang diberikan Sekretariat Tim Koordinasi. Lupa password? Hubungi Sekretariat untuk reset.
              </p>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <div style={{ width:3, height:3, borderRadius:'50%', background:'rgba(74,222,128,0.3)' }} />
            <span style={{ fontSize:10, color:'#2d4f38', letterSpacing:'0.12em', fontFamily:"'Rajdhani',sans-serif" }}>
              Tim Koordinasi DBH CHT · Kota Batu
            </span>
            <div style={{ width:3, height:3, borderRadius:'50%', background:'rgba(74,222,128,0.3)' }} />
          </div>
        </div>
      </div>
    </>
  )
}