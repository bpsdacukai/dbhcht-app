import { useState } from 'react'
import { signInWithUsername } from '../lib/supabase.js'

export default function Login() {
  const [username, setUsername] = useState('')
  const [pass,     setPass]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

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

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ fontSize: '2.5rem', marginBottom: '.4rem' }}>🌿</div>
          <h1>SIMDBHCHT</h1>
          <p>Sistem Informasi DBH Cukai Hasil Tembakau</p>
        </div>

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            placeholder="Contoh: sekretariat"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doLogin()}
            autoFocus autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-control"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
              autoComplete="current-password"
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:'.9rem', color:'var(--text2)' }}
            >{showPass ? '🙈' : '👁️'}</button>
          </div>
        </div>

        {error && <div className="error-msg">⚠️ {error}</div>}

        <button
          className="btn btn-primary w-full"
          style={{ padding: '9px', fontSize: '.9rem' }}
          onClick={doLogin}
          disabled={loading}
        >
          {loading ? '⏳ Memproses...' : 'Masuk →'}
        </button>

        <hr className="divider" />
        <div style={{ fontSize: '.72rem', color: 'var(--text2)', lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '.2rem' }}>
            ℹ️ Cara Login:
          </strong>
          Masukkan <strong>username</strong> (bukan email) yang diberikan oleh Sekretariat Tim Koordinasi.
          <br />
          Lupa password? Hubungi Sekretariat untuk reset.
        </div>
      </div>
    </div>
  )
}
