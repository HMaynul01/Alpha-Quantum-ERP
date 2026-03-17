// src/pages/ProjectsPage.tsx — Alpha Ultimate ERP v13
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface Project {
  id: string; project_number: string; name: string; description: string
  client_name: string; status: string; priority: string
  start_date: string; end_date: string; budget: number; spent: number; progress: number
  manager_name: string; location: string; notes: string; created_at: string
}

const STATUS_COLORS: Record<string, string> = { planning:'#4f8cff', active:'#00ffb3', on_hold:'#ffe135', completed:'#bf5fff', cancelled:'#666' }
const PRIORITY_COLORS: Record<string, string> = { low:'#888', medium:'#4f8cff', high:'#ffe135', critical:'#ff3c3c' }

const EMPTY: Partial<Project> = { name:'', description:'', client_name:'', status:'planning', priority:'medium', budget:0, spent:0, progress:0, location:'', notes:'' }

export default function ProjectsPage() {
  const { user } = useAuth()
  const su = user?.role === 'superuser'

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Project>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusF ? `?status=${statusF}` : ''
      const d = await api.get<{ projects: Project[] }>(`/projects${params}`)
      setProjects(d.projects)
    } catch { setProjects([]) }
    setLoading(false)
  }, [statusF])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) await api.put('/projects', form)
      else await api.post('/projects', form)
      setModal(false); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Delete this project?')) return
    try { await api.delete('/projects'); load() } catch (e: any) { alert(e.message) }
  }

  const fmt = (n: number) => 'SAR ' + (n||0).toLocaleString('en-SA', {minimumFractionDigits:0})
  const totalActive = projects.filter(p=>p.status==='active').length
  const totalBudget = projects.reduce((s,p)=>s+Number(p.budget),0)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">{totalActive} active · Total Budget: {fmt(totalBudget)}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true) }}>+ New Project</button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display:'flex', gap:'.5rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        {['', 'planning', 'active', 'on_hold', 'completed', 'cancelled'].map(s => (
          <button key={s} className={`btn ${statusF===s?'btn-primary':''}`} style={{ fontSize:'.8rem' }}
            onClick={() => setStatusF(s)}>{s || 'All'}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>Loading…</div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>No projects found</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem' }}>
          {projects.map(p => (
            <div key={p.id} className="card" style={{ padding:'1.25rem', border:`1px solid ${STATUS_COLORS[p.status]||'var(--border)'}33` }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.75rem' }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:'.75rem', color:'var(--accent)' }}>{p.project_number}</span>
                <span className="badge" style={{ background: PRIORITY_COLORS[p.priority]+'22', color: PRIORITY_COLORS[p.priority] }}>{p.priority}</span>
              </div>
              <h3 style={{ fontWeight:700, marginBottom:'.25rem' }}>{p.name}</h3>
              {p.client_name && <div style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:'.5rem' }}>Client: {p.client_name}</div>}
              {p.description && <div style={{ fontSize:'.8rem', color:'var(--text2)', marginBottom:'.75rem' }}>{p.description.slice(0,80)}{p.description.length>80?'…':''}</div>}

              {/* Progress bar */}
              <div style={{ marginBottom:'.75rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'.75rem', marginBottom:'.25rem' }}>
                  <span style={{ color:'var(--text2)' }}>Progress</span>
                  <span style={{ color: STATUS_COLORS[p.status] }}>{p.progress}%</span>
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${p.progress}%`, background: STATUS_COLORS[p.status]||'var(--accent)', borderRadius:3, transition:'width .3s' }} />
                </div>
              </div>

              <div className="grid-2">
                <div><span style={{ color:'var(--text2)' }}>Budget: </span><span>{fmt(p.budget)}</span></div>
                <div><span style={{ color:'var(--text2)' }}>Spent: </span><span style={{ color: Number(p.spent)>Number(p.budget) ? '#ff3c3c' : 'inherit' }}>{fmt(p.spent)}</span></div>
                {p.start_date && <div><span style={{ color:'var(--text2)' }}>Start: </span>{p.start_date.slice(0,10)}</div>}
                {p.end_date && <div><span style={{ color:'var(--text2)' }}>End: </span>{p.end_date.slice(0,10)}</div>}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span className="badge" style={{ background: STATUS_COLORS[p.status]+'22', color: STATUS_COLORS[p.status] }}>{p.status}</span>
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <button className="btn btn-sm" onClick={() => { setForm({...p}); setModal(true) }}>Edit</button>
                  {su && <button className="btn btn-sm btn-danger" onClick={() => del(p.id)}>Del</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:640, width:'95vw' }}>
            <div className="modal-header">
              <h2>{form.id ? 'Edit Project' : 'New Project'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="grid-2">
              <div style={{ gridColumn:'1/-1' }}><label className="label">Project Name *</label><input className="input" value={form.name||''} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
              <div><label className="label">Client Name</label><input className="input" value={form.client_name||''} onChange={e=>setForm(f=>({...f,client_name:e.target.value}))} /></div>
              <div><label className="label">Location</label><input className="input" value={form.location||''} onChange={e=>setForm(f=>({...f,location:e.target.value}))} /></div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status||'planning'} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  {['planning','active','on_hold','completed','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="select" value={form.priority||'medium'} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
                  {['low','medium','high','critical'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Start Date</label><input className="input" type="date" value={form.start_date||''} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} /></div>
              <div><label className="label">End Date</label><input className="input" type="date" value={form.end_date||''} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} /></div>
              <div><label className="label">Budget (SAR)</label><input className="input" type="number" value={form.budget||0} onChange={e=>setForm(f=>({...f,budget:+e.target.value}))} /></div>
              <div><label className="label">Spent (SAR)</label><input className="input" type="number" value={form.spent||0} onChange={e=>setForm(f=>({...f,spent:+e.target.value}))} /></div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Progress: {form.progress||0}%</label>
                <input type="range" min={0} max={100} value={form.progress||0} onChange={e=>setForm(f=>({...f,progress:+e.target.value}))} style={{ width:'100%' }} />
              </div>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Description</label><textarea className="textarea" rows={2} value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
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
