// src/pages/LiabilitiesPage.tsx — Full Liabilities Module
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import CameraUploadForm from '../components/erp/CameraUploadForm'

interface Liability {
  id: string; liability_number: string; type: string; lender_supplier: string
  project_branch: string; principal: number; interest_rate: number
  start_date: string; maturity_date: string; installment_amt: number
  frequency: string; status: string; notes: string; media_urls: string[]
  submitted_at: string; submitted_by_name?: string
}

const TYPE_ICONS: Record<string, string> = { bank_loan: '🏦', supplier_credit: '📦', lease: '🔑', other: '📋' }
const STATUS_COLORS: Record<string, string> = { active: '#00ffb3', settled: '#4f8cff', overdue: '#ff3cac', restructured: '#ffe135' }

export default function LiabilitiesPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Liability | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get<{ liabilities: Liability[] }>('/liabilities')
      .then(d => setLiabilities(d.liabilities))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = liabilities.filter(l => {
    const q = search.toLowerCase()
    const matchQ = !q || l.lender_supplier.toLowerCase().includes(q) || l.liability_number.toLowerCase().includes(q)
    const matchS = filterStatus === 'all' || l.status === filterStatus
    return matchQ && matchS
  })

  const totalActive = liabilities.filter(l => l.status === 'active').reduce((s, l) => s + Number(l.principal), 0)
  const overdue = liabilities.filter(l => l.status === 'overdue').length

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
          <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', margin: 0 }}>🏦 Liabilities</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>
            Total Active: SAR {totalActive.toLocaleString('en-SA', { minimumFractionDigits: 2 })} · {overdue > 0 ? <span style={{ color: '#ff3cac' }}>⚠️ {overdue} OVERDUE</span> : 'All current'}
          </div>
        </div>
        {su && <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '0.85rem' }}>+ Add Liability</button>}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
        {[
          { label: 'Active', val: liabilities.filter(l => l.status === 'active').length, color: '#00ffb3' },
          { label: 'Settled', val: liabilities.filter(l => l.status === 'settled').length, color: '#4f8cff' },
          { label: 'Overdue', val: liabilities.filter(l => l.status === 'overdue').length, color: '#ff3cac' },
          { label: 'Restructured', val: liabilities.filter(l => l.status === 'restructured').length, color: '#ffe135' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: `1px solid ${s.color}33`, borderRadius: 10, padding: '0.7rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search liabilities..."
          style={{ flex: 1, minWidth: 160, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select" style={{ fontSize: '0.8rem' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="settled">Settled</option>
          <option value="overdue">Overdue</option>
          <option value="restructured">Restructured</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>No liabilities found</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: '0.8rem' }}>
          {filtered.map(lib => {
            const monthlyPayment = Number(lib.installment_amt)
            return (
              <div key={lib.id} onClick={() => setSelected(lib)}
                style={{
                  background: 'var(--card)', border: `1px solid ${STATUS_COLORS[lib.status] || 'var(--border)'}33`,
                  borderRadius: 12, padding: '1rem', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{TYPE_ICONS[lib.type] || '📋'}</span>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.58rem', fontFamily: 'var(--font-mono)',
                    background: `${STATUS_COLORS[lib.status]}22`, color: STATUS_COLORS[lib.status],
                    border: `1px solid ${STATUS_COLORS[lib.status]}44`,
                  }}>{lib.status.toUpperCase()}</span>
                </div>
                <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{lib.lender_supplier}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--muted)', marginBottom: '0.6rem' }}>{lib.liability_number} · {lib.type?.replace(/_/g, ' ')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>PRINCIPAL</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ff3cac', fontFamily: 'var(--font-mono)' }}>SAR {Number(lib.principal).toLocaleString('en-SA', { minimumFractionDigits: 2 })}</div>
                  </div>
                  {monthlyPayment > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>INSTALLMENT</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>SAR {monthlyPayment.toLocaleString('en-SA', { minimumFractionDigits: 2 })}</div>
                    </div>
                  )}
                </div>
                {Number(lib.interest_rate) > 0 && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                    Interest: {lib.interest_rate}% · {lib.frequency}
                  </div>
                )}
                {lib.maturity_date && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                    📅 Maturity: {new Date(lib.maturity_date).toLocaleDateString('en-GB')}
                  </div>
                )}
                <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Tap to view details →</div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <LiabilityDetailModal liability={selected} onClose={() => setSelected(null)} />}
      {showForm && <LiabilityFormModal onClose={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function LiabilityDetailModal({ liability: lib, onClose }: { liability: Liability; onClose: () => void }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ padding: '1.2rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,60,172,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem' }}>{TYPE_ICONS[lib.type] || '📋'}</span>
            <div>
              <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', margin: 0 }}>{lib.lender_supplier}</h2>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#ff3cac' }}>{lib.liability_number}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.4rem' }}>✕</button>
        </div>
        <div style={{ padding: '1.2rem 1.4rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.6rem', marginBottom: '1rem' }}>
            {[
              { label: 'Principal', val: `SAR ${Number(lib.principal).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`, color: '#ff3cac' },
              { label: 'Interest Rate', val: `${lib.interest_rate}%`, color: '#ffe135' },
              { label: 'Installment', val: `SAR ${Number(lib.installment_amt).toLocaleString('en-SA', { minimumFractionDigits: 2 })}`, color: 'var(--blue)' },
            ].map(f => (
              <div key={f.label} style={{ background: `${f.color}11`, border: `1px solid ${f.color}33`, borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: f.color, fontFamily: 'var(--font-mono)' }}>{f.val}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '1rem' }}>
            {[
              { label: 'Type', val: lib.type?.replace(/_/g, ' ') },
              { label: 'Status', val: lib.status, color: STATUS_COLORS[lib.status] },
              { label: 'Frequency', val: lib.frequency },
              { label: 'Project / Branch', val: lib.project_branch || '—' },
              { label: 'Start Date', val: lib.start_date ? new Date(lib.start_date).toLocaleDateString('en-GB') : '—' },
              { label: 'Maturity Date', val: lib.maturity_date ? new Date(lib.maturity_date).toLocaleDateString('en-GB') : '—' },
              { label: 'Submitted At', val: new Date(lib.submitted_at).toLocaleString('en-GB') },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.15rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.82rem', color: f.color || 'var(--text)', fontWeight: 600 }}>{f.val}</div>
              </div>
            ))}
          </div>
          {lib.notes && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>NOTES</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{lib.notes}</div>
            </div>
          )}
          {lib.media_urls?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>ATTACHMENTS ({lib.media_urls.length})</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {lib.media_urls.map((u, i) => (
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

function LiabilityFormModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    type: 'bank_loan', lender_supplier: '', project_branch: '', principal: '',
    interest_rate: '', start_date: '', maturity_date: '', installment_amt: '',
    frequency: 'monthly', status: 'active', notes: '',
  })
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async () => {
    if (!form.lender_supplier.trim()) return setErr('Lender/Supplier name is required')
    if (!form.principal) return setErr('Principal amount is required')
    setSaving(true); setErr('')
    try {
      await api.post('/liabilities', { ...form, media_urls: mediaUrls })
      onClose()
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)' }}>
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', margin: 0 }}>🏦 Add Liability</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
        </div>
        <div style={{ padding: '1.2rem 1.3rem' }}>
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
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => f('type', e.target.value)}>
                <option value="bank_loan">🏦 Bank Loan</option>
                <option value="supplier_credit">📦 Supplier Credit</option>
                <option value="lease">🔑 Lease</option>
                <option value="other">📋 Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => f('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="settled">Settled</option>
                <option value="overdue">Overdue</option>
                <option value="restructured">Restructured</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Lender / Supplier *</label>
              <input className="form-input" value={form.lender_supplier} onChange={e => f('lender_supplier', e.target.value)} placeholder="Bank or supplier name" />
            </div>
            <div>
              <label className="form-label">Principal Amount (SAR) *</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.principal} onChange={e => f('principal', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Interest Rate (%)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => f('interest_rate', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Installment Amount (SAR)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.installment_amt} onChange={e => f('installment_amt', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Payment Frequency</label>
              <select className="form-select" value={form.frequency} onChange={e => f('frequency', e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One Time</option>
              </select>
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Maturity Date</label>
              <input className="form-input" type="date" value={form.maturity_date} onChange={e => f('maturity_date', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Project / Branch</label>
              <input className="form-input" value={form.project_branch} onChange={e => f('project_branch', e.target.value)} placeholder="Associated project or branch" />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={form.notes} onChange={e => f('notes', e.target.value)} rows={3} style={{ resize: 'vertical' }} placeholder="Loan agreement terms, conditions..." />
            </div>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Attachments (Loan Agreement, Payment Schedule)</label>
            <CameraUploadForm onUploaded={files => setMediaUrls(p => [...p, ...files.map(f => f.url)])} entityType="liabilities" />
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
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : '✓ Add Liability'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
