// src/pages/LoginPage.tsx — Alpha Quantum ERP v16
import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import logoUrl from '../assets/logo-alpha.png'

export default function LoginPage() {
  const { login }              = useAuth()
  const navigate               = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Please enter username and password.')
      return
    }
    setError(''); setLoading(true)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem', position:'relative', overflow:'hidden' }}>
      {/* Background glows */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
        <div style={{ position:'absolute', width:700, height:700, borderRadius:'50%', background:'radial-gradient(circle,rgba(59,130,246,.06) 0%,transparent 65%)', top:-200, left:-150 }} />
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.05) 0%,transparent 65%)', bottom:-150, right:-100 }} />
        {/* Grid pattern */}
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
      </div>

      {/* Theme toggle */}
      <button onClick={toggleTheme}
        style={{ position:'absolute', top:'1.5rem', right:'1.5rem', background:'var(--card)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', padding:'.4rem .8rem', color:'var(--text2)', cursor:'pointer', fontSize:'.85rem', zIndex:10 }}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div style={{ width:'100%', maxWidth:420, position:'relative', zIndex:1 }}>
        {/* Logo + Title */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ position:'relative', display:'inline-block', marginBottom:'1.25rem' }}>
            <div style={{ position:'absolute', inset:-4, borderRadius:20, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', opacity:.4, filter:'blur(8px)' }} />
            <img src={logoUrl} alt="Alpha Quantum ERP"
              style={{ width:80, height:80, borderRadius:16, objectFit:'cover', position:'relative', zIndex:1, display:'block' }}
              onError={e => {
                e.currentTarget.style.display = 'none'
                const p = e.currentTarget.parentElement
                if (p) {
                  const fb = document.createElement('div')
                  fb.style.cssText = 'width:80px;height:80px;border-radius:16px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;color:#fff;position:relative;z-index:1'
                  fb.textContent = 'AQ'
                  p.appendChild(fb)
                }
              }} />
          </div>
          <h1 style={{ fontFamily:'var(--font-disp)', fontSize:'1.8rem', fontWeight:900, color:'var(--text)', margin:'0 0 .25rem', letterSpacing:'-.02em' }}>
            Alpha Quantum ERP
          </h1>
          <p style={{ fontFamily:'var(--font-mono)', fontSize:'.65rem', color:'var(--blue)', letterSpacing:'.18em', textTransform:'uppercase', opacity:.8 }}>
            erp.alpha-01.info · v18
          </p>
        </div>

        {/* Card */}
        <div style={{ background:'var(--card)', border:'1px solid var(--border2)', borderRadius:'var(--radius-xl)', padding:'2rem', boxShadow:'var(--shadow-lg)' }}>
          <h2 style={{ fontFamily:'var(--font-disp)', fontSize:'1rem', fontWeight:700, color:'var(--text)', margin:'0 0 1.5rem' }}>
            Sign in to your account
          </h2>

          {error && (
            <div className="alert alert-error" style={{ marginBottom:'1.1rem' }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="maynulshaon"
                autoFocus
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div style={{ position:'relative' }}>
                <input
                  className="input"
                  style={{ paddingRight:'2.8rem' }}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  disabled={loading}
                  style={{ position:'absolute', right:'.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'.9rem', padding:'.2rem', lineHeight:1 }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop:'.25rem', padding:'.85rem', background:'linear-gradient(135deg,#3b82f6,#7c3aed)', color:'#fff', border:'none', borderRadius:'var(--radius)', fontWeight:700, fontSize:'1rem', cursor:loading?'not-allowed':'pointer', opacity:loading?.65:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', boxShadow:'0 4px 16px rgba(59,130,246,.3)', transition:'all .15s' }}>
              {loading
                ? <><div className="spinner" style={{ width:18, height:18, borderWidth:2 }} /> Signing in…</>
                : '→ Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign:'center', marginTop:'1.25rem', fontSize:'.79rem', color:'var(--text3)' }}>
          New business?{' '}
          <a href="/request-cube" style={{ color:'var(--blue)', fontWeight:600 }}>Request a Cube →</a>
        </div>
        <div style={{ textAlign:'center', marginTop:'.4rem', fontSize:'.7rem', color:'var(--text3)' }}>
          © {new Date().getFullYear()} Alpha Ultimate Ltd. · Beyond The Every Limit
        </div>
      </div>
    </div>
  )
}
