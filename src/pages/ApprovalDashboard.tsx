// src/pages/ApprovalDashboard.tsx — v18 Fixed & Mobile
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Item {
  id: string; ref?: string; title?: string
  customer_name?: string; submitted_by_name?: string; created_by_name?: string
  grand_total?: number; total_amount?: number; amount?: number
  status: string; created_at: string; notes?: string; category?: string
}
type Tab = 'expenses' | 'invoices'

export default function ApprovalDashboard() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [tab,     setTab]     = useState<Tab>('expenses')
  const [data,    setData]    = useState<{ expenses: Item[]; invoices: Item[] }>({ expenses: [], invoices: [] })
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [comment, setComment] = useState<Record<string, string>>({})
  const [acting,  setActing]  = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [expand,  setExpand]  = useState<string | null>(null)

  function load() {
    if (!su) { setLoading(false); return }
    setLoading(true); setError(''); setSuccess('')
    api.get<{ expenses: Item[]; invoices: Item[] }>('/approvals')
      .then(d => { setData({ expenses: d.expenses || [], invoices: d.invoices || [] }); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [su]) // eslint-disable-line

  async function act(id: string, type: Tab, action: 'approve' | 'reject') {
    setActing(id); setError(''); setSuccess('')
    try {
      const note = comment[id] || ''
      if (type === 'expenses') {
        await api.post('/expenses/approve', { expense_id: id, action, note })
      } else {
        await api.post('/invoices/approve', { invoice_id: id, action, note })
      }
      setSuccess(`${action === 'approve' ? '✅ Approved' : '❌ Rejected'} successfully`)
      setComment(c => { const x = { ...c }; delete x[id]; return x })
      setExpand(null)
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally { setActing(null) }
  }

  const sar = (n: number) => `SAR ${Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`
  const items = tab === 'expenses' ? data.expenses : data.invoices

  if (!su) return (
    <div className="page-content">
      <div className="empty-state">
        <div className="empty-icon">🔐</div>
        <div className="empty-title">Access Restricted</div>
        <div className="empty-desc">Only admins can access approvals.</div>
      </div>
    </div>
  )

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="page-sub">Review and approve pending submissions</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* Summary */}
      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Pending Expenses', value: data.expenses.length, color: 'var(--amber)', icon: '💰', tab: 'expenses' as Tab },
          { label: 'Pending Invoices', value: data.invoices.length, color: 'var(--blue)', icon: '🧾', tab: 'invoices' as Tab },
        ].map(s => (
          <div key={s.tab} className="stat-card" onClick={() => setTab(s.tab)}
            style={{ borderColor: tab === s.tab ? s.color : undefined, cursor: 'pointer' }}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error   && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{success}</div>}

      {/* Tabs */}
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'expenses' ? ' active' : ''}`} onClick={() => setTab('expenses')}>
          💰 Expenses {data.expenses.length > 0 && <span className="badge badge-amber">{data.expenses.length}</span>}
        </button>
        <button className={`tab-btn${tab === 'invoices' ? ' active' : ''}`} onClick={() => setTab('invoices')}>
          🧾 Invoices {data.invoices.length > 0 && <span className="badge badge-blue">{data.invoices.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="loading-full"><div className="spinner" /><span style={{ color: 'var(--text2)', fontSize: '.85rem' }}>Loading…</span></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">All Clear!</div>
          <div className="empty-desc">No pending {tab} to approve.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
          {items.map(item => {
            const amount = item.grand_total || item.total_amount || item.amount || 0
            const name   = item.submitted_by_name || item.created_by_name || '—'
            const ref    = item.ref || item.id.slice(0, 8)
            const isOpen = expand === item.id

            return (
              <div key={item.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row — tap to expand */}
                <div onClick={() => setExpand(isOpen ? null : item.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap', marginBottom: '.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.75rem', color: 'var(--blue-bright)', fontWeight: 600 }}>{ref}</span>
                      <span className="badge badge-amber">Pending</span>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title || item.customer_name || name}
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text2)', marginTop: '.15rem' }}>
                      by {name} · {new Date(item.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green-bright)', fontSize: '.9rem' }}>{sar(amount)}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--text3)', marginTop: '.1rem' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded actions */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1rem', background: 'var(--card2)' }}>
                    {item.category && (
                      <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '.75rem' }}>
                        Category: <strong style={{ color: 'var(--text)' }}>{item.category}</strong>
                        {item.notes && <> · Notes: <em>{item.notes}</em></>}
                      </div>
                    )}
                    <div style={{ marginBottom: '.75rem' }}>
                      <label className="label">Comment (optional)</label>
                      <textarea className="input" rows={2} style={{ minHeight: 60, resize: 'none' }}
                        placeholder="Add a note for the submitter..."
                        value={comment[item.id] || ''}
                        onChange={e => setComment(c => ({ ...c, [item.id]: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: '.75rem' }}>
                      <button className="btn btn-success" style={{ flex: 1 }}
                        disabled={acting === item.id}
                        onClick={() => act(item.id, tab, 'approve')}>
                        {acting === item.id ? '⟳' : '✅'} Approve
                      </button>
                      <button className="btn btn-danger" style={{ flex: 1 }}
                        disabled={acting === item.id}
                        onClick={() => act(item.id, tab, 'reject')}>
                        {acting === item.id ? '⟳' : '❌'} Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
