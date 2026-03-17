// src/pages/WalletPage.tsx — Alpha Quantum ERP v16
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface WalletRow {
  user_id: string; full_name: string
  total_expenses: number; total_invoiced: number; balance: number
}

export default function WalletPage() {
  const { user } = useAuth()
  const [wallets,  setWallets]  = useState<WalletRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    api.get<{ wallets: WalletRow[] }>('/reports/wallet')
      .then(d => setWallets(d.wallets ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sar = (n: number) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2,maximumFractionDigits:2})}`

  const myWallet = wallets.find(w => w.user_id === user?.id)
  const totals = wallets.reduce((acc, w) => ({
    invoiced: acc.invoiced + w.total_invoiced,
    expenses: acc.expenses + w.total_expenses,
    balance:  acc.balance  + w.balance,
  }), { invoiced:0, expenses:0, balance:0 })

  if (loading) return <div className="page-content"><div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner"/></div></div>
  if (error)   return <div className="page-content"><div className="alert alert-error">{error}</div></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallet</h1>
          <p className="page-sub">Financial summary by user</p>
        </div>
      </div>

      {/* My wallet highlight */}
      {myWallet && (
        <div className="card" style={{ marginBottom:'1.5rem', background:'linear-gradient(135deg,rgba(59,130,246,.08),rgba(139,92,246,.08))', border:'1px solid rgba(59,130,246,.2)' }}>
          <div style={{ fontSize:'.72rem', fontFamily:'var(--font-mono)', color:'var(--blue)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:'.5rem' }}>My Wallet</div>
          <div className="grid-3">
            {[
              { label:'Invoiced',  val:myWallet.total_invoiced, color:'var(--green)' },
              { label:'Expenses',  val:myWallet.total_expenses, color:'var(--rose)' },
              { label:'Balance',   val:myWallet.balance, color:myWallet.balance>=0?'var(--green)':'var(--rose)' },
            ].map((s,i) => (
              <div key={i} style={{ textAlign:'center' }}>
                <div style={{ fontSize:'.7rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.3rem' }}>{s.label}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.4rem', fontWeight:700, color:s.color }}>{sar(s.val)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="stat-grid" style={{ marginBottom:'1.5rem' }}>
        {[
          { label:'Total Invoiced',  value:totals.invoiced, color:'#10b981', icon:'🧾' },
          { label:'Total Expenses',  value:totals.expenses, color:'#f43f5e', icon:'💰' },
          { label:'Net Balance',     value:totals.balance,  color:totals.balance>=0?'#10b981':'#f43f5e', icon:'💳' },
          { label:'Users',           value:wallets.length,  color:'#3b82f6', icon:'👥', isCount:true },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ '--accent':s.color } as React.CSSProperties}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color:s.color, fontSize:s.isCount?'2rem':'1.2rem' }}>
              {s.isCount ? s.value : sar(s.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div className="card-title">All Users</div>
          <span style={{ fontSize:'.78rem', color:'var(--text2)' }}>{wallets.length} users</span>
        </div>
        <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Total Invoiced</th>
                <th>Total Expenses</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {wallets.length === 0 ? (
                <tr><td colSpan={4} className="table-empty">No wallet data found</td></tr>
              ) : wallets.map(w => (
                <tr key={w.user_id} style={{ background: w.user_id === user?.id ? 'var(--blue-d)' : '' }}>
                  <td>
                    <div style={{ fontWeight:600, color:'var(--text)' }}>{w.full_name}</div>
                    {w.user_id === user?.id && <span className="badge badge-draft" style={{ marginTop:'.2rem' }}>You</span>}
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', color:'var(--green)', fontWeight:600 }}>{sar(w.total_invoiced)}</td>
                  <td style={{ fontFamily:'var(--font-mono)', color:'var(--rose)',  fontWeight:600 }}>{sar(w.total_expenses)}</td>
                  <td style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:w.balance>=0?'var(--green)':'var(--rose)' }}>{sar(w.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
