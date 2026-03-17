// src/components/admin/ERPExpenseForm.tsx — v18 Fixed & Mobile Optimized
import { useState, useRef, useEffect, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'
import { api } from '../../lib/api'

interface LineItem { description: string; quantity: string; unit_price: string; tax_percent: string }
const EMPTY = (): LineItem => ({ description: '', quantity: '1', unit_price: '', tax_percent: '15' })

const CATS = [
  'Materials & Supplies','Labour & Wages','Equipment & Tools','Transport & Fuel',
  'Utilities','Office & Admin','Maintenance & Repairs','Safety & PPE',
  'Marketing','Professional Services','IT & Technology','Travel','Other'
]

function calc(l: LineItem) {
  const sub = (parseFloat(l.quantity)||1) * (parseFloat(l.unit_price)||0)
  const tax = sub * ((parseFloat(l.tax_percent)||0) / 100)
  return { sub, tax, total: sub + tax }
}
const sar = (n: number) => n.toLocaleString('en-SA', { minimumFractionDigits: 2 })

export default function ERPExpenseForm() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [lines, setLines]       = useState<LineItem[]>([EMPTY()])
  const [title, setTitle]       = useState('')
  const [vendor, setVendor]     = useState('')
  const [category, setCategory] = useState('')
  const [description, setDesc]  = useState('')
  const [expDate, setExpDate]   = useState(new Date().toISOString().slice(0, 10))
  const [receipts, setReceipts] = useState<string[]>([])
  const [submitting, setSub]    = useState(false)
  const [error, setError]       = useState('')
  const [uploading, setUploading] = useState(false)

  const computed   = lines.map(calc)
  const subTotal   = computed.reduce((a, c) => a + c.sub, 0)
  const taxTotal   = computed.reduce((a, c) => a + c.tax, 0)
  const grandTotal = computed.reduce((a, c) => a + c.total, 0)

  function setLine(i: number, k: keyof LineItem, v: string) {
    setLines(p => { const n = [...p]; n[i] = { ...n[i], [k]: v }; return n })
  }

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      for (const f of files) {
        const reader = new FileReader()
        const dataUrl = await new Promise<string>((res) => {
          reader.onload = () => res(reader.result as string)
          reader.readAsDataURL(f)
        })
        const base64 = dataUrl.split(',')[1]
        const result = await api.post<{ url?: string; file?: { url: string } }>('/uploads/file', {
          name: f.name, type: f.type,
          data: base64
        })
        const url = result?.url || result?.file?.url
        if (url) setReceipts(p => [...p, url])
      }
    } catch {
      setError('File upload failed — you can still submit without a receipt')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSubmit() {
    const validLines = lines.filter(l => l.description.trim() && parseFloat(l.unit_price) > 0)
    if (!validLines.length) { setError('Add at least one line item with description and price.'); return }
    if (!title.trim()) { setError('Please enter an expense title.'); return }
    setSub(true); setError('')
    try {
      await api.post('/expenses', {
        title:        title.trim(),
        vendor:       vendor.trim() || undefined,
        category:     category || undefined,
        description:  description.trim() || undefined,
        expense_date: expDate || undefined,
        receipt_url:  receipts[0] || undefined,
        media_urls:   receipts,
        vat_rate:     15,
        line_items:   validLines.map(l => ({
          description: l.description.trim(),
          quantity:    parseFloat(l.quantity) || 1,
          unit_price:  parseFloat(l.unit_price) || 0,
          tax_percent: parseFloat(l.tax_percent) || 15,
        })),
        // Also send flat amounts for API compatibility
        amount:       subTotal,
        total_amount: subTotal,
        grand_total:  grandTotal,
        vat_amount:   taxTotal,
        items:        validLines.map(l => ({
          description: l.description.trim(),
          quantity:    parseFloat(l.quantity) || 1,
          unit_price:  parseFloat(l.unit_price) || 0,
          tax_percent: parseFloat(l.tax_percent) || 15,
          line_total:  calc(l).total,
        })),
      })
      navigate('/expenses', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    } finally { setSub(false) }
  }

  return (
    <div className="page-content" style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/expenses')}>← Back</button>
          <h1 className="page-title" style={{ marginTop: '0.5rem' }}>New Expense</h1>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          ⚠️ {error}
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Auto-filled info */}
        <div style={{ background: 'var(--hover-bg)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', fontSize: '.82rem', color: 'var(--text2)' }}>
          <strong style={{ color: 'var(--text)' }}>{user?.full_name}</strong>
          {' · '}{user?.email}{' · '}{user?.department || 'General'}
          {' · '}<span style={{ fontFamily: 'var(--font-mono)' }}>{new Date().toLocaleDateString('en-GB')}</span>
        </div>

        {/* Title & Vendor */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="form-col-full">
            <label className="label">Expense Title <span style={{ color: 'var(--rose)' }}>*</span></label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Site materials purchase" />
          </div>
          <div>
            <label className="label">Vendor / Supplier</label>
            <input className="input" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name" />
          </div>
        </div>

        {/* Category & Date */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Select —</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Expense Date</label>
            <input className="input" type="date" value={expDate} onChange={e => setExpDate(e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label className="label" style={{ margin: 0 }}>Line Items <span style={{ color: 'var(--rose)' }}>*</span></label>
            <button className="btn btn-ghost btn-sm" onClick={() => setLines(p => [...p, EMPTY()])}>+ Add Row</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lines.map((l, i) => {
              const { total } = calc(l)
              return (
                <div key={i} style={{ background: 'var(--hover-bg)', borderRadius: 'var(--radius)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}>
                  <input className="input" value={l.description} onChange={e => setLine(i, 'description', e.target.value)}
                    placeholder="Item description" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label className="label">Qty</label>
                      <input className="input" type="number" min="0" step="any" value={l.quantity}
                        onChange={e => setLine(i, 'quantity', e.target.value)} />
                    </div>
                    <div>
                      <label className="label">Unit Price (SAR)</label>
                      <input className="input" type="number" min="0" step="0.01" value={l.unit_price}
                        onChange={e => setLine(i, 'unit_price', e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">VAT %</label>
                      <input className="input" type="number" min="0" max="100" value={l.tax_percent}
                        onChange={e => setLine(i, 'tax_percent', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.85rem', color: 'var(--green-bright)' }}>
                      SAR {sar(total)}
                    </span>
                    {lines.length > 1 && (
                      <button onClick={() => setLines(p => p.filter((_, j) => j !== i))}
                        style={{ background: 'var(--rose-d)', border: '1px solid var(--rose)', color: 'var(--rose)', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '.8rem' }}>
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div style={{ marginTop: '0.75rem', background: 'var(--card2)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border2)' }}>
            {[['Subtotal', subTotal, 'var(--text)'], ['VAT / Tax', taxTotal, 'var(--amber)']].map(([label, val, color]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '.875rem' }}>
                <span style={{ color: 'var(--text2)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: color as string }}>SAR {sar(val as number)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--text)' }}>Grand Total</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-bright)', fontSize: '1.1rem' }}>SAR {sar(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes / Remarks</label>
          <textarea className="input" value={description} onChange={e => setDesc(e.target.value)}
            placeholder="Additional notes..." style={{ minHeight: 72, resize: 'vertical' }} />
        </div>

        {/* Receipt Upload */}
        <div>
          <label className="label">Receipts / Attachments</label>
          <input ref={fileRef} type="file" id="receipt-upload" multiple accept="image/*,.pdf"
            capture="environment" onChange={onFiles} style={{ display: 'none' }} />
          <label htmlFor="receipt-upload" className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            {uploading ? '⟳ Uploading...' : '📷 Add Receipt / Photo'}
          </label>
          {receipts.length > 0 && (
            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {receipts.map((url, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <a href={url} target="_blank" rel="noreferrer"
                    style={{ display: 'block', width: 56, height: 56, background: 'var(--hover-bg)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border2)' }}>
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  </a>
                  <button onClick={() => setReceipts(p => p.filter((_, j) => j !== i))}
                    style={{ position: 'absolute', top: -6, right: -6, background: 'var(--rose)', border: 'none', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={() => navigate('/expenses')} disabled={submitting}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || uploading}
            style={{ minWidth: 160, fontSize: '1rem' }}>
            {submitting ? '⟳ Submitting…' : '✓ Submit Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
