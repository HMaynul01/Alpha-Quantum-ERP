// src/pages/SubscriptionPage.tsx — Alpha Quantum ERP v16
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Sub { plan: string; features: Record<string,unknown> }

const PLANS = [
  { key:'free',       label:'Free',       price:'SAR 0',   color:'#7c89ab', desc:'Up to 3 users · 1GB storage' },
  { key:'starter',    label:'Starter',    price:'SAR 199', color:'#3b82f6', desc:'Up to 10 users · HR · CRM' },
  { key:'business',   label:'Business',   price:'SAR 599', color:'#8b5cf6', desc:'Up to 50 users · Projects · Reports' },
  { key:'enterprise', label:'Enterprise', price:'Custom',  color:'#f59e0b', desc:'Unlimited · All features · API access' },
]

export default function SubscriptionPage() {
  const [sub, setSub] = useState<Sub | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ subscription: Sub }>('/subscription')
      .then(d => setSub(d.subscription))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-content"><div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner"/></div></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscription</h1>
          <p className="page-sub">Current plan: <strong style={{ color:'var(--blue)' }}>{sub?.plan || 'free'}</strong></p>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'1rem', marginBottom:'2rem' }}>
        {PLANS.map(p => (
          <div key={p.key} className="card"
            style={{ border:`2px solid ${sub?.plan===p.key?p.color:'var(--border)'}`, position:'relative', overflow:'hidden' }}>
            {sub?.plan === p.key && (
              <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:p.color }} />
            )}
            <div style={{ fontSize:'.7rem', fontWeight:700, color:p.color, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:'.5rem' }}>{p.label}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:700, color:'var(--text)', marginBottom:'.4rem' }}>{p.price}<span style={{ fontSize:'.8rem', fontWeight:400, color:'var(--text2)', fontFamily:'var(--font)' }}>/mo</span></div>
            <div style={{ fontSize:'.82rem', color:'var(--text2)', marginBottom:'1.25rem' }}>{p.desc}</div>
            {sub?.plan === p.key
              ? <div className="btn btn-sm w-full" style={{ background:p.color, color:'#fff', cursor:'default', justifyContent:'center' }}>✓ Current Plan</div>
              : <a href="mailto:erp@alpha-01.info?subject=Upgrade to ${p.label}" className="btn btn-secondary btn-sm w-full">Upgrade →</a>
            }
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom:'1rem' }}>Current Features</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'.5rem' }}>
          {sub?.features && Object.entries(sub.features).map(([k, v]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:'.5rem', padding:'.5rem .75rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', fontSize:'.83rem' }}>
              <span style={{ color:v?'var(--green)':'var(--rose)' }}>{v ? '✓' : '✗'}</span>
              <span style={{ color:'var(--text2)' }}>{k.replace(/_/g,' ')}</span>
              {typeof v === 'number' && <span style={{ marginLeft:'auto', color:'var(--blue)', fontWeight:600 }}>{v === -1 ? '∞' : v}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
