// src/pages/TasksPage.tsx — Alpha Ultimate ERP v13
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface Task {
  id: string; project_id: string; project_name: string; title: string; description: string
  status: 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assigned_to: string; assigned_name: string; due_date: string
  estimated_hours: number; actual_hours: number; notes: string; created_at: string
}

interface Project { id: string; name: string }

const COLS = [
  { key: 'todo', label: 'To Do', color: '#888' },
  { key: 'in_progress', label: 'In Progress', color: '#4f8cff' },
  { key: 'review', label: 'Review', color: '#ffe135' },
  { key: 'done', label: 'Done', color: '#00ffb3' },
  { key: 'cancelled', label: 'Cancelled', color: '#666' },
]
const PRIORITY_COLORS: Record<string, string> = { low:'#888', medium:'#4f8cff', high:'#ffe135', critical:'#ff3c3c' }
const EMPTY: Partial<Task> = { title:'', description:'', status:'todo', priority:'medium', estimated_hours:0, notes:'' }

export default function TasksPage() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [projectF, setProjectF] = useState('')
  const [view, setView] = useState<'kanban'|'table'>('kanban')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Task>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadProjects = useCallback(async () => {
    try { const d = await api.get<{ projects: Project[] }>('/projects'); setProjects(d.projects) } catch {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = projectF ? `?project_id=${projectF}` : ''
      const d = await api.get<{ tasks: Task[] }>(`/tasks${params}`)
      setTasks(d.tasks)
    } catch { setTasks([]) }
    setLoading(false)
  }, [projectF])

  useEffect(() => { loadProjects(); }, [loadProjects])
  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) await api.put('/tasks', form)
      else await api.post('/tasks', form)
      setModal(false); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function moveTask(id: string, status: string) {
    try { await api.put('/tasks', { id, status, title: tasks.find(t=>t.id===id)?.title }); load() } catch {}
  }

  const colTasks = (key: string) => tasks.filter(t => t.status === key)
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'cancelled').length

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-sub">{tasks.length} tasks{overdue > 0 ? ` · ⚠️ ${overdue} overdue` : ''}</p>
        </div>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className={`btn ${view==='kanban'?'btn-primary':''}`} onClick={() => setView('kanban')}>Kanban</button>
          <button className={`btn ${view==='table'?'btn-primary':''}`} onClick={() => setView('table')}>Table</button>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true) }}>+ New Task</button>
        </div>
      </div>

      {/* Project filter */}
      <div style={{ marginBottom:'1.5rem' }}>
        <select className="select" value={projectF} onChange={e => setProjectF(e.target.value)} style={{ minWidth:200 }}>
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>Loading…</div>
      ) : view === 'kanban' ? (
        <div style={{ display:'flex', gap:'1rem', overflowX:'auto', paddingBottom:'1rem' }}>
          {COLS.map(col => (
            <div key={col.key} style={{ minWidth:220, flex:'0 0 220px' }}>
              <div style={{ padding:'.5rem .75rem', borderRadius:'var(--radius) var(--radius) 0 0', background:col.color+'22', borderBottom:`2px solid ${col.color}`, marginBottom:'.5rem', display:'flex', justifyContent:'space-between' }}>
                <span style={{ fontWeight:600, color:col.color, fontSize:'.85rem' }}>{col.label}</span>
                <span style={{ background:col.color+'33', color:col.color, borderRadius:99, padding:'0 .5rem', fontSize:'.75rem' }}>{colTasks(col.key).length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                {colTasks(col.key).map(task => {
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                  return (
                    <div key={task.id} className="card" style={{ padding:'.75rem', cursor:'pointer', border:`1px solid ${isOverdue ? '#ff3c3c' : col.color+'22'}` }}
                      onClick={() => { setForm({...task}); setModal(true) }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'.25rem' }}>
                        <span style={{ fontSize:'.7rem', background: PRIORITY_COLORS[task.priority]+'22', color: PRIORITY_COLORS[task.priority], borderRadius:99, padding:'0 .4rem' }}>{task.priority}</span>
                        {isOverdue && <span style={{ fontSize:'.7rem', color:'#ff3c3c' }}>⚠ overdue</span>}
                      </div>
                      <div style={{ fontWeight:600, fontSize:'.85rem', marginBottom:'.25rem' }}>{task.title}</div>
                      {task.project_name && <div style={{ fontSize:'.7rem', color:'var(--text2)', marginBottom:'.25rem' }}>📁 {task.project_name}</div>}
                      {task.assigned_name && <div style={{ fontSize:'.7rem', color:'var(--text2)' }}>👤 {task.assigned_name}</div>}
                      {task.due_date && <div style={{ fontSize:'.7rem', color: isOverdue ? '#ff3c3c' : 'var(--text2)', marginTop:'.25rem' }}>📅 {task.due_date.slice(0,10)}</div>}
                      <div style={{ display:'flex', gap:'.25rem', marginTop:'.5rem', flexWrap:'wrap' }}>
                        {COLS.filter(c=>c.key!==col.key && c.key!=='cancelled').slice(0,2).map(c => (
                          <button key={c.key} style={{ fontSize:'.65rem', padding:'1px 6px', borderRadius:99, background:c.color+'22', color:c.color, border:'none', cursor:'pointer' }}
                            onClick={e => { e.stopPropagation(); moveTask(task.id, c.key) }}>→{c.label}</button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Project</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Due Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tasks.map(t => {
                const col = COLS.find(c=>c.key===t.status)
                const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight:600 }}>{t.title}</td>
                    <td style={{ fontSize:'.8rem', color:'var(--text2)' }}>{t.project_name || '—'}</td>
                    <td><span className="badge" style={{ background: PRIORITY_COLORS[t.priority]+'22', color: PRIORITY_COLORS[t.priority] }}>{t.priority}</span></td>
                    <td><span className="badge" style={{ background: col?.color+'22', color: col?.color }}>{t.status}</span></td>
                    <td>{t.assigned_name || '—'}</td>
                    <td style={{ color: isOverdue ? '#ff3c3c' : 'inherit' }}>{t.due_date?.slice(0,10) || '—'}</td>
                    <td><button className="btn btn-sm" onClick={() => { setForm({...t}); setModal(true) }}>Edit</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:580, width:'95vw' }}>
            <div className="modal-header">
              <h2>{form.id ? 'Edit Task' : 'New Task'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="grid-2">
              <div style={{ gridColumn:'1/-1' }}><label className="label">Title *</label><input className="input" value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
              <div>
                <label className="label">Project</label>
                <select className="select" value={form.project_id||''} onChange={e=>setForm(f=>({...f,project_id:e.target.value}))}>
                  <option value="">No Project</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status||'todo'} onChange={e=>setForm(f=>({...f,status:e.target.value as any}))}>
                  {COLS.map(c=><option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="select" value={form.priority||'medium'} onChange={e=>setForm(f=>({...f,priority:e.target.value as any}))}>
                  {['low','medium','high','critical'].map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><label className="label">Due Date</label><input className="input" type="date" value={form.due_date||''} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} /></div>
              <div><label className="label">Estimated Hours</label><input className="input" type="number" value={form.estimated_hours||0} onChange={e=>setForm(f=>({...f,estimated_hours:+e.target.value}))} /></div>
              <div><label className="label">Actual Hours</label><input className="input" type="number" value={form.actual_hours||0} onChange={e=>setForm(f=>({...f,actual_hours:+e.target.value}))} /></div>
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
