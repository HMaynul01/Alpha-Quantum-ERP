// src/pages/InvoicesPage.tsx — v18 Mobile-First
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Invoice {
  id: string; ref?: string; customer_name?: string
  grand_total?: number; total_amount?: number; subtotal?: number
  vat_amount?: number; status: string; created_by_name?: string
  created_at: string; due_date?: string; notes?: string
  items?: unknown[]
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-muted', pending: 'badge-amber', approved: 'badge-green',
  paid: 'badge-cyan', rejected: 'badge-rose',
}

export default function InvoicesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting,   setActing]   = useState<string | null>(null)
  const [comment,  setComment]  = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get<{ invoices: Invoice[] }>('/invoices')
      .then(d => { setInvoices(d.invoices || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function approve(id: string, action: 'approve' | 'reject') {
    setActing(id)
    try {
      await api.post('/invoices/approve', { invoice_id: id, action, note: comment })
      setComment(''); setExpanded(null); load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setActing(null) }
  }

  async function markPaid(id: string) {
    setActing(id)
    try {
      await api.patch(`/invoices/${id}`, { status: 'paid' })
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setActing(null) }
  }

  const sar = (n: number) => `SAR ${Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`

  const filtered = invoices.filter(inv => {
    const q = search.toLowerCase()
    const matchSearch = !q || (inv.customer_name || '').toLowerCase().includes(q) ||
      (inv.ref || '').toLowerCase().includes(q)
    const matchFilter = filter === 'all' || inv.status === filter
    return matchSearch && matchFilter
  })

  const totalRevenue = invoices.filter(i => ['paid','approved'].includes(i.status))
    .reduce((a, i) => a + (i.grand_total || i.total_amount || 0), 0)
  const pendingCount = invoices.filter(i => i.status === 'pending').length

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-sub">{invoices.length} records</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>+ New Invoice</button>
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Revenue',  value: sar(totalRevenue), icon: '💰', color: 'var(--green)' },
          { label: 'Pending',  value: pendingCount,      icon: '⏳', color: 'var(--amber)' },
          { label: 'Total',    value: invoices.length,   icon: '🧾', color: 'var(--blue)'  },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: typeof s.value === 'string' ? '1rem' : '1.5rem' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search invoices…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ width: 140 }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Status</option>
          {['draft','pending','approved','paid','rejected'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
      </div>

      {loading ? (
        <div className="loading-full"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <div className="empty-title">No invoices found</div>
          <div className="empty-desc">{search ? 'Try a different search' : 'Create your first invoice'}</div>
          {!search && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/invoices/new')}>+ New Invoice</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filtered.map(inv => {
            const amount = inv.grand_total || inv.total_amount || 0
            const isOpen = expanded === inv.id

            return (
              <div key={inv.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div onClick={() => setExpanded(isOpen ? null : inv.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.85rem 1rem', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--text3)' }}>{inv.ref || inv.id.slice(0,8)}</span>
                      <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-muted'}`}>{inv.status}</span>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inv.customer_name || 'Invoice'}
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: '.1rem' }}>
                      {inv.created_by_name || '—'} · {new Date(inv.created_at).toLocaleDateString('en-GB')}
                      {inv.due_date && ` · Due: ${new Date(inv.due_date).toLocaleDateString('en-GB')}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green-bright)', fontSize: '.9rem' }}>{sar(amount)}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.1rem' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)', padding: '1rem' }}>
                    {inv.notes && <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '.75rem' }}>{inv.notes}</div>}

                    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                      {su && inv.status === 'pending' && (
                        <>
                          <textarea className="input" rows={2} style={{ width: '100%', minHeight: 52, resize: 'none', marginBottom: '.5rem' }}
                            placeholder="Note (optional)…" value={comment} onChange={e => setComment(e.target.value)} />
                          <button className="btn btn-success" style={{ flex: 1 }} disabled={!!acting} onClick={() => approve(inv.id, 'approve')}>✅ Approve</button>
                          <button className="btn btn-danger"  style={{ flex: 1 }} disabled={!!acting} onClick={() => approve(inv.id, 'reject')}>❌ Reject</button>
                        </>
                      )}
                      {su && inv.status === 'approved' && (
                        <button className="btn btn-primary btn-sm" disabled={!!acting} onClick={() => markPaid(inv.id)}>💳 Mark Paid</button>
                      )}
                      {inv.status === 'draft' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/invoices/new`)}>✏️ Edit</button>
                      )}
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
