// src/pages/UsersPage.tsx — Alpha Quantum ERP v16
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

interface UserRow {
  id: string; username: string; email: string; full_name: string
  role: string; department: string; phone: string; whatsapp_number: string
  is_active: boolean; created_at: string; last_login: string; cube_id?: string
}

const ROLES   = ['staff','superuser','cube_admin']
const DEPTS   = ['General','Management','Finance','Operations','HR','IT','Maintenance','Safety','Logistics','Field Team']
const EMPTY   = { username:'', email:'', password:'', full_name:'', role:'staff', department:'General', phone:'', whatsapp_number:'' }

export default function UsersPage() {
  const { user }        = useAuth()
  const isSu            = ['creator','cube_admin','superuser'].includes(user?.role || '')

  const [users,    setUsers]    = useState<UserRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [err,      setErr]      = useState('')
  const [msg,      setMsg]      = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [search,   setSearch]   = useState('')
  const [form,     setForm]     = useState(EMPTY)
  const [saving,   setSaving]   = useState(false)
  const [resetPw,  setResetPw]  = useState('')
  const [resetting, setResetting] = useState(false)
  const [editMode, setEditMode] = useState(false)

  function load() {
    setLoading(true)
    api.get<{ users: UserRow[] }>('/users')
      .then(d => setUsers(d.users || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    if (!form.username || !form.email || !form.full_name || !form.password) {
      setErr('Username, email, full name and password are required'); return
    }
    setSaving(true); setErr(''); setMsg('')
    try {
      await api.post('/users', form)
      setMsg(`User @${form.username} created successfully ✓`)
      setForm(EMPTY); setShowForm(false); load()
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Create failed') }
    finally { setSaving(false) }
  }

  async function updateUser() {
    if (!selected) return
    setSaving(true); setErr(''); setMsg('')
    try {
      await api.patch(`/users/${selected.id}`, {
        full_name: selected.full_name, role: selected.role,
        department: selected.department, phone: selected.phone,
        whatsapp_number: selected.whatsapp_number, email: selected.email,
        is_active: selected.is_active,
      })
      setMsg('User updated ✓'); setEditMode(false); load()
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Update failed') }
    finally { setSaving(false) }
  }

  async function deactivateUser(uid: string, name: string) {
    if (!confirm(`Deactivate user "${name}"?`)) return
    try {
      await api.post('/users/delete', { user_id: uid })
      setMsg('User deactivated'); if (selected?.id === uid) setSelected(null); load()
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Failed') }
  }

  async function doResetPw() {
    if (!selected || !resetPw) { setErr('Enter a new password'); return }
    if (resetPw.length < 8) { setErr('Password must be at least 8 characters'); return }
    setResetting(true); setErr(''); setMsg('')
    try {
      await api.post('/creator/reset-password', { user_id: selected.id, new_password: resetPw })
      setMsg('Password reset ✓'); setResetPw('')
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Reset failed') }
    finally { setResetting(false) }
  }

  const filtered = users.filter(u =>
    !search || [u.full_name, u.username, u.email, u.department, u.role].some(f =>
      f?.toLowerCase().includes(search.toLowerCase())
    )
  )

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-sub">{users.length} total users</p>
        </div>
        {isSu && (
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setSelected(null); setErr(''); setMsg('') }}>
            + New User
          </button>
        )}
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="grid-sidebar">
        {/* User list */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', gap:'.7rem', alignItems:'center' }}>
            <input className="input" style={{ flex:1 }} placeholder="🔍 Search users…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={load}>↻</button>
          </div>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'2.5rem' }}><div className="spinner"/></div>
          ) : (
            <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Dept</th>
                    <th>Status</th>
                    {isSu && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="table-empty">No users found</td></tr>
                  ) : filtered.map(u => (
                    <tr key={u.id} onClick={() => { setSelected(u); setEditMode(false); setErr(''); setMsg('') }}
                      style={{ background: selected?.id === u.id ? 'var(--blue-d)' : '' }}>
                      <td>
                        <div style={{ fontWeight:600, color:'var(--text)' }}>{u.full_name}</div>
                        <div style={{ fontSize:'.76rem', color:'var(--text3)', fontFamily:'var(--font-mono)' }}>@{u.username}</div>
                        <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{u.email}</div>
                      </td>
                      <td>
                        <span className={`badge ${u.role === 'creator' ? 'badge-su' : u.role === 'cube_admin' ? 'badge-hold' : u.role === 'superuser' ? 'badge-approved' : 'badge-inactive'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ fontSize:'.83rem', color:'var(--text2)' }}>{u.department || '—'}</td>
                      <td>
                        <span className={`badge ${u.is_active ? 'badge-active' : 'badge-inactive'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {isSu && (
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-danger btn-sm" onClick={() => deactivateUser(u.id, u.full_name)}
                            disabled={u.id === user?.id}>
                            Deactivate
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">{selected.full_name}</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {editMode ? (
              <div>
                {['full_name','email','phone','whatsapp_number'].map(f => (
                  <div key={f} className="form-row">
                    <label className="label">{f.replace('_',' ')}</label>
                    <input className="input" value={String((selected as Record<string,unknown>)[f] || '')}
                      onChange={e => setSelected(s => s ? {...s, [f]: e.target.value} : null)} />
                  </div>
                ))}
                <div className="form-row">
                  <label className="label">Role</label>
                  <select className="input" value={selected.role}
                    onChange={e => setSelected(s => s ? {...s, role: e.target.value} : null)}>
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label className="label">Department</label>
                  <select className="input" value={selected.department}
                    onChange={e => setSelected(s => s ? {...s, department: e.target.value} : null)}>
                    {DEPTS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', gap:'.5rem', marginTop:'.5rem' }}>
                  <button className="btn btn-primary" onClick={updateUser} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div>
                {[
                  ['Username', '@' + selected.username],
                  ['Email',    selected.email],
                  ['Role',     selected.role],
                  ['Dept',     selected.department || '—'],
                  ['Phone',    selected.phone || '—'],
                  ['Status',   selected.is_active ? 'Active' : 'Inactive'],
                  ['Created',  new Date(selected.created_at).toLocaleDateString('en-GB')],
                  ['Last Login',selected.last_login ? new Date(selected.last_login).toLocaleDateString('en-GB') : 'Never'],
                ].map(([l, v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'.55rem 0', borderBottom:'1px solid var(--border)', fontSize:'.84rem' }}>
                    <span style={{ color:'var(--text2)' }}>{l}</span>
                    <span style={{ color:'var(--text)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}

                {isSu && (
                  <div style={{ marginTop:'1.1rem', display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>✏️ Edit</button>
                  </div>
                )}

                {/* Reset password (creator only) */}
                {user?.role === 'creator' && (
                  <div style={{ marginTop:'1.25rem', paddingTop:'1rem', borderTop:'1px solid var(--border)' }}>
                    <div className="label" style={{ marginBottom:'.5rem' }}>Reset Password</div>
                    <div style={{ display:'flex', gap:'.5rem' }}>
                      <input className="input" type="password" placeholder="New password (min 8)"
                        value={resetPw} onChange={e => setResetPw(e.target.value)} style={{ flex:1 }} />
                      <button className="btn btn-warning btn-sm" onClick={doResetPw} disabled={resetting}>
                        {resetting ? '…' : 'Reset'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New user modal */}
      {showForm && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth:480 }}>
            <div className="modal-header">
              <div className="modal-title">New User</div>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={createUser}>
              <div className="form-grid">
                <div className="form-row">
                  <label className="label">Full Name *</label>
                  <input className="input" required value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} placeholder="John Smith" />
                </div>
                <div className="form-row">
                  <label className="label">Username *</label>
                  <input className="input" required value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="jsmith" />
                </div>
                <div className="form-row">
                  <label className="label">Email *</label>
                  <input className="input" type="email" required value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="john@company.com" />
                </div>
                <div className="form-row">
                  <label className="label">Password *</label>
                  <input className="input" type="password" required value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Min 8 characters" />
                </div>
                <div className="form-row">
                  <label className="label">Role</label>
                  <select className="input" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                    {ROLES.map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <label className="label">Department</label>
                  <select className="input" value={form.department} onChange={e=>setForm(f=>({...f,department:e.target.value}))}>
                    {DEPTS.map(d=><option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating…' : '+ Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
