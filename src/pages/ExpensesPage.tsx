// src/pages/ExpensesPage.tsx — v18 Mobile-First
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Expense {
  id: string; ref?: string; title?: string; category?: string
  amount?: number; total_amount?: number; grand_total?: number; vat_amount?: number
  status: string; submitted_by_name?: string; created_at: string
  vendor?: string; description?: string; expense_date?: string
  approved_by_name?: string; approval_note?: string; approved_at?: string
  items?: unknown[]
}

const STATUS_BADGE: Record<string, string> = {
  pending:  'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-rose',
  draft:    'badge-muted',
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [filter,   setFilter]   = useState('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acting,   setActing]   = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string,string>>({})

  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get<{ expenses: Expense[] }>('/expenses')
      .then(d => { setExpenses(d.expenses || []); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function approve(id: string, action: 'approve' | 'reject') {
    setActing(id)
    try {
      await api.post('/expenses/approve', { expense_id: id, action, note: comments[id] || '' })
      setComments(p => { const n={...p}; delete n[id]; return n }); setExpanded(null); load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally { setActing(null) }
  }

  async function deleteExp(id: string) {
    if (!confirm('Delete this expense?')) return
    try {
      await api.delete(`/expenses/${id}`)
      setExpenses(p => p.filter(e => e.id !== id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const sar = (n: number) => `SAR ${Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || (e.title || '').toLowerCase().includes(q) ||
      (e.ref || '').toLowerCase().includes(q) || (e.submitted_by_name || '').toLowerCase().includes(q) ||
      (e.vendor || '').toLowerCase().includes(q)
    const matchFilter = filter === 'all' || e.status === filter
    return matchSearch && matchFilter
  })

  const totals = {
    total:    expenses.reduce((a, e) => a + (e.grand_total || e.total_amount || e.amount || 0), 0),
    pending:  expenses.filter(e => e.status === 'pending').length,
    approved: expenses.filter(e => e.status === 'approved').reduce((a, e) => a + (e.grand_total || e.total_amount || e.amount || 0), 0),
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="page-sub">{expenses.length} records</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>+ New Expense</button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Submitted',  value: sar(totals.total),    icon: '💰', color: 'var(--blue)' },
          { label: 'Approved Amount',  value: sar(totals.approved), icon: '✅', color: 'var(--green)' },
          { label: 'Pending Review',   value: totals.pending,       icon: '⏳', color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color, fontSize: typeof s.value === 'string' ? '1rem' : '1.5rem' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>⚠️ {error} <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>✕</button></div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search expenses…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ width: 140, flex: 'none' }} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
      </div>

      {loading ? (
        <div className="loading-full"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <div className="empty-title">No expenses found</div>
          <div className="empty-desc">{search ? 'Try a different search term' : 'Submit your first expense'}</div>
          {!search && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/expenses/new')}>+ New Expense</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
          {filtered.map(exp => {
            const amount  = exp.grand_total || exp.total_amount || exp.amount || 0
            const isOpen  = expanded === exp.id
            const canApprove = su && exp.status === 'pending'

            return (
              <div key={exp.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Row */}
                <div onClick={() => setExpanded(isOpen ? null : exp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.85rem 1rem', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '.4rem', marginBottom: '.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', color: 'var(--text3)' }}>{exp.ref || exp.id.slice(0,8)}</span>
                      <span className={`badge ${STATUS_BADGE[exp.status] || 'badge-muted'}`}>{exp.status}</span>
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {exp.title || exp.category || 'Expense'}
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--text2)', marginTop: '.1rem' }}>
                      {exp.submitted_by_name || 'You'} · {new Date(exp.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green-bright)', fontSize: '.9rem' }}>{sar(amount)}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.1rem' }}>{isOpen ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--card2)', padding: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', marginBottom: '.85rem' }}>
                      {exp.vendor      && <div className="data-pair"><span className="data-label">Vendor</span><span className="data-value">{exp.vendor}</span></div>}
                      {exp.category    && <div className="data-pair"><span className="data-label">Category</span><span className="data-value">{exp.category}</span></div>}
                      {exp.description && <div className="data-pair"><span className="data-label">Notes</span><span className="data-value">{exp.description}</span></div>}
                      {exp.vat_amount  && <div className="data-pair"><span className="data-label">VAT</span><span className="data-value">{sar(exp.vat_amount)}</span></div>}
                      {exp.approved_by_name && <div className="data-pair"><span className="data-label">Reviewed by</span><span className="data-value">{exp.approved_by_name}</span></div>}
                      {exp.approval_note && <div className="data-pair"><span className="data-label">Note</span><span className="data-value">{exp.approval_note}</span></div>}
                    </div>

                    {canApprove && (
                      <div>
                        <textarea className="input" rows={2} style={{ minHeight: 56, resize: 'none', marginBottom: '.6rem' }}
                          placeholder="Comment (optional)…"
                          value={acting === exp.id ? comment : (comment || '')}
                          onChange={e => setComment(e.target.value)} />
                        <div style={{ display: 'flex', gap: '.6rem' }}>
                          <button className="btn btn-success" style={{ flex: 1 }} disabled={!!acting} onClick={() => approve(exp.id, 'approve')}>
                            {acting === exp.id ? '⟳' : '✅'} Approve
                          </button>
                          <button className="btn btn-danger" style={{ flex: 1 }} disabled={!!acting} onClick={() => approve(exp.id, 'reject')}>
                            {acting === exp.id ? '⟳' : '❌'} Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {exp.status === 'draft' && (
                      <button className="btn btn-danger btn-sm" onClick={() => deleteExp(exp.id)}>🗑 Delete</button>
                    )}
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
