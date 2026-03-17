// src/pages/InvoiceFormPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'
import CameraUploadForm from '../components/erp/CameraUploadForm'
import logoUrl from '../assets/logo-alpha.png'

interface LineItem { description:string; quantity:string; unit:string; unit_price:string; tax_percent:string }
const EMPTY = (): LineItem => ({ description:'', quantity:'1', unit:'', unit_price:'', tax_percent:'15' })

export default function InvoiceFormPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const now = new Date()
  const [companyInfo, setCompanyInfo] = useState({ name:'Alpha Ultimate Ltd', cr:'1234567890', address:'Riyadh, KSA' })

  useEffect(() => {
    api.get<{settings: Record<string, string>}>('/settings')
      .then(d => {
        const s = d.settings
        setCompanyInfo({
          name:    String(s.company_name    ?? 'Alpha Ultimate Ltd'),
          cr:      String(s.company_cr      ?? '1234567890'),
          address: String(s.company_address ?? 'Riyadh, KSA'),
        })
      })
      .catch(() => {})
  }, [])

  const [lines,       setLines]       = useState<LineItem[]>([EMPTY()])
  const [clientName,  setClientName]  = useState('')
  const [clientAddr,  setClientAddr]  = useState('')
  const [clientVat,   setClientVat]   = useState('')
  const [projectName, setProjectName] = useState('')
  const [poNumber,    setPoNumber]    = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [payTerms,    setPayTerms]    = useState('30 days')
  const [notes,       setNotes]       = useState('')
  const [mediaUrls,   setMediaUrls]   = useState<string[]>([])
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')

  const computed = lines.map(l => {
    const sub = parseFloat(l.quantity||'0') * parseFloat(l.unit_price||'0')
    const tax = sub * (parseFloat(l.tax_percent||'0') / 100)
    return { sub: isNaN(sub)?0:sub, tax: isNaN(tax)?0:tax, total: isNaN(sub+tax)?0:sub+tax }
  })
  const subTotal   = computed.reduce((a,c) => a+c.sub, 0)
  const taxTotal   = computed.reduce((a,c) => a+c.tax, 0)
  const grandTotal = computed.reduce((a,c) => a+c.total, 0)
  const fmt = (n: number) => n.toLocaleString('en-SA', { minimumFractionDigits:2, maximumFractionDigits:2 })

  function updateLine(i: number, field: keyof LineItem, val: string) {
    setLines(p => p.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  async function handleSubmit() {
    if (!clientName.trim())                                                    { setError('Client name is required.'); return }
    if (lines.find(l => !l.description.trim()))                                { setError('Every line item must have a description.'); return }
    if (lines.find(l => !l.unit_price.trim() || parseFloat(l.unit_price)<=0)) { setError('Every line item must have a valid Unit Price > 0.'); return }
    setError(''); setSubmitting(true)
    try {
      await api.post('/invoices', {
        client_name:       clientName.trim(),
        client_address:    clientAddr   || null,
        client_vat_number: clientVat    || null,
        project_name:      projectName  || null,
        po_number:         poNumber     || null,
        due_date:          dueDate      || null,
        payment_terms:     payTerms     || null,
        notes:             notes        || null,
        media_urls:        mediaUrls,
        line_items: lines.map(l => ({
          description: l.description.trim(),
          quantity:    parseFloat(l.quantity)    || 1,
          unit:        l.unit.trim()             || null,
          unit_price:  parseFloat(l.unit_price)  || 0,
          tax_percent: parseFloat(l.tax_percent) || 15,
        })),
      })
      navigate('/invoices', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')}>← Back</button>
        <img src={logoUrl} alt="Alpha Ultimate" style={{ height:36, width:'auto', borderRadius:6 }} />
        <div>
          <h1 className="page-title" style={{ marginBottom:0 }}>New Invoice</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text2)', letterSpacing:'0.08em' }}>
            {companyInfo.name.toUpperCase()} · CR: {companyInfo.cr} · {companyInfo.address.toUpperCase()}
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Auto-populated — Read Only */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'0.85rem' }}>
          <div className="section-label" style={{ marginBottom:0 }}>Auto-populated — Read Only</div>
          <span style={{ fontSize:'0.62rem', fontFamily:'var(--font-mono)', fontWeight:700, padding:'0.1rem 0.45rem', borderRadius:20, letterSpacing:'0.05em', background:'rgba(0,255,179,0.1)', border:'1px solid rgba(0,255,179,0.3)', color:'var(--green)' }}>LOCKED</span>
        </div>
        <div className="form-grid">
          {[['Date', now.toLocaleDateString('en-GB')], ['Time', now.toLocaleTimeString('en-GB')], ['User ID', user?.id??'—'], ['Prepared By', user?.full_name??'—']].map(([l,v]) => (
            <div className="form-row" key={l}><label className="label">{l}</label><input className="input mono" value={v} disabled readOnly style={{ opacity:0.6, cursor:'not-allowed' }} /></div>
          ))}
        </div>
      </div>

      {/* Client Information */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Client Information</div>
        <div className="form-grid">
          <div className="form-row"><label className="label">Client Name *</label><input className="input" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Company or person name" /></div>
          <div className="form-row"><label className="label">VAT Number</label><input className="input mono" value={clientVat} onChange={e=>setClientVat(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row col-span-2"><label className="label">Client Address</label><input className="input" value={clientAddr} onChange={e=>setClientAddr(e.target.value)} placeholder="Optional" /></div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Invoice Details</div>
        <div className="form-grid">
          <div className="form-row"><label className="label">Project Name</label><input className="input" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row"><label className="label">PO Number</label><input className="input mono" value={poNumber} onChange={e=>setPoNumber(e.target.value)} placeholder="Optional" /></div>
          <div className="form-row"><label className="label">Due Date</label><input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></div>
          <div className="form-row"><label className="label">Payment Terms</label><input className="input" value={payTerms} onChange={e=>setPayTerms(e.target.value)} /></div>
          <div className="form-row col-span-2"><label className="label">Notes</label><textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional…" /></div>
        </div>
      </div>

      {/* Line Items */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <div className="section-label" style={{ marginBottom:0 }}>Line Items <span style={{ color:'var(--error)' }}>*</span></div>
          <button className="btn btn-secondary btn-sm" onClick={()=>setLines(p=>[...p,EMPTY()])}>+ Add Row</button>
        </div>
        <div className="line-item-headers" style={{ display:'grid', gridTemplateColumns:'3fr 1fr 0.8fr 1.4fr 0.8fr 1.4fr 28px', gap:'0.4rem', marginBottom:'0.4rem' }}>
          {['Description *','Qty','Unit','Unit Price (SAR) *','Tax %','Total (SAR)',''].map(h=>(
            <div key={h} style={{ fontSize:'0.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</div>
          ))}
        </div>
        {lines.map((l,i)=>(
          <div key={i} className="line-item-row" style={{ display:'grid', gridTemplateColumns:'3fr 1fr 0.8fr 1.4fr 0.8fr 1.4fr 28px', gap:'0.4rem', alignItems:'center', marginBottom:'0.5rem' }}>
            <input className="input li-desc" value={l.description} onChange={e=>updateLine(i,'description',e.target.value)} placeholder="Description *" style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.quantity}    onChange={e=>updateLine(i,'quantity',e.target.value)}    type="number" min="0" step="0.001" placeholder="1"    style={{ fontSize:'0.9rem' }} />
            <input className="input"         value={l.unit}        onChange={e=>updateLine(i,'unit',e.target.value)}        placeholder="pcs"                                    style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.unit_price}  onChange={e=>updateLine(i,'unit_price',e.target.value)}  type="number" min="0" step="0.01" placeholder="0.00" style={{ fontSize:'0.9rem' }} />
            <input className="input mono"    value={l.tax_percent} onChange={e=>updateLine(i,'tax_percent',e.target.value)} type="number" min="0" max="100"   placeholder="15"   style={{ fontSize:'0.9rem' }} />
            <div className="mono li-total" style={{ fontSize:'0.85rem', color:'var(--success)', padding:'0 0.2rem', fontWeight:600 }}>{fmt(computed[i]?.total??0)}</div>
            <button onClick={()=>setLines(p=>p.filter((_,idx)=>idx!==i))} disabled={lines.length===1}
              style={{ background:'none', border:'none', color:'var(--error)', cursor:lines.length===1?'not-allowed':'pointer', padding:'0.2rem', fontSize:'1.2rem', lineHeight:1, opacity:lines.length===1?0.2:0.8 }}>×</button>
          </div>
        ))}
        {/* Totals */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', borderTop:'1px solid var(--border)', paddingTop:'1rem', marginTop:'0.5rem', gap:'0.3rem' }}>
          <div style={{ display:'flex', gap:'1.5rem', fontSize:'0.82rem', color:'var(--text2)' }}>
            <span>Subtotal</span><span className="mono" style={{ color:'var(--text)' }}>SAR {fmt(subTotal)}</span>
          </div>
          <div style={{ display:'flex', gap:'1.5rem', fontSize:'0.82rem', color:'var(--text2)' }}>
            <span>VAT ({lines[0]?.tax_percent||15}%)</span><span className="mono" style={{ color:'var(--amber)' }}>SAR {fmt(taxTotal)}</span>
          </div>
          <div style={{ display:'flex', gap:'1.5rem', fontSize:'1rem', fontWeight:700, marginTop:'0.3rem' }}>
            <span style={{ color:'var(--text)' }}>GRAND TOTAL</span>
            <span className="mono" style={{ fontSize:'1.4rem', color:'var(--cyan)' }}>SAR {fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Attachments */}
      <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
        <div className="section-label">Receipts & Attachments</div>
        <CameraUploadForm entityType="invoices" onUploaded={files=>setMediaUrls(p=>[...p,...files.map(f=>f.url)])} />
      </div>

      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', paddingBottom:'2.5rem' }}>
        <button className="btn btn-secondary" onClick={()=>navigate('/invoices')} disabled={submitting}>Cancel</button>
        <button className="btn btn-primary"   onClick={handleSubmit}               disabled={submitting}>{submitting?'Submitting…':'✓ Submit Invoice'}</button>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .line-item-headers { display: none !important; }
          .line-item-row { display: grid !important; grid-template-columns: 1fr 1fr !important;
            background: rgba(7,6,26,0.7); border: 1px solid var(--border);
            border-radius: 8px; padding: 0.75rem; gap: 0.5rem; margin-bottom: 0.75rem; position: relative; }
          .line-item-row .li-desc  { grid-column: 1 / -1; }
          .line-item-row .li-total { grid-column: 1 / 2; }
          .line-item-row button    { position: absolute; top: 0.5rem; right: 0.5rem; }
        }
      `}</style>
    </div>
  )
}
