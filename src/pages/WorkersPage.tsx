// src/pages/WorkersPage.tsx — v18 Complete Employee Module
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Worker {
  id: string; ref: string; full_name: string; arabic_name?: string
  gender?: string; date_of_birth?: string; nationality?: string; marital_status?: string
  phone: string; phone2?: string; email?: string; address?: string
  emergency_contact_name?: string; emergency_contact_phone?: string
  position: string; department: string; employment_type?: string
  hire_date?: string; contract_type?: string; contract_end?: string
  basic_salary?: number; housing_allowance?: number; transport_allowance?: number
  other_allowance?: number; salary: number; currency?: string; payment_cycle?: string
  national_id_number?: string; passport_number?: string; iqama_number?: string
  iqama_expiry?: string; work_permit_number?: string
  bank_name?: string; bank_iban?: string; bank_account?: string
  status: string; photo_url?: string; id_photo_url?: string
  passport_photo_url?: string; iqama_photo_url?: string
  notes?: string; created_at: string
}
interface EmpDoc {
  id: string; document_type: string; document_number?: string
  expiry_date?: string; file_url?: string; file_url_back?: string; notes?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPTS = ['Operations','Construction','Maintenance','Administration','Finance','HR','IT','Safety','Logistics','Marketing','Other']
const NATS = ['Saudi','Pakistani','Indian','Bangladeshi','Filipino','Egyptian','Yemeni','Sudanese','Syrian','Nepali','Ethiopian','Indonesian','Sri Lankan','Other']
const DOC_TYPES = ['National ID','Iqama (Residency Permit)','Passport','Work Permit','Driving License','Health Certificate','Other']
const STATUS_BADGE: Record<string,string> = { active:'badge-green', on_leave:'badge-amber', inactive:'badge-muted', terminated:'badge-rose' }
const sar = (n: number) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:0})}`

const EMPTY_FORM = {
  full_name:'', arabic_name:'', gender:'male', date_of_birth:'', nationality:'Saudi',
  marital_status:'single', phone:'', phone2:'', email:'', address:'',
  emergency_contact_name:'', emergency_contact_phone:'',
  position:'', department:'Operations', employment_type:'full_time',
  hire_date: new Date().toISOString().slice(0,10), contract_type:'permanent', contract_end:'',
  basic_salary:'', housing_allowance:'', transport_allowance:'', other_allowance:'',
  currency:'SAR', payment_cycle:'monthly',
  national_id_number:'', passport_number:'', iqama_number:'', iqama_expiry:'', work_permit_number:'',
  bank_name:'', bank_iban:'', notes:'', status:'active',
}

// ── Upload helper ─────────────────────────────────────────────────────────────
async function uploadPhoto(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1]
        const res = await api.post<{url?:string}>('/uploads/file', { name: file.name, type: file.type, data: base64 })
        resolve(res?.url || null)
      } catch { resolve(null) }
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

// ── Worker Card ───────────────────────────────────────────────────────────────
function WorkerCard({ w, onClick }: { w: Worker; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      display:'flex', alignItems:'center', gap:'1rem', padding:'1rem',
      background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
      cursor:'pointer', transition:'all .15s', touchAction:'manipulation',
    }}
    onTouchStart={e => (e.currentTarget.style.background = 'var(--card2)')}
    onTouchEnd={e => (e.currentTarget.style.background = 'var(--card)')}>
      {/* Avatar */}
      {w.photo_url
        ? <img src={w.photo_url} alt={w.full_name} style={{width:52,height:52,borderRadius:'50%',objectFit:'cover',flexShrink:0,border:'2px solid var(--border2)'}} />
        : <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,var(--blue),var(--violet))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.2rem',fontWeight:700,color:'#fff',flexShrink:0}}>
            {w.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
          </div>
      }
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'.4rem',flexWrap:'wrap',marginBottom:'.2rem'}}>
          <span style={{fontWeight:700,fontSize:'.9rem',color:'var(--text)'}}>{w.full_name}</span>
          <span className={`badge ${STATUS_BADGE[w.status]||'badge-muted'}`}>{w.status.replace('_',' ')}</span>
        </div>
        <div style={{fontSize:'.75rem',color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{w.ref}</div>
        <div style={{fontSize:'.8rem',color:'var(--text3)',marginTop:'.15rem'}}>
          {w.position}{w.position && w.department ? ' · ' : ''}{w.department}
        </div>
      </div>
      {/* Salary */}
      <div style={{textAlign:'right',flexShrink:0}}>
        <div style={{fontFamily:'var(--font-mono)',fontSize:'.82rem',fontWeight:600,color:'var(--green-bright)'}}>{sar(w.salary||w.basic_salary||0)}</div>
        <div style={{fontSize:'.7rem',color:'var(--text3)',marginTop:'.1rem'}}>{w.nationality}</div>
        <div style={{fontSize:'.68rem',color:'var(--text3)'}}>›</div>
      </div>
    </div>
  )
}

// ── Employee Profile Modal ────────────────────────────────────────────────────
function EmployeeProfile({ w, onClose, onRefresh, su }: { w: Worker; onClose:()=>void; onRefresh:()=>void; su:boolean }) {
  const [tab, setTab] = useState<'overview'|'docs'|'salary'|'edit'>('overview')
  const [docs, setDocs] = useState<EmpDoc[]>([])
  const [form, setForm] = useState<typeof EMPTY_FORM & Record<string,string>>(
    Object.fromEntries(Object.entries(EMPTY_FORM).map(([k]) => [k, String((w as Record<string,unknown>)[k] || '')])) as typeof EMPTY_FORM & Record<string,string>
  )
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')
  const [uploading, setUploading] = useState<string|null>(null)
  const [lightbox, setLightbox] = useState('')

  // Doc form
  const [addDoc, setAddDoc] = useState(false)
  const [docForm, setDocForm] = useState({ document_type:'Passport', document_number:'', expiry_date:'', notes:'' })
  const [docFront, setDocFront] = useState<string|null>(null)
  const [docBack,  setDocBack]  = useState<string|null>(null)
  const [savingDoc, setSavingDoc] = useState(false)

  const loadDocs = useCallback(() => {
    api.get<{documents:EmpDoc[]}>(`/employee-documents?worker_id=${w.id}`)
      .then(d => setDocs(d.documents||[])).catch(()=>{})
  }, [w.id])

  useEffect(() => { loadDocs() }, [loadDocs])

  function set(k: string, v: string) { setForm(p => ({...p,[k]:v})) }

  async function uploadImg(field: string, file: File) {
    setUploading(field)
    const url = await uploadPhoto(file)
    if (url) {
      setForm(p => ({...p,[field]:url}))
      try { await api.patch(`/workers/${w.id}`, {[field]:url}); onRefresh() } catch {}
    }
    setUploading(null)
  }

  async function save() {
    setSaving(true); setErr(''); setMsg('')
    try {
      await api.patch(`/workers/${w.id}`, form)
      setMsg('✓ Saved successfully'); onRefresh()
      setTimeout(()=>setMsg(''), 2500)
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Save failed') }
    setSaving(false)
  }

  async function saveDoc() {
    if (!docForm.document_type) return
    setSavingDoc(true)
    try {
      await api.post('/employee-documents', { worker_id:w.id, ...docForm, file_url:docFront, file_url_back:docBack })
      setAddDoc(false); setDocForm({document_type:'Passport',document_number:'',expiry_date:'',notes:''}); setDocFront(null); setDocBack(null)
      loadDocs()
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
    setSavingDoc(false)
  }

  async function delDoc(id: string) {
    if (!confirm('Delete this document?')) return
    try { await api.delete(`/employee-documents/${id}`); loadDocs() } catch {}
  }

  async function uploadDocImg(side: 'front'|'back', file: File) {
    setUploading(side)
    const url = await uploadPhoto(file)
    if (url) { side === 'front' ? setDocFront(url) : setDocBack(url) }
    setUploading(null)
  }

  const totalSalary = Number(form.basic_salary||w.basic_salary||0) + Number(form.housing_allowance||w.housing_allowance||0) + Number(form.transport_allowance||w.transport_allowance||0) + Number(form.other_allowance||w.other_allowance||0)

  const PhotoField = ({ field, label, icon }: { field:string; label:string; icon:string }) => (
    <div style={{display:'flex',flexDirection:'column',gap:'.3rem'}}>
      <label className="label">{label}</label>
      <div style={{display:'flex',alignItems:'center',gap:'.6rem',flexWrap:'wrap'}}>
        {(form[field]||w[field as keyof Worker]) && (
          <img src={(form[field]||w[field as keyof Worker]) as string} alt={label}
            onClick={() => setLightbox((form[field]||w[field as keyof Worker]) as string)}
            style={{width:56,height:56,objectFit:'cover',borderRadius:8,cursor:'zoom-in',border:'1px solid var(--border2)'}} />
        )}
        <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
          {uploading===field ? '⟳ Uploading…' : `${icon} Upload`}
          <input type="file" accept="image/*,.pdf" capture="environment" style={{display:'none'}}
            onChange={async e => { const f=e.target.files?.[0]; if(f&&su) await uploadImg(field,f) }} />
        </label>
      </div>
    </div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      {lightbox && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.95)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}} onClick={()=>setLightbox('')}>
          <img src={lightbox} alt="" style={{maxWidth:'100%',maxHeight:'90dvh',objectFit:'contain',borderRadius:8}} />
        </div>
      )}
      <div className="modal-box modal-lg" onClick={e=>e.stopPropagation()}>
        {/* Profile Header */}
        <div style={{background:'linear-gradient(135deg,rgba(59,130,246,.12),rgba(139,92,246,.08))',padding:'1.25rem',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'1rem'}}>
          {w.photo_url
            ? <img src={w.photo_url} alt={w.full_name} style={{width:64,height:64,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--blue)',flexShrink:0}} onClick={()=>setLightbox(w.photo_url!)} />
            : <div style={{width:64,height:64,borderRadius:'50%',background:'linear-gradient(135deg,var(--blue),var(--violet))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem',fontWeight:700,color:'#fff',flexShrink:0}}>
                {w.full_name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </div>
          }
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:'var(--font-disp)',fontWeight:800,fontSize:'1.15rem',color:'var(--text)'}}>{w.full_name}</div>
            {w.arabic_name && <div style={{fontSize:'.85rem',color:'var(--text2)',direction:'rtl'}}>{w.arabic_name}</div>}
            <div style={{display:'flex',gap:'.4rem',alignItems:'center',flexWrap:'wrap',marginTop:'.25rem'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'.72rem',color:'var(--blue)'}}>{w.ref}</span>
              <span className={`badge ${STATUS_BADGE[w.status]||'badge-muted'}`}>{w.status.replace('_',' ')}</span>
              {w.position && <span style={{fontSize:'.77rem',color:'var(--text2)'}}>{w.position}</span>}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',overflow:'hidden',background:'var(--card)'}}>
          {(['overview','docs','salary',...(su?['edit']:[])]).map(t => (
            <button key={t} onClick={()=>setTab(t as typeof tab)}
              style={{flex:1,padding:'.65rem .5rem',border:'none',background:'transparent',
                color:tab===t?'var(--blue)':'var(--text2)',fontWeight:tab===t?700:500,
                fontSize:'.8rem',cursor:'pointer',borderBottom:`2px solid ${tab===t?'var(--blue)':'transparent'}`,
                textTransform:'capitalize',transition:'all .12s'}}>
              {t === 'docs' ? '📄 Docs' : t === 'salary' ? '💰 Salary' : t === 'edit' ? '✏️ Edit' : '👤 Overview'}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{padding:'1rem'}}>
          {msg && <div className="alert alert-success" style={{marginBottom:'.75rem'}}>{msg}</div>}
          {err && <div className="alert alert-error"   style={{marginBottom:'.75rem'}}>⚠️ {err}</div>}

          {/* ── OVERVIEW TAB ───────────────────────────────────── */}
          {tab === 'overview' && (
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
              {/* Contact & Basic */}
              {[
                ['📋 Employment', [
                  ['Department',w.department],['Position',w.position],
                  ['Employment Type',(w.employment_type||'').replace('_',' ')],
                  ['Join Date',w.hire_date?new Date(w.hire_date).toLocaleDateString('en-GB'):'—'],
                  ['Contract',w.contract_type],
                ]],
                ['📞 Contact', [
                  ['Phone',w.phone],['Phone 2',w.phone2||'—'],
                  ['Email',w.email||'—'],['Address',w.address||'—'],
                ]],
                ['🆔 Identity', [
                  ['Nationality',w.nationality],['Gender',(w.gender||'').replace('_',' ')],
                  ['Date of Birth',w.date_of_birth?new Date(w.date_of_birth).toLocaleDateString('en-GB'):'—'],
                  ['Iqama No.',w.iqama_number||'—'],
                  ['Passport No.',w.passport_number||'—'],
                  ['National ID',w.national_id_number||'—'],
                ]],
                ...(w.emergency_contact_name?[['🚨 Emergency', [
                  ['Name',w.emergency_contact_name],['Phone',w.emergency_contact_phone||'—'],
                ]]]:[]),
              ].map(([title,rows]) => (
                <div key={title as string} className="card" style={{padding:'.85rem'}}>
                  <div style={{fontWeight:700,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.6rem'}}>{title as string}</div>
                  {(rows as [string,string][]).filter(([,v])=>v&&v!=='—').map(([label,val]) => (
                    <div key={label} className="data-pair">
                      <span className="data-label">{label}</span>
                      <span className="data-value">{val}</span>
                    </div>
                  ))}
                </div>
              ))}
              {w.notes && (
                <div className="card" style={{padding:'.85rem'}}>
                  <div style={{fontWeight:700,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.5rem'}}>📝 Notes</div>
                  <p style={{fontSize:'.84rem',color:'var(--text2)',lineHeight:1.6}}>{w.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── DOCS TAB ───────────────────────────────────────── */}
          {tab === 'docs' && (
            <div>
              {/* Photo uploads */}
              <div className="card" style={{padding:'.85rem',marginBottom:'.75rem'}}>
                <div style={{fontWeight:700,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.75rem'}}>📸 Photos & ID Images</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.75rem'}}>
                  <PhotoField field="photo_url" label="Profile Photo" icon="📷" />
                  <PhotoField field="id_photo_url" label="ID / Iqama Card" icon="🪪" />
                  <PhotoField field="passport_photo_url" label="Passport" icon="📘" />
                  <PhotoField field="iqama_photo_url" label="Iqama Card" icon="📄" />
                </div>
              </div>

              {/* Document list */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.6rem'}}>
                <span style={{fontWeight:600,fontSize:'.85rem',color:'var(--text)'}}>Official Documents</span>
                {su && <button className="btn btn-primary btn-sm" onClick={()=>setAddDoc(true)}>+ Add Document</button>}
              </div>

              {docs.length === 0 ? (
                <div className="empty-state" style={{padding:'1.5rem'}}>
                  <div className="empty-icon">📄</div>
                  <div className="empty-desc">No documents uploaded yet</div>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'.5rem'}}>
                  {docs.map(doc => (
                    <div key={doc.id} className="card" style={{padding:'.85rem'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'.5rem'}}>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:600,fontSize:'.85rem',color:'var(--text)'}}>{doc.document_type}</div>
                          {doc.document_number && <div style={{fontSize:'.78rem',color:'var(--text2)',fontFamily:'var(--font-mono)',marginTop:'.1rem'}}>{doc.document_number}</div>}
                          {doc.expiry_date && <div style={{fontSize:'.75rem',color:'var(--amber)',marginTop:'.2rem'}}>Expires: {new Date(doc.expiry_date).toLocaleDateString('en-GB')}</div>}
                          {doc.notes && <div style={{fontSize:'.76rem',color:'var(--text3)',marginTop:'.2rem'}}>{doc.notes}</div>}
                          <div style={{display:'flex',gap:'.5rem',marginTop:'.5rem',flexWrap:'wrap'}}>
                            {doc.file_url && <a href={doc.file_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📎 Front</a>}
                            {doc.file_url_back && <a href={doc.file_url_back} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📎 Back</a>}
                          </div>
                        </div>
                        {su && <button className="btn btn-danger btn-sm" onClick={()=>delDoc(doc.id)}>🗑</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Document Form */}
              {addDoc && (
                <div className="card" style={{padding:'1rem',marginTop:'.75rem',border:'1px solid var(--blue-d)'}}>
                  <div style={{fontWeight:600,marginBottom:'.75rem',color:'var(--text)'}}>Add New Document</div>
                  <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
                    <div>
                      <label className="label">Document Type</label>
                      <select className="input" value={docForm.document_type} onChange={e=>setDocForm(p=>({...p,document_type:e.target.value}))}>
                        {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                      <div><label className="label">Document Number</label>
                        <input className="input" value={docForm.document_number} onChange={e=>setDocForm(p=>({...p,document_number:e.target.value}))} placeholder="Number" /></div>
                      <div><label className="label">Expiry Date</label>
                        <input className="input" type="date" value={docForm.expiry_date} onChange={e=>setDocForm(p=>({...p,expiry_date:e.target.value}))} /></div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                      <div>
                        <label className="label">Front Image</label>
                        <label className="btn btn-secondary btn-sm" style={{cursor:'pointer',display:'inline-flex'}}>
                          {docFront ? '✓ Uploaded' : (uploading==='front' ? '⟳ Uploading…' : '📎 Upload Front')}
                          <input type="file" accept="image/*,.pdf" capture="environment" style={{display:'none'}}
                            onChange={async e => { const f=e.target.files?.[0]; if(f) await uploadDocImg('front',f) }} />
                        </label>
                        {docFront && <img src={docFront} alt="" style={{width:48,height:48,objectFit:'cover',borderRadius:6,marginLeft:'.5rem',border:'1px solid var(--border2)'}} />}
                      </div>
                      <div>
                        <label className="label">Back Image</label>
                        <label className="btn btn-secondary btn-sm" style={{cursor:'pointer',display:'inline-flex'}}>
                          {docBack ? '✓ Uploaded' : (uploading==='back' ? '⟳ Uploading…' : '📎 Upload Back')}
                          <input type="file" accept="image/*,.pdf" capture="environment" style={{display:'none'}}
                            onChange={async e => { const f=e.target.files?.[0]; if(f) await uploadDocImg('back',f) }} />
                        </label>
                        {docBack && <img src={docBack} alt="" style={{width:48,height:48,objectFit:'cover',borderRadius:6,marginLeft:'.5rem',border:'1px solid var(--border2)'}} />}
                      </div>
                    </div>
                    <div><label className="label">Notes</label>
                      <input className="input" value={docForm.notes} onChange={e=>setDocForm(p=>({...p,notes:e.target.value}))} placeholder="Notes…" /></div>
                    <div style={{display:'flex',gap:'.5rem',justifyContent:'flex-end'}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setAddDoc(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={saveDoc} disabled={savingDoc}>{savingDoc?'⟳ Saving…':'✓ Save Document'}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SALARY TAB ─────────────────────────────────────── */}
          {tab === 'salary' && (
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
              <div className="card" style={{background:'linear-gradient(135deg,rgba(16,185,129,.08),rgba(59,130,246,.08))',padding:'1.1rem'}}>
                <div style={{fontSize:'.72rem',fontFamily:'var(--font-mono)',color:'var(--green)',textTransform:'uppercase',letterSpacing:'.1em',marginBottom:'.5rem'}}>Total Monthly Salary</div>
                <div style={{fontFamily:'var(--font-disp)',fontSize:'1.8rem',fontWeight:900,color:'var(--green-bright)'}}>{sar(totalSalary)}</div>
                <div style={{fontSize:'.75rem',color:'var(--text2)',marginTop:'.25rem'}}>{w.currency||'SAR'} · {(w.payment_cycle||'monthly').replace('_',' ')}</div>
              </div>
              <div className="card" style={{padding:'.85rem'}}>
                {[
                  ['Basic Salary', w.basic_salary||0, 'var(--blue)'],
                  ['Housing Allowance', w.housing_allowance||0, 'var(--violet)'],
                  ['Transport Allowance', w.transport_allowance||0, 'var(--cyan)'],
                  ['Other Allowances', w.other_allowance||0, 'var(--amber)'],
                ].map(([label, val, color]) => (
                  <div key={label as string} className="data-pair">
                    <span className="data-label">{label}</span>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:600,color:color as string}}>{sar(val as number)}</span>
                  </div>
                ))}
                {(w.bank_name||w.bank_iban) && (
                  <div style={{marginTop:'.75rem',paddingTop:'.75rem',borderTop:'1px solid var(--border)'}}>
                    <div style={{fontSize:'.72rem',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.4rem'}}>Bank Details</div>
                    {w.bank_name && <div className="data-pair"><span className="data-label">Bank</span><span className="data-value">{w.bank_name}</span></div>}
                    {w.bank_iban && <div className="data-pair"><span className="data-label">IBAN</span><span className="data-value" style={{fontFamily:'var(--font-mono)',fontSize:'.78rem'}}>{w.bank_iban}</span></div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EDIT TAB ───────────────────────────────────────── */}
          {tab === 'edit' && su && (
            <div style={{display:'flex',flexDirection:'column',gap:'.85rem'}}>
              <div className="card" style={{padding:'.85rem'}}>
                <div style={{fontWeight:600,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.75rem'}}>Basic Information</div>
                <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={e=>set('full_name',e.target.value)} /></div>
                    <div><label className="label">Arabic Name</label><input className="input" value={form.arabic_name} onChange={e=>set('arabic_name',e.target.value)} style={{direction:'rtl'}} /></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Gender</label>
                      <select className="input" value={form.gender} onChange={e=>set('gender',e.target.value)}>
                        {['male','female','other'].map(v=><option key={v}>{v}</option>)}
                      </select></div>
                    <div><label className="label">Nationality</label>
                      <select className="input" value={form.nationality} onChange={e=>set('nationality',e.target.value)}>
                        {NATS.map(n=><option key={n}>{n}</option>)}
                      </select></div>
                    <div><label className="label">Date of Birth</label><input className="input" type="date" value={form.date_of_birth} onChange={e=>set('date_of_birth',e.target.value)} /></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e=>set('phone',e.target.value)} /></div>
                    <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} /></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{padding:'.85rem'}}>
                <div style={{fontWeight:600,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.75rem'}}>Employment</div>
                <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Position</label><input className="input" value={form.position} onChange={e=>set('position',e.target.value)} /></div>
                    <div><label className="label">Department</label>
                      <select className="input" value={form.department} onChange={e=>set('department',e.target.value)}>
                        {DEPTS.map(d=><option key={d}>{d}</option>)}
                      </select></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Status</label>
                      <select className="input" value={form.status} onChange={e=>set('status',e.target.value)}>
                        {['active','on_leave','inactive','terminated'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}
                      </select></div>
                    <div><label className="label">Join Date</label><input className="input" type="date" value={form.hire_date} onChange={e=>set('hire_date',e.target.value)} /></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">Basic Salary</label><input className="input" type="number" value={form.basic_salary} onChange={e=>set('basic_salary',e.target.value)} placeholder="0" /></div>
                    <div><label className="label">Housing</label><input className="input" type="number" value={form.housing_allowance} onChange={e=>set('housing_allowance',e.target.value)} placeholder="0" /></div>
                    <div><label className="label">Transport</label><input className="input" type="number" value={form.transport_allowance} onChange={e=>set('transport_allowance',e.target.value)} placeholder="0" /></div>
                    <div><label className="label">Other</label><input className="input" type="number" value={form.other_allowance} onChange={e=>set('other_allowance',e.target.value)} placeholder="0" /></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{padding:'.85rem'}}>
                <div style={{fontWeight:600,fontSize:'.8rem',color:'var(--text2)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:'.75rem'}}>Identity & Notes</div>
                <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.65rem'}}>
                    <div><label className="label">National ID</label><input className="input" value={form.national_id_number} onChange={e=>set('national_id_number',e.target.value)} /></div>
                    <div><label className="label">Passport No.</label><input className="input" value={form.passport_number} onChange={e=>set('passport_number',e.target.value)} /></div>
                    <div><label className="label">Iqama No.</label><input className="input" value={form.iqama_number} onChange={e=>set('iqama_number',e.target.value)} /></div>
                  </div>
                  <div><label className="label">Notes</label>
                    <textarea className="input" rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} /></div>
                </div>
              </div>

              <div style={{display:'flex',gap:'.75rem',justifyContent:'flex-end'}}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'⟳ Saving…':'✓ Save Changes'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Multi-Step Add Employee Form ──────────────────────────────────────────────
function AddEmployeeModal({ onClose, onCreated }: { onClose:()=>void; onCreated:()=>void }) {
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5
  const [form, setForm] = useState({...EMPTY_FORM})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  function set(k: string, v: string) { setForm(p => ({...p,[k]:v})) }

  async function uploadProfilePhoto(file: File) {
    setUploadingPhoto(true)
    const url = await uploadPhoto(file)
    if (url) { setPhotoUrl(url); setForm(p=>({...p,photo_url:url})) }
    setUploadingPhoto(false)
  }

  async function submit() {
    if (!form.full_name.trim()) { setErr('Full name is required'); return }
    if (!form.phone.trim()) { setErr('Phone number is required'); return }
    setSaving(true); setErr('')
    try {
      await api.post('/workers', { ...form, photo_url: photoUrl || undefined })
      onCreated(); onClose()
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Failed to create employee') }
    setSaving(false)
  }

  const stepTitles = ['Basic Info','Contact','Job Details','Identity & Bank','Review']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-lg" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">New Employee</div>
            <div style={{fontSize:'.75rem',color:'var(--text2)',marginTop:'.15rem'}}>Step {step} of {TOTAL_STEPS}: {stepTitles[step-1]}</div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{padding:'0 1.25rem .5rem',background:'var(--card)'}}>
          <div className="progress-track">
            <div className="progress-fill" style={{width:`${(step/TOTAL_STEPS)*100}%`,background:'var(--blue)',transition:'width .3s'}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'.4rem'}}>
            {stepTitles.map((t,i) => (
              <span key={i} style={{fontSize:'.65rem',color:step>i?'var(--blue)':step===i+1?'var(--text)':'var(--text3)',fontWeight:step===i+1?700:400}}>{t}</span>
            ))}
          </div>
        </div>

        <div className="modal-body">
          {err && <div className="alert alert-error" style={{marginBottom:'.75rem'}}>⚠️ {err}</div>}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
              {/* Photo upload */}
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'.65rem',padding:'1rem',background:'var(--hover-bg)',borderRadius:'var(--radius-lg)'}}>
                {photoUrl
                  ? <img src={photoUrl} alt="Preview" style={{width:80,height:80,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--blue)'}} />
                  : <div style={{width:80,height:80,borderRadius:'50%',background:'var(--card2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'2rem',border:'2px dashed var(--border2)'}}>👤</div>
                }
                <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                  {uploadingPhoto ? '⟳ Uploading…' : '📷 Upload Photo'}
                  <input type="file" accept="image/*" capture="environment" style={{display:'none'}}
                    onChange={e => { const f=e.target.files?.[0]; if(f) uploadProfilePhoto(f) }} />
                </label>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div className="form-col-full"><label className="label">Full Name *</label><input className="input" value={form.full_name} onChange={e=>set('full_name',e.target.value)} placeholder="e.g. Mohammad Ali" /></div>
                <div className="form-col-full"><label className="label">Arabic Name</label><input className="input" value={form.arabic_name} onChange={e=>set('arabic_name',e.target.value)} placeholder="الاسم بالعربي" style={{direction:'rtl'}} /></div>
                <div><label className="label">Gender</label>
                  <select className="input" value={form.gender} onChange={e=>set('gender',e.target.value)}>
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select></div>
                <div><label className="label">Date of Birth</label><input className="input" type="date" value={form.date_of_birth} onChange={e=>set('date_of_birth',e.target.value)} /></div>
                <div><label className="label">Nationality</label>
                  <select className="input" value={form.nationality} onChange={e=>set('nationality',e.target.value)}>
                    {NATS.map(n=><option key={n}>{n}</option>)}
                  </select></div>
                <div><label className="label">Marital Status</label>
                  <select className="input" value={form.marital_status} onChange={e=>set('marital_status',e.target.value)}>
                    {['single','married','divorced','widowed'].map(v=><option key={v}>{v}</option>)}
                  </select></div>
              </div>
            </div>
          )}

          {/* Step 2: Contact */}
          {step === 2 && (
            <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
              <div><label className="label">Phone Number *</label><input className="input" type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="+966 5x xxx xxxx" /></div>
              <div><label className="label">Phone 2 (Optional)</label><input className="input" type="tel" value={form.phone2} onChange={e=>set('phone2',e.target.value)} /></div>
              <div><label className="label">Email Address</label><input className="input" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="employee@example.com" /></div>
              <div><label className="label">Home Address</label><textarea className="input" rows={2} value={form.address} onChange={e=>set('address',e.target.value)} placeholder="City, Country" /></div>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:'.65rem',marginTop:'.25rem'}}>
                <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--amber)',marginBottom:'.5rem'}}>🚨 Emergency Contact</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                  <div><label className="label">Contact Name</label><input className="input" value={form.emergency_contact_name} onChange={e=>set('emergency_contact_name',e.target.value)} /></div>
                  <div><label className="label">Contact Phone</label><input className="input" type="tel" value={form.emergency_contact_phone} onChange={e=>set('emergency_contact_phone',e.target.value)} /></div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Job Details */}
          {step === 3 && (
            <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">Position / Job Title</label><input className="input" value={form.position} onChange={e=>set('position',e.target.value)} placeholder="e.g. Site Manager" /></div>
                <div><label className="label">Department</label>
                  <select className="input" value={form.department} onChange={e=>set('department',e.target.value)}>
                    {DEPTS.map(d=><option key={d}>{d}</option>)}
                  </select></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">Employment Type</label>
                  <select className="input" value={form.employment_type} onChange={e=>set('employment_type',e.target.value)}>
                    <option value="full_time">Full-time</option><option value="part_time">Part-time</option>
                    <option value="contract">Contract</option><option value="intern">Intern</option>
                  </select></div>
                <div><label className="label">Join Date</label><input className="input" type="date" value={form.hire_date} onChange={e=>set('hire_date',e.target.value)} /></div>
              </div>
              <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--green)',marginTop:'.25rem'}}>💰 Salary Breakdown</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">Basic Salary (SAR)</label><input className="input" type="number" min="0" value={form.basic_salary} onChange={e=>set('basic_salary',e.target.value)} placeholder="0.00" /></div>
                <div><label className="label">Housing Allowance</label><input className="input" type="number" min="0" value={form.housing_allowance} onChange={e=>set('housing_allowance',e.target.value)} placeholder="0.00" /></div>
                <div><label className="label">Transport Allowance</label><input className="input" type="number" min="0" value={form.transport_allowance} onChange={e=>set('transport_allowance',e.target.value)} placeholder="0.00" /></div>
                <div><label className="label">Other Allowances</label><input className="input" type="number" min="0" value={form.other_allowance} onChange={e=>set('other_allowance',e.target.value)} placeholder="0.00" /></div>
              </div>
              {(form.basic_salary||form.housing_allowance||form.transport_allowance||form.other_allowance) && (
                <div style={{background:'var(--green-d)',border:'1px solid rgba(16,185,129,.2)',borderRadius:'var(--radius)',padding:'.65rem 1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'.82rem',color:'var(--text2)'}}>Total Monthly Salary</span>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--green-bright)'}}>{sar([form.basic_salary,form.housing_allowance,form.transport_allowance,form.other_allowance].reduce((a,v)=>a+Number(v||0),0))}</span>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">Bank Name</label><input className="input" value={form.bank_name} onChange={e=>set('bank_name',e.target.value)} /></div>
                <div><label className="label">IBAN</label><input className="input" value={form.bank_iban} onChange={e=>set('bank_iban',e.target.value)} /></div>
              </div>
            </div>
          )}

          {/* Step 4: Identity */}
          {step === 4 && (
            <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
              <div style={{fontSize:'.78rem',color:'var(--text2)',background:'var(--amber-d)',border:'1px solid rgba(245,158,11,.2)',borderRadius:'var(--radius)',padding:'.65rem .85rem'}}>
                🔒 Identity documents are securely stored. Access restricted to HR and Admin roles.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">National ID Number</label><input className="input" value={form.national_id_number} onChange={e=>set('national_id_number',e.target.value)} /></div>
                <div><label className="label">Passport Number</label><input className="input" value={form.passport_number} onChange={e=>set('passport_number',e.target.value)} /></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.65rem'}}>
                <div><label className="label">Iqama Number</label><input className="input" value={form.iqama_number} onChange={e=>set('iqama_number',e.target.value)} /></div>
                <div><label className="label">Iqama Expiry</label><input className="input" type="date" value={form.iqama_expiry} onChange={e=>set('iqama_expiry',e.target.value)} /></div>
              </div>
              <div><label className="label">Work Permit Number</label><input className="input" value={form.work_permit_number} onChange={e=>set('work_permit_number',e.target.value)} /></div>
              <div><label className="label">Notes</label>
                <textarea className="input" rows={3} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Special skills, contract conditions, medical notes…" /></div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
              <div style={{background:'var(--blue-d)',border:'1px solid rgba(59,130,246,.2)',borderRadius:'var(--radius-lg)',padding:'1rem',textAlign:'center',marginBottom:'.25rem'}}>
                {photoUrl ? <img src={photoUrl} alt="Photo" style={{width:72,height:72,borderRadius:'50%',objectFit:'cover',margin:'0 auto .5rem',border:'2px solid var(--blue)'}} /> : <div style={{fontSize:'3rem',marginBottom:'.5rem'}}>👤</div>}
                <div style={{fontFamily:'var(--font-disp)',fontWeight:800,fontSize:'1.1rem',color:'var(--text)'}}>{form.full_name||'—'}</div>
                <div style={{fontSize:'.8rem',color:'var(--text2)',marginTop:'.2rem'}}>{form.position} · {form.department}</div>
              </div>
              <div className="card" style={{padding:'.85rem'}}>
                {[
                  ['Phone', form.phone], ['Email', form.email||'—'],
                  ['Nationality', form.nationality], ['Join Date', form.hire_date],
                  ['Employment', form.employment_type.replace('_',' ')],
                  ['Total Salary', sar([form.basic_salary,form.housing_allowance,form.transport_allowance,form.other_allowance].reduce((a,v)=>a+Number(v||0),0))],
                ].map(([l,v]) => (
                  <div key={l} className="data-pair">
                    <span className="data-label">{l}</span>
                    <span className="data-value">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button className="btn btn-ghost" onClick={()=>{setStep(s=>s-1);setErr('')}}>← Back</button>}
          <div style={{flex:1}}/>
          {step < TOTAL_STEPS
            ? <button className="btn btn-primary" onClick={()=>{setErr('');setStep(s=>s+1)}}>Next →</button>
            : <button className="btn btn-success" onClick={submit} disabled={saving}>{saving?'⟳ Creating…':'✓ Create Employee'}</button>
          }
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function WorkersPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [workers,  setWorkers]  = useState<Worker[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [deptF,    setDeptF]    = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [natF,     setNatF]     = useState('')
  const [selected, setSelected] = useState<Worker | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)

  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get<{workers: Worker[]}>('/workers')
      .then(d => { setWorkers(d.workers||[]); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = workers.filter(w => {
    const q = search.toLowerCase()
    const matchSearch = !q || w.full_name.toLowerCase().includes(q) ||
      (w.ref||'').toLowerCase().includes(q) || w.department.toLowerCase().includes(q) ||
      w.position.toLowerCase().includes(q) || (w.iqama_number||'').includes(q)
    const matchDept   = !deptF   || w.department === deptF
    const matchStatus = !statusF || w.status     === statusF
    const matchNat    = !natF    || w.nationality === natF
    return matchSearch && matchDept && matchStatus && matchNat
  })

  const depts   = [...new Set(workers.map(w=>w.department).filter(Boolean))]
  const nats    = [...new Set(workers.map(w=>w.nationality).filter(Boolean))]
  const total   = workers.length
  const active  = workers.filter(w=>w.status==='active').length
  const onLeave = workers.filter(w=>w.status==='on_leave').length
  const totalSalaryBill = workers.filter(w=>w.status==='active').reduce((a,w)=>a+(w.salary||w.basic_salary||0),0)

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">{total} total · {active} active</p>
        </div>
        {su && <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add Employee</button>}
      </div>

      {/* KPI row */}
      <div className="stat-grid" style={{marginBottom:'1.25rem'}}>
        {[
          {label:'Total Employees', val:total,           color:'var(--blue)',   icon:'👥'},
          {label:'Active',          val:active,           color:'var(--green)',  icon:'✅'},
          {label:'On Leave',        val:onLeave,          color:'var(--amber)',  icon:'🏖️'},
          {label:'Monthly Payroll', val:sar(totalSalaryBill), color:'var(--violet)', icon:'💰'},
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{color:s.color,fontSize:typeof s.val==='string'?'.9rem':'1.5rem'}}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>⚠️ {error}</div>}

      {/* Search & Filters */}
      <div style={{display:'flex',flexDirection:'column',gap:'.5rem',marginBottom:'1rem'}}>
        <input className="input" placeholder="🔍 Search by name, ID, department, iqama…"
          value={search} onChange={e=>setSearch(e.target.value)} />
        <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
          <select className="input btn-sm" style={{flex:1,minWidth:120}} value={deptF} onChange={e=>setDeptF(e.target.value)}>
            <option value="">All Depts</option>{depts.map(d=><option key={d}>{d}</option>)}
          </select>
          <select className="input btn-sm" style={{flex:1,minWidth:110}} value={statusF} onChange={e=>setStatusF(e.target.value)}>
            <option value="">All Status</option>
            {['active','on_leave','inactive','terminated'].map(v=><option key={v} value={v}>{v.replace('_',' ')}</option>)}
          </select>
          <select className="input btn-sm" style={{flex:1,minWidth:110}} value={natF} onChange={e=>setNatF(e.target.value)}>
            <option value="">All Nationalities</option>{nats.map(n=><option key={n}>{n}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={load}>↻</button>
        </div>
      </div>

      {/* Employee list */}
      {loading ? (
        <div className="loading-full"><div className="spinner"/><span style={{color:'var(--text2)',fontSize:'.85rem'}}>Loading employees…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">👷</div>
          <div className="empty-title">No employees found</div>
          <div className="empty-desc">{search ? 'Try a different search' : 'Add your first employee'}</div>
          {!search && su && <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={()=>setShowAdd(true)}>+ Add Employee</button>}
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:'.5rem'}}>
          <div style={{fontSize:'.75rem',color:'var(--text3)',marginBottom:'.25rem'}}>{filtered.length} result{filtered.length!==1?'s':''}</div>
          {filtered.map(w => <WorkerCard key={w.id} w={w} onClick={()=>setSelected(w)} />)}
        </div>
      )}

      {/* Modals */}
      {selected && (
        <EmployeeProfile
          w={selected} su={su}
          onClose={()=>setSelected(null)}
          onRefresh={() => { load(); if(selected) { api.get<{worker:Worker}>(`/workers/${selected.id}`).then(d=>setSelected(d.worker)).catch(()=>{}) } }}
        />
      )}
      {showAdd && <AddEmployeeModal onClose={()=>setShowAdd(false)} onCreated={load} />}
    </div>
  )
}
