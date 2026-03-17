// src/pages/LeadsPage.tsx — Alpha Ultimate ERP v13
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface Lead {
  id: string; lead_number: string; title: string; company_name: string
  contact_name: string; email: string; phone: string; source: string
  status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
  value: number; probability: number; expected_close: string
  assigned_to: string; assigned_name: string; notes: string; created_at: string
}

const KANBAN_COLS = [
  { key: 'new', label: 'New', color: '#4f8cff' },
  { key: 'contacted', label: 'Contacted', color: '#ffe135' },
  { key: 'qualified', label: 'Qualified', color: '#bf5fff' },
  { key: 'proposal', label: 'Proposal', color: '#00d4ff' },
  { key: 'won', label: 'Won 🎉', color: '#00ffb3' },
  { key: 'lost', label: 'Lost', color: '#ff3c3c' },
]

const EMPTY: Partial<Lead> = { title:'', company_name:'', contact_name:'', email:'', phone:'', source:'website', status:'new', value:0, probability:0, notes:'' }

export default function LeadsPage() {
  const { user } = useAuth()
  const su = user?.role === 'superuser'

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'kanban'|'table'>('kanban')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Lead>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get<{ leads: Lead[] }>('/leads')
      setLeads(d.leads)
    } catch { setLeads([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) await api.put('/leads', form)
      else await api.post('/leads', form)
      setModal(false); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    try { await api.put('/leads', { id, status }) ; load() } catch {}
  }

  const fmt = (n: number) => 'SAR ' + (n||0).toLocaleString('en-SA', { minimumFractionDigits:0 })

  const colLeads = (key: string) => leads.filter(l => l.status === key)
  const totalWon = leads.filter(l=>l.status==='won').reduce((s,l)=>s+Number(l.value),0)
  const totalPipeline = leads.filter(l=>!['won','lost'].includes(l.status)).reduce((s,l)=>s+Number(l.value),0)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Leads</h1>
          <p className="page-sub">Pipeline: {fmt(totalPipeline)} | Won: {fmt(totalWon)}</p>
        </div>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className={`btn ${view==='kanban'?'btn-primary':''}`} onClick={() => setView('kanban')}>Kanban</button>
          <button className={`btn ${view==='table'?'btn-primary':''}`} onClick={() => setView('table')}>Table</button>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true) }}>+ New Lead</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>Loading…</div>
      ) : view === 'kanban' ? (
        <div style={{ display:'flex', gap:'1rem', overflowX:'auto', paddingBottom:'1rem' }}>
          {KANBAN_COLS.map(col => (
            <div key={col.key} style={{ minWidth:220, maxWidth:260, flex:'0 0 220px' }}>
              <div style={{ padding:'.5rem .75rem', borderRadius:'var(--radius) var(--radius) 0 0', background: col.color+'22', borderBottom:`2px solid ${col.color}`, marginBottom:'.5rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:600, color:col.color, fontSize:'.85rem' }}>{col.label}</span>
                <span style={{ background:col.color+'33', color:col.color, borderRadius:99, padding:'0 .5rem', fontSize:'.75rem' }}>{colLeads(col.key).length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                {colLeads(col.key).map(lead => (
                  <div key={lead.id} className="card" style={{ padding:'.75rem', cursor:'pointer', border:`1px solid ${col.color}22` }}
                    onClick={() => { setForm({...lead}); setModal(true) }}>
                    <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.25rem' }}>{lead.title}</div>
                    {lead.company_name && <div style={{ fontSize:'.75rem', color:'var(--text2)' }}>{lead.company_name}</div>}
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:'.5rem', fontSize:'.75rem' }}>
                      <span style={{ color:'var(--accent)' }}>{fmt(lead.value)}</span>
                      <span style={{ color:'var(--text2)' }}>{lead.probability}%</span>
                    </div>
                    <div style={{ display:'flex', gap:'.25rem', marginTop:'.5rem', flexWrap:'wrap' }}>
                      {KANBAN_COLS.filter(c=>c.key!==col.key).slice(0,3).map(c => (
                        <button key={c.key} style={{ fontSize:'.65rem', padding:'1px 6px', borderRadius:99, background:c.color+'22', color:c.color, border:'none', cursor:'pointer' }}
                          onClick={e => { e.stopPropagation(); updateStatus(lead.id, c.key) }}>→{c.label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Lead</th><th>Contact</th><th>Status</th><th>Value</th><th>Prob.</th><th>Expected Close</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {leads.map(l => {
                  const col = KANBAN_COLS.find(c=>c.key===l.status)
                  return (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight:600 }}>{l.title}</div>
                        <div style={{ fontSize:'.75rem', color:'var(--text2)' }}>{l.company_name}</div>
                      </td>
                      <td>{l.contact_name}<br/><span style={{ fontSize:'.75rem', color:'var(--text2)' }}>{l.phone}</span></td>
                      <td><span className="badge" style={{ background:col?.color+'22', color:col?.color }}>{l.status}</span></td>
                      <td style={{ color:'var(--accent)' }}>{fmt(l.value)}</td>
                      <td>{l.probability}%</td>
                      <td>{l.expected_close || '—'}</td>
                      <td><button className="btn btn-sm" onClick={() => { setForm({...l}); setModal(true) }}>Edit</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:560, width:'95vw' }}>
            <div className="modal-header">
              <h2>{form.id ? 'Edit Lead' : 'New Lead'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="grid-2">
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Title *</label>
                <input className="input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
              </div>
              <div><label className="label">Company</label><input className="input" value={form.company_name||''} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} /></div>
              <div><label className="label">Contact Name *</label><input className="input" value={form.contact_name||''} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} /></div>
              <div><label className="label">Email</label><input className="input" value={form.email||''} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone||''} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
              <div>
                <label className="label">Source</label>
                <select className="select" value={form.source||'website'} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                  {['website','referral','cold_call','email','social_media','exhibition','other'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status||'new'} onChange={e=>setForm(f=>({...f,status:e.target.value as any}))}>
                  {KANBAN_COLS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div><label className="label">Value (SAR)</label><input className="input" type="number" value={form.value||0} onChange={e=>setForm(f=>({...f,value:+e.target.value}))} /></div>
              <div><label className="label">Probability %</label><input className="input" type="number" min={0} max={100} value={form.probability||0} onChange={e=>setForm(f=>({...f,probability:+e.target.value}))} /></div>
              <div><label className="label">Expected Close</label><input className="input" type="date" value={form.expected_close||''} onChange={e=>setForm(f=>({...f,expected_close:e.target.value}))} /></div>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Notes</label><textarea className="textarea" rows={2} value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
            {error && <div className="error-box" style={{ margin:'0 1.5rem' }}>{error}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
