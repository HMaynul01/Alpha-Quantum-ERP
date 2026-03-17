// src/pages/AssetsPage.tsx — Full Assets Module
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import CameraUploadForm from '../components/erp/CameraUploadForm'

interface Asset {
  id: string; asset_number: string; name: string; category: string
  location: string; project_branch: string; purchase_date: string
  purchase_cost: number; useful_life_years: number; salvage_value: number
  depreciation_method: string; vendor: string; warranty_expiry: string
  status: string; notes: string; media_urls: string[]
  submitted_by_name?: string; submitted_at: string; updated_at: string
  internal_owner_name?: string
}

const CAT_ICONS: Record<string, string> = {
  vehicle: '🚗', equipment: '⚙️', building: '🏢', it: '💻', furniture: '🪑', other: '📦'
}

const STATUS_COLORS: Record<string, string> = {
  in_use: '#00ffb3', under_maintenance: '#ffe135', disposed: '#ff3cac', lost: '#bf5fff'
}

export default function AssetsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Asset | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCat, setFilterCat] = useState('all')

  const load = () => {
    setLoading(true)
    api.get<{ assets: Asset[] }>('/assets')
      .then(d => setAssets(d.assets))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = assets.filter(a => {
    const q = search.toLowerCase()
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.asset_number.toLowerCase().includes(q) || (a.vendor||'').toLowerCase().includes(q)
    const matchS = filterStatus === 'all' || a.status === filterStatus
    const matchC = filterCat === 'all' || a.category === filterCat
    return matchQ && matchS && matchC
  })

  const totalValue = assets.reduce((s, a) => s + Number(a.purchase_cost), 0)

  if (loading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border2)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.6rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text)', margin: 0 }}>
            🏗️ Assets Register
          </h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--muted)', marginTop: 2 }}>
            {assets.length} assets · Total Value: SAR {totalValue.toLocaleString('en-SA', { minimumFractionDigits: 2 })}
          </div>
        </div>
        {su && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '0.85rem' }}>
            + Add Asset
          </button>
        )}
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
        {[
          { label: 'In Use', val: assets.filter(a => a.status === 'in_use').length, color: '#00ffb3' },
          { label: 'Maintenance', val: assets.filter(a => a.status === 'under_maintenance').length, color: '#ffe135' },
          { label: 'Disposed', val: assets.filter(a => a.status === 'disposed').length, color: '#ff3cac' },
          { label: 'Lost', val: assets.filter(a => a.status === 'lost').length, color: '#bf5fff' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: `1px solid ${s.color}33`, borderRadius: 10, padding: '0.7rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search assets..."
          style={{ flex: 1, minWidth: 160, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--text)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="form-select" style={{ fontSize: '0.8rem' }}>
          <option value="all">All Status</option>
          <option value="in_use">In Use</option>
          <option value="under_maintenance">Maintenance</option>
          <option value="disposed">Disposed</option>
          <option value="lost">Lost</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="form-select" style={{ fontSize: '0.8rem' }}>
          <option value="all">All Categories</option>
          <option value="vehicle">Vehicle</option>
          <option value="equipment">Equipment</option>
          <option value="building">Building</option>
          <option value="it">IT</option>
          <option value="furniture">Furniture</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Asset cards grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
          No assets found
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '0.8rem' }}>
          {filtered.map(asset => (
            <div
              key={asset.id}
              onClick={() => setSelected(asset)}
              style={{
                background: 'var(--card)', border: `1px solid ${STATUS_COLORS[asset.status] || 'var(--border)'}33`,
                borderRadius: 12, padding: '1rem', cursor: 'pointer',
                transition: 'all 0.15s', position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${STATUS_COLORS[asset.status] || 'var(--blue)'}22` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
            >
              <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, borderRadius: '0 12px 0 80px', background: `${STATUS_COLORS[asset.status] || 'var(--blue)'}11` }} />
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{CAT_ICONS[asset.category] || '📦'}</div>
              <div style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{asset.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>{asset.asset_number}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--blue)', fontWeight: 700 }}>
                  SAR {Number(asset.purchase_cost).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                </span>
                <span style={{
                  padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                  background: `${STATUS_COLORS[asset.status] || 'var(--border)'}22`,
                  color: STATUS_COLORS[asset.status] || 'var(--muted)',
                  border: `1px solid ${STATUS_COLORS[asset.status] || 'var(--border)'}44`,
                }}>
                  {asset.status.replace(/_/g, ' ')}
                </span>
              </div>
              {asset.location && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  📍 {asset.location}
                </div>
              )}
              {(asset.media_urls?.length > 0) && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {asset.media_urls.slice(0, 3).map((u, i) => (
                    <img key={i} src={u} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                  ))}
                  {asset.media_urls.length > 3 && <span style={{ fontSize: '0.6rem', color: 'var(--muted)', alignSelf: 'center' }}>+{asset.media_urls.length - 3}</span>}
                </div>
              )}
              <div style={{ marginTop: '0.5rem', fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Tap to view details →</div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && <AssetDetailModal asset={selected} onClose={() => setSelected(null)} onRefresh={load} su={su} />}

      {/* Add Asset Form */}
      {showForm && <AssetFormModal onClose={() => { setShowForm(false); load() }} />}
    </div>
  )
}

function AssetDetailModal({ asset, onClose, onRefresh, su }: { asset: Asset; onClose: () => void; onRefresh: () => void; su: boolean }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ padding: '1.2rem 1.4rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(79,140,255,0.04)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.8rem' }}>{CAT_ICONS[asset.category] || '📦'}</span>
              <div>
                <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)', margin: 0 }}>{asset.name}</h2>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--blue)' }}>{asset.asset_number}</div>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '1.2rem 1.4rem' }}>
          {/* Status badge */}
          <div style={{ marginBottom: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.8rem', borderRadius: 20, fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
              background: `${STATUS_COLORS[asset.status]}22`, color: STATUS_COLORS[asset.status],
              border: `1px solid ${STATUS_COLORS[asset.status]}44`,
            }}>
              {asset.status.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>

          {/* Details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
            {[
              { label: 'Category', val: asset.category?.replace(/_/g, ' ') },
              { label: 'Location', val: asset.location || '—' },
              { label: 'Project / Branch', val: asset.project_branch || '—' },
              { label: 'Vendor', val: asset.vendor || '—' },
              { label: 'Purchase Date', val: asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('en-GB') : '—' },
              { label: 'Purchase Cost', val: `SAR ${Number(asset.purchase_cost).toLocaleString('en-SA', { minimumFractionDigits: 2 })}` },
              { label: 'Useful Life', val: `${asset.useful_life_years} years` },
              { label: 'Salvage Value', val: `SAR ${Number(asset.salvage_value).toLocaleString('en-SA', { minimumFractionDigits: 2 })}` },
              { label: 'Depreciation', val: asset.depreciation_method?.replace(/_/g, ' ') },
              { label: 'Warranty Expiry', val: asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('en-GB') : '—' },
              { label: 'Submitted By', val: asset.submitted_by_name || '—' },
              { label: 'Submitted At', val: new Date(asset.submitted_at).toLocaleString('en-GB') },
            ].map(f => (
              <div key={f.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.15rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>{f.val}</div>
              </div>
            ))}
          </div>

          {asset.notes && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.3rem' }}>NOTES</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>{asset.notes}</div>
            </div>
          )}

          {/* Media gallery */}
          {asset.media_urls?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem', letterSpacing: '0.07em' }}>ATTACHMENTS ({asset.media_urls.length})</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {asset.media_urls.map((u, i) => (
                  <img key={i} src={u} alt={`Attachment ${i + 1}`}
                    onClick={() => setLightboxUrl(u)}
                    style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in', transition: 'transform 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = '')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Attachment" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.4rem', borderRadius: 8, padding: '0.3rem 0.7rem' }}>✕</button>
        </div>
      )}
    </div>
  )
}

function AssetFormModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '', category: 'equipment', location: '', project_branch: '',
    purchase_date: '', purchase_cost: '', useful_life_years: '5', salvage_value: '0',
    depreciation_method: 'straight_line', vendor: '', warranty_expiry: '', status: 'in_use', notes: '',
  })
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async () => {
    if (!form.name.trim()) return setErr('Asset name is required')
    setSaving(true)
    setErr('')
    try {
      await api.post('/assets', { ...form, media_urls: mediaUrls })
      onClose()
    } catch (e: unknown) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border2)' }}>
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text)', margin: 0 }}>🏗️ Add New Asset</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.3rem' }}>✕</button>
        </div>

        <div style={{ padding: '1.2rem 1.3rem' }}>
          {/* Auto-filled fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.8rem', background: 'rgba(79,140,255,0.04)', borderRadius: 8, padding: '0.75rem', border: '1px solid rgba(79,140,255,0.15)' }}>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>SUBMITTED BY</label>
              <input value={user?.full_name || ''} disabled style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: '0.8rem', cursor: 'not-allowed' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.6rem', color: 'var(--blue)', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 4 }}>DATE / TIME</label>
              <input value={new Date().toLocaleString('en-GB')} disabled style={{ width: '100%', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', color: 'var(--muted)', fontSize: '0.8rem', cursor: 'not-allowed' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Asset Name */}
            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Asset Name *</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Caterpillar Excavator 320D" />
            </div>

            <div>
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={e => f('category', e.target.value)}>
                <option value="vehicle">🚗 Vehicle</option>
                <option value="equipment">⚙️ Equipment</option>
                <option value="building">🏢 Building</option>
                <option value="it">💻 IT</option>
                <option value="furniture">🪑 Furniture</option>
                <option value="other">📦 Other</option>
              </select>
            </div>

            <div>
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => f('status', e.target.value)}>
                <option value="in_use">In Use</option>
                <option value="under_maintenance">Under Maintenance</option>
                <option value="disposed">Disposed</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            <div>
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => f('location', e.target.value)} placeholder="Site / Office location" />
            </div>

            <div>
              <label className="form-label">Project / Branch</label>
              <input className="form-input" value={form.project_branch} onChange={e => f('project_branch', e.target.value)} placeholder="Project or branch name" />
            </div>

            <div>
              <label className="form-label">Vendor / Supplier</label>
              <input className="form-input" value={form.vendor} onChange={e => f('vendor', e.target.value)} placeholder="Supplier name" />
            </div>

            <div>
              <label className="form-label">Purchase Date</label>
              <input className="form-input" type="date" value={form.purchase_date} onChange={e => f('purchase_date', e.target.value)} />
            </div>

            <div>
              <label className="form-label">Purchase Cost (SAR)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e => f('purchase_cost', e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <label className="form-label">Useful Life (Years)</label>
              <input className="form-input" type="number" min="1" step="0.5" value={form.useful_life_years} onChange={e => f('useful_life_years', e.target.value)} />
            </div>

            <div>
              <label className="form-label">Salvage Value (SAR)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={form.salvage_value} onChange={e => f('salvage_value', e.target.value)} placeholder="0.00" />
            </div>

            <div>
              <label className="form-label">Depreciation Method</label>
              <select className="form-select" value={form.depreciation_method} onChange={e => f('depreciation_method', e.target.value)}>
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
              </select>
            </div>

            <div>
              <label className="form-label">Warranty Expiry</label>
              <input className="form-input" type="date" value={form.warranty_expiry} onChange={e => f('warranty_expiry', e.target.value)} />
            </div>

            <div style={{ gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" value={form.notes} onChange={e => f('notes', e.target.value)} rows={3} placeholder="Additional information..." style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* File upload */}
          <div style={{ marginTop: '1rem' }}>
            <label className="form-label">Attachments (Photos, Invoices, Warranty Docs)</label>
            <CameraUploadForm onUploaded={files => setMediaUrls(prev => [...prev, ...files.map(f => f.url)])} entityType="assets" />
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
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : '✓ Add Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
