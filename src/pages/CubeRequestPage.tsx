// src/pages/CubeRequestPage.tsx — Alpha Quantum ERP v15
// Public page: Request a new Cube (tenant) from the Creator
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo-alpha.png'

export default function CubeRequestPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({
    company_name: '', admin_name: '', admin_email: '',
    admin_phone: '', plan: 'starter', message: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const plans = [
    { value:'free',       label:'Free',       desc:'3 users · 1GB', price:'Free' },
    { value:'starter',    label:'Starter',    desc:'10 users · 10GB', price:'SAR 299/mo' },
    { value:'business',   label:'Business',   desc:'50 users · 50GB', price:'SAR 899/mo' },
    { value:'enterprise', label:'Enterprise', desc:'Unlimited',        price:'SAR 2,499/mo' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api?r=cube%2Frequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Submission failed')
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--base)', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem 1rem' }}>
      <div style={{ width:'100%', maxWidth:520 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <img src={logoUrl} alt="Alpha" style={{ height:64, marginBottom:'1rem' }} onError={e=>(e.currentTarget.style.display='none')} />
          <h1 style={{ fontFamily:'var(--font-disp)', fontSize:'1.6rem', fontWeight:800, background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Request Your ERP Cube
          </h1>
          <p style={{ color:'var(--text2)', marginTop:'.5rem', fontSize:'.9rem' }}>
            Submit your request. Our team will create and activate your workspace.
          </p>
        </div>

        {success ? (
          <div style={{ background:'var(--card)', border:'1px solid var(--green)', borderRadius:'var(--radius-lg)', padding:'2rem', textAlign:'center' }}>
            <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
            <h2 style={{ color:'var(--green)', marginBottom:'.5rem' }}>Request Submitted!</h2>
            <p style={{ color:'var(--text2)', marginBottom:'1.5rem' }}>
              Your cube request has been sent to the Creator for review.<br/>
              You will receive your login credentials once approved.
            </p>
            <button onClick={() => nav('/login')} style={{ padding:'.6rem 1.5rem', background:'var(--blue)', color:'#fff', border:'none', borderRadius:'var(--radius)', cursor:'pointer', fontWeight:600 }}>
              Go to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'2rem', display:'flex', flexDirection:'column', gap:'1rem' }}>
            {error && <div style={{ background:'var(--rose-d)', border:'1px solid var(--rose)', borderRadius:'var(--radius)', padding:'.75rem', color:'var(--rose)', fontSize:'.85rem' }}>{error}</div>}

            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.4rem', fontWeight:600 }}>Company Name *</label>
              <input value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} required
                placeholder="Alpha Technologies Ltd."
                style={{ width:'100%', padding:'.65rem .85rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem' }} />
            </div>
            <div className="grid-2">
              <div>
                <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.4rem', fontWeight:600 }}>Admin Name *</label>
                <input value={form.admin_name} onChange={e=>setForm(f=>({...f,admin_name:e.target.value}))} required
                  placeholder="John Smith"
                  style={{ width:'100%', padding:'.65rem .85rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem' }} />
              </div>
              <div>
                <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.4rem', fontWeight:600 }}>WhatsApp / Phone</label>
                <input value={form.admin_phone} onChange={e=>setForm(f=>({...f,admin_phone:e.target.value}))}
                  placeholder="+966578695494"
                  style={{ width:'100%', padding:'.65rem .85rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem' }} />
              </div>
            </div>
            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.4rem', fontWeight:600 }}>Admin Email *</label>
              <input value={form.admin_email} onChange={e=>setForm(f=>({...f,admin_email:e.target.value}))} required type="email"
                placeholder="admin@yourcompany.com"
                style={{ width:'100%', padding:'.65rem .85rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem' }} />
            </div>

            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.6rem', fontWeight:600 }}>Subscription Plan</label>
              <div className="grid-2">
                {plans.map(p => (
                  <label key={p.value} style={{ display:'flex', flexDirection:'column', gap:'.2rem', padding:'.75rem', background: form.plan===p.value ? 'var(--blue-d)' : 'var(--input-bg)', border:`1px solid ${form.plan===p.value ? 'var(--blue)' : 'var(--border2)'}`, borderRadius:'var(--radius)', cursor:'pointer', transition:'all .2s' }}>
                    <input type="radio" name="plan" value={p.value} checked={form.plan===p.value} onChange={e=>setForm(f=>({...f,plan:e.target.value}))} style={{ display:'none' }} />
                    <span style={{ fontWeight:700, color:'var(--text)', fontSize:'.85rem' }}>{p.label}</span>
                    <span style={{ color:'var(--text2)', fontSize:'.75rem' }}>{p.desc}</span>
                    <span style={{ color:'var(--blue)', fontSize:'.8rem', fontWeight:600 }}>{p.price}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display:'block', color:'var(--text2)', fontSize:'.8rem', marginBottom:'.4rem', fontWeight:600 }}>Message / Notes</label>
              <textarea value={form.message} onChange={e=>setForm(f=>({...f,message:e.target.value}))} rows={3}
                placeholder="Any special requirements..."
                style={{ width:'100%', padding:'.65rem .85rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem', resize:'vertical', fontFamily:'var(--font)' }} />
            </div>

            <button type="submit" disabled={loading}
              style={{ padding:'.8rem', background:'linear-gradient(135deg,#3b82f6,#8b5cf6)', color:'#fff', border:'none', borderRadius:'var(--radius)', cursor:loading?'not-allowed':'pointer', fontWeight:700, fontSize:'1rem', opacity:loading?.7:1, transition:'opacity .2s' }}>
              {loading ? 'Submitting…' : '🚀 Submit Cube Request'}
            </button>

            <p style={{ textAlign:'center', color:'var(--text3)', fontSize:'.8rem' }}>
              Already have an account? <a href="/login" style={{ color:'var(--blue)' }}>Login here</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
