// src/pages/InvestmentsPage.tsx — Full Investments Module
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import CameraUploadForm from '../components/erp/CameraUploadForm'

interface Investment {
  id: string; investment_number: string; title: string; type: string
  project_branch: string; start_date: string; end_date: string
  principal: number; currency: string; expected_roi_pct: number
  payment_frequency: string; risk_level: string; investor_name: string
  investor_contact: string; status: string; notes: string; media_urls: string[]
  submitted_at: string; submitted_by_name?: string
}

const TYPE_ICONS: Record<string, string> = {
  equity: '📈', loan: '🏦', bond: '📄', real_estate: '🏠', other: '💼'
}

const RISK_COLORS: Record<string, string> = {
  low: '#00ffb3', medium: '#ffe135', high: '#ff3cac'
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#8b86c8', active: '#00ffb3', closed: '#4f8cff', on_hold: '#ffe135', written_off: '#ff3cac'
}

export default function InvestmentsPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Investment | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get<{ investments: Investment[] }>('/investments')
      .then(d => setInvestments(d.investments))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = investments.filter(inv => {
    const q = search.toLowerCase()
    const matchQ = !q || inv.title.toLowerCase().includes(q) || inv.investor_name?.toLowerCase().includes(q) || inv.investment_number.toLowerCase().includes(q)
    const matchS = filterStatus === 'all' || inv.status === filterStatus
    return matchQ && matchS
  })

  const totalPrincipal = investments.filter(i => i.status === 'active').reduce((s, i) => s + Number(i.principal), 0)

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', margin: 0 }}>
            📈 Investments
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>
            {investments.filter(i => i.status === 'active').length} active · Total Active Principal: SAR {totalPrincipal.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
          </div>
        </div>
        {su && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '0.85rem' }}>
            + New Investment
          </button>
        )}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
        {[
          { label: 'Active', val: investments.filter(i => i.status === 'active').length, color: '#00ffb3' },
          { label: 'Draft', val: investments.filter(i => i.status === 'draft').length, color: '#8b86c8' },
          { label: 'Closed', val: investments.filter(i => i.status === 'closed').length, color: '#4f8cff' },
          { label: 'On Hold', val: investments.filter(i => i.status === 'on_hold').length, color: '#ffe135' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: `1px solid ${s.color}33`, borderRadius: 10, padding: '0.7rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search investments..."
          style={{ flex: 1, minWidth: 160, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select" style={{ fontSize: '0.8rem' }}>
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="on_hold">On Hold</option>
          <option value="written_off">Written Off</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>No investments found</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '0.8rem' }}>
          {filtered.map(inv => {
            const roi = Number(inv.expected_roi_pct)
            const annual = Number(inv.principal) * roi / 100
            return (
              <div key={inv.id} onClick={() => setSelected(inv)}
                style={{
                  background: 'var(--card)', border: `1px solid ${STATUS_COLORS[inv.status] || 'var(--border)'}33`,
                  borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${STATUS_COLORS[inv.status]}22` }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderRadius: '0 12px 0 60px', background: `${STATUS_COLORS[inv.status] || '#4f8cff'}11` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{TYPE_ICONS[inv.type] || '💼'}</span>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.58rem', fontFamily: 'var(--font-mono)',
                    background: `${STATUS_COLORS[inv.status]}22`, color: STATUS_COLORS[inv.status],
                    border: `1px solid ${STATUS_COLORS[inv.status]}44`,
                  }}>{inv.status.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{inv.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>{inv.investment_number}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>PRINCIPAL</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
                      {inv.currency} {Number(inv.principal).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>EXPECTED ROI</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#00ffb3', fontFamily: 'var(--font-mono)' }}>
                      {roi}% / yr
                    </div>
                  </div>
                </div>
                {inv.investor_name && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>👤 {inv.investor_name}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '0.1rem 0.4rem', borderRadius: 12, fontSize: '0.58rem', fontFamily: 'var(--font-mono)',
                    background: `${RISK_COLORS[inv.risk_level]}22`, color: RISK_COLORS[inv.risk_level],
                  }}>
                    {inv.risk_level?.toUpperCase()} RISK
                  </span>
                  {annual > 0 && <span style={{ fontSize: '0.65rem', color: '#00ffb3', fontFamily: 'var(--font-mono)' }}>
                    +SAR {annual.toLocaleString('en-SA', { minimumFractionDigits: 0 })} /yr
                  </span>}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Tap to view details →</div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <InvestmentDetailModal investment={selected} onClose={() => setSelected(null)} su={su} />}
      {showForm && <InvestmentFormModal onClose={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function InvestmentDetailModal({ investment: inv, onClose, su }: { investment: Investment; onClose: () => void; su: boolean }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const roi = Number(inv.expected_roi_pct)
  const annual = Number(inv.principal) * roi / 100

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '1.2rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(79,140,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>{TYPE_ICONS[inv.type] || '💼'}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', margin: 0 }}>{inv.title}</h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--blue)' }}>{inv.investment_number}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.4rem' }}>✕</button>
        </div>
        <div style={{ padding: '1.2rem 1.4rem' }}>
          {/* Financial highlight */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
            {[
              { label: 'Principal', val: `${inv.currency} ${Number(inv.principal).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`, color: 'var(--blue)' },
              { label: 'Expected ROI', val: `${roi}% / year`, color: '#00ffb3' },
              { label: 'Annual Return', val: `${inv.currency} ${annual.toLocaleString('en-SA', { minimumFractionDigits: 2 })}`, color: '#ffe135' },
            ].map(f => (
              <div key={f.label} style={{ background: `${f.color}11`, border: `1px solid ${f.color}33`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: f.color, fontFamily: 'var(--font-mono)' }}>{f.val}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '1rem' }}>
            {[
              { label: 'Type', val: inv.type?.replace(/_/g, ' ') },
              { label: 'Status', val: inv.status?.replace(/_/g, ' '), color: STATUS_COLORS[inv.status] },
              { label: 'Risk Level', val: inv.risk_level?.toUpperCase(), color: RISK_COLORS[inv.risk_level] },
              { label: 'Payment Frequency', val: inv.payment_frequency?.replace(/_/g, ' ') },
              { label: 'Investor Name', val: inv.investor_name || '—' },
              { label: 'Investor Contact', val: inv.investor_contact || '—' },
              { label: 'Project / Branch', val: inv.project_branch || '—' },
              { label: 'Currency', val: inv.currency || 'SAR' },
              { label: 'Start Date', val: inv.start_date ? new Date(inv.start_date).toLocaleDateString('en-GB') : '—' },
              { label: 'End Date', val: inv.end_date ? new Date(inv.end_date).toLocaleDateString('en-GB') : '—' },
              { label: 'Submitted By', val: inv.submitted_by_name || '—' },
              { label: 'Submitted At', val: new Date(inv.submitted_at).toLocaleString('en-GB') },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.15rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.82rem', color: f.color || 'var(--text)', fontWeight: 600 }}>{f.val}</div>
              </div>
            ))}
          </div>

          {inv.notes && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>NOTES</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{inv.notes}</div>
            </div>
          )}

          {inv.media_urls?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>ATTACHMENTS ({inv.media_urls.length})</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {inv.media_urls.map((u, i) => (
                  <img key={i} src={u} alt="" onClick={() => setLightboxUrl(u)}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {lightboxUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
    </div>
  )
}

function InvestmentFormModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    title: '', type: 'equity', project_branch: '', start_date: '', end_date: '',
    principal: '', currency: 'SAR', expected_roi_pct: '', payment_frequency: 'yearly',
    risk_level: 'medium', investor_name: '', investor_contact: '', status: 'draft', notes: '',
  })
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim()) return setErr('Title is required')
    if (!form.principal) return setErr('Principal amount is required')
    setSaving(true)
    setErr('')
    try {
      await api.post('/investments', { ...form, media_urls: mediaUrls })
      onClose()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)' }}>
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', margin: 0 }}>📈 New Investment</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
        </div>
        <div style={{ padding: '1.2rem 1.3rem' }}>
          {/* Auto-filled */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.8rem', background: 'rgba(79,140,255,0.04)', borderRadius: 8, padding: '0.75rem', border: '1px solid rgba(79,140,255,0.15)' }}>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>SUBMITTED BY</label>
              <input value={user?.full_name || ''} disabled style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: '0.8rem', cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>DATE</label>
              <input value={new Date().toLocaleString('en-GB')} disabled style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: '0.8rem', cursor: 'not-allowed' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Investment Title *</label>
              <input className="form-input" value={form.title} onChange={e => f('title', e.target.value)} placeholder="e.g. Riyadh Commercial Tower Project" />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => f('type', e.target.value)}>
                <option value="equity">📈 Equity</option>
                <option value="loan">🏦 Loan</option>
                <option value="bond">📄 Bond</option>
                <option value="real_estate">🏠 Real Estate</option>
                <option value="other">💼 Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => f('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="on_hold">On Hold</option>
                <option value="written_off">Written Off</option>
              </select>
            </div>
            <div>
              <label className="form-label">Principal Amount *</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.principal} onChange={e => f('principal', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Currency</label>
              <select className="form-select" value={form.currency} onChange={e => f('currency', e.target.value)}>
                <option value="SAR">SAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="AED">AED</option>
              </select>
            </div>
            <div>
              <label className="form-label">Expected ROI (%/year)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.expected_roi_pct} onChange={e => f('expected_roi_pct', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Payment Frequency</label>
              <select className="form-select" value={form.payment_frequency} onChange={e => f('payment_frequency', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="form-label">Risk Level</label>
              <select className="form-select" value={form.risk_level} onChange={e => f('risk_level', e.target.value)}>
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">End / Maturity Date</label>
              <input className="form-input" type="date" value={form.end_date} onChange={e => f('end_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Investor Name</label>
              <input className="form-input" value={form.investor_name} onChange={e => f('investor_name', e.target.value)} placeholder="Investor full name" />
            </div>
            <div>
              <label className="form-label">Investor Contact</label>
              <input className="form-input" value={form.investor_contact} onChange={e => f('investor_contact', e.target.value)} placeholder="Phone / Email" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Project / Branch</label>
              <input className="form-input" value={form.project_branch} onChange={e => f('project_branch', e.target.value)} placeholder="Associated project or branch" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={form.notes} onChange={e => f('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Terms, conditions, additional info..." />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Attachments (Contracts, Agreements, Bank Slips)</label>
            <CameraUploadForm onUploaded={files => setMediaUrls(p => [...p, ...files.map(f => f.url)])} entityType="investments" />
            {mediaUrls.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {mediaUrls.map((u, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={u} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                    <button onClick={() => setMediaUrls(p => p.filter((_, j) => j !== i))}
                      style={{ position: 'absolute', top: -4, right: -4, background: 'var(--rose)', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: '0.55rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {err && <div className="alert-error" style={{ marginTop: '0.75rem' }}>{err}</div>}
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.2rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : '✓ Add Investment'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
