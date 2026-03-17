// src/pages/PermissionsPage.tsx — Alpha Quantum ERP v16
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

interface UserRow {
  id: string; username: string; full_name: string; role: string
  department: string; permissions: Record<string, string>
}

const MODULES = [
  { key:'finance',     label:'Finance',     icon:'💰' },
  { key:'expenses',    label:'Expenses',    icon:'🧾' },
  { key:'budget',      label:'Budget',      icon:'📊' },
  { key:'assets',      label:'Assets',      icon:'🏗️' },
  { key:'investments', label:'Investments', icon:'📈' },
  { key:'liabilities', label:'Liabilities', icon:'🏦' },
  { key:'workers',     label:'Workers',     icon:'👷' },
  { key:'salary',      label:'Salary',      icon:'💵' },
  { key:'timesheet',   label:'Timesheet',   icon:'🕐' },
  { key:'crm',         label:'CRM',         icon:'🏢' },
  { key:'projects',    label:'Projects',    icon:'📁' },
  { key:'reports',     label:'Reports',     icon:'📋' },
]

const LEVELS = [
  { value:'none',               label:'No Access',    color:'var(--text3)' },
  { value:'submit_only',        label:'Submit Only',  color:'var(--amber)' },
  { value:'view_own',           label:'View Own',     color:'var(--blue)' },
  { value:'view_all',           label:'View All',     color:'var(--cyan)' },
  { value:'full_control',       label:'Full Control', color:'var(--green)' },
]

export default function PermissionsPage() {
  const { user } = useAuth()
  const isAdmin = ['creator','cube_admin','superuser'].includes(user?.role || '')

  const [users,    setUsers]    = useState<UserRow[]>([])
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState<string | null>(null)
  const [msg,      setMsg]      = useState('')
  const [err,      setErr]      = useState('')
  const [search,   setSearch]   = useState('')

  function load() {
    setLoading(true)
    api.get<{ users: UserRow[] }>('/permissions')
      .then(d => setUsers((d.users || []).filter(u => !['creator','cube_admin'].includes(u.role))))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function setPermission(userId: string, module: string, level: string) {
    const key = `${userId}:${module}`
    setSaving(key); setMsg(''); setErr('')
    try {
      await api.post('/permissions', { user_id: userId, module, level })
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, permissions: { ...u.permissions, [module]: level } }
          : u
      ))
      if (selected?.id === userId) {
        setSelected(prev => prev ? { ...prev, permissions: { ...prev.permissions, [module]: level } } : null)
      }
      setMsg(`${module} → ${level} saved ✓`)
      setTimeout(() => setMsg(''), 2500)
    } catch(e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(null) }
  }

  const filtered = users.filter(u =>
    !search || [u.full_name, u.username, u.department, u.role]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()))
  )

  if (!isAdmin) return (
    <div className="page-content">
      <div className="empty-state">
        <div className="empty-icon">🔐</div>
        <div className="empty-title">Admin Access Required</div>
      </div>
    </div>
  )

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Permissions</h1>
          <p className="page-sub">Manage module access for each user</p>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* Legend */}
      <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
        {LEVELS.map(l => (
          <span key={l.value} style={{ display:'flex', alignItems:'center', gap:'.35rem', padding:'.22rem .65rem', background:'var(--hover-bg)', border:'1px solid var(--border)', borderRadius:999, fontSize:'.72rem', fontWeight:600, color:l.color }}>
            {l.label}
          </span>
        ))}
      </div>

      <div className="grid-sidebar">
        {/* User list */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          <div style={{ padding:'.8rem', borderBottom:'1px solid var(--border)' }}>
            <input className="input" placeholder="🔍 Search users…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner"/></div>
          ) : (
            <div>
              {filtered.map(u => (
                <div key={u.id}
                  onClick={() => setSelected(u === selected ? null : u)}
                  style={{ padding:'.8rem 1rem', cursor:'pointer', borderBottom:'1px solid var(--border)', background:selected?.id===u.id?'var(--blue-d)':'transparent', transition:'background .12s' }}>
                  <div style={{ fontWeight:600, fontSize:'.85rem', color:'var(--text)' }}>{u.full_name}</div>
                  <div style={{ fontSize:'.74rem', color:'var(--text3)', display:'flex', gap:'.4rem', marginTop:'.15rem' }}>
                    <span>@{u.username}</span>
                    <span>·</span>
                    <span style={{ textTransform:'capitalize' }}>{u.role}</span>
                    {u.department && <><span>·</span><span>{u.department}</span></>}
                  </div>
                  {/* Mini permission dots */}
                  <div style={{ display:'flex', gap:'.25rem', marginTop:'.4rem', flexWrap:'wrap' }}>
                    {MODULES.slice(0,6).map(m => {
                      const lv = u.permissions?.[m.key] || 'none'
                      const col = LEVELS.find(l => l.value === lv)?.color || 'var(--text3)'
                      return (
                        <div key={m.key} title={`${m.label}: ${lv}`}
                          style={{ width:8, height:8, borderRadius:'50%', background:lv==='none'?'var(--border2)':col }} />
                      )
                    })}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="empty-state" style={{ padding:'2rem' }}>
                  <div className="empty-desc">No users found</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Permission matrix for selected user */}
        {selected && (
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <div style={{ padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div className="card-title">{selected.full_name}</div>
                <div style={{ fontSize:'.78rem', color:'var(--text2)', marginTop:'.1rem' }}>@{selected.username} · {selected.role}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            <div style={{ padding:'1rem 1.25rem' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'.75rem' }}>
                {MODULES.map(m => {
                  const current = selected.permissions?.[m.key] || 'none'
                  return (
                    <div key={m.key} style={{ padding:'1rem', background:'var(--hover-bg)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.65rem' }}>
                        <span>{m.icon}</span>
                        <span style={{ fontWeight:600, fontSize:'.86rem', color:'var(--text)' }}>{m.label}</span>
                        <span style={{ marginLeft:'auto', fontSize:'.7rem', fontWeight:600, color: LEVELS.find(l=>l.value===current)?.color || 'var(--text3)' }}>
                          {LEVELS.find(l => l.value === current)?.label}
                        </span>
                      </div>
                      <div style={{ display:'flex', gap:'.3rem', flexWrap:'wrap' }}>
                        {LEVELS.map(lv => {
                          const key = `${selected.id}:${m.key}`
                          const isActive = current === lv.value
                          const isSaving = saving === key
                          return (
                            <button key={lv.value}
                              onClick={() => !isActive && setPermission(selected.id, m.key, lv.value)}
                              disabled={isSaving}
                              style={{
                                padding:'.22rem .55rem', borderRadius:999, fontSize:'.69rem', fontWeight:600,
                                border:`1px solid ${isActive ? lv.color : 'var(--border2)'}`,
                                background: isActive ? lv.color + '20' : 'transparent',
                                color: isActive ? lv.color : 'var(--text3)',
                                cursor: isActive ? 'default' : 'pointer', transition:'all .12s',
                              }}>
                              {isSaving ? '…' : lv.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!selected && !loading && (
          <div className="empty-state card">
            <div className="empty-icon">👈</div>
            <div className="empty-title">Select a User</div>
            <div className="empty-desc">Click a user to manage their permissions</div>
          </div>
        )}
      </div>
    </div>
  )
}
