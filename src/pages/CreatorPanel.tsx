// src/pages/CreatorPanel.tsx — Alpha Quantum ERP v15 — FULL CREATOR PANEL
import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import logoUrl from '../assets/logo-alpha.png'

type Tab = 'overview'|'cubes'|'requests'|'users'|'audit'|'security'

interface Stats { users_total:number; cubes_total:number; pending_requests:number; expenses_total:number; invoices_total:number; db_time:string }
interface CubeRequest { id:string; company_name:string; admin_name:string; admin_email:string; admin_phone:string; plan:string; status:string; message:string; created_at:string }
interface Cube { id:string; slug:string; company_name:string; plan:string; is_active:boolean; created_at:string; settings?:Record<string,string> }
interface UserRow { id:string; username:string; full_name:string; email:string; role:string; cube_id:string|null; is_active:boolean; created_at:string }
interface AuditLog { id:string; user_name:string; action:string; entity_type:string; cube_id:string|null; created_at:string }

const PLAN_COLORS:Record<string,string> = { free:'var(--text3)', starter:'var(--green)', business:'var(--blue)', enterprise:'var(--violet)' }

export default function CreatorPanel() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats|null>(null)
  const [requests, setRequests] = useState<CubeRequest[]>([])
  const [cubes, setCubes] = useState<Cube[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [audit, setAudit] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Approve modal
  const [approveModal, setApproveModal] = useState<CubeRequest|null>(null)
  const [approveForm, setApproveForm] = useState({ admin_username:'', admin_password:'', cube_slug:'' })
  const [approving, setApproving] = useState(false)

  // Reset password modal
  const [resetModal, setResetModal] = useState<UserRow|null>(null)
  const [newPass, setNewPass] = useState('')
  const [resetting, setResetting] = useState(false)

  const flash = (m:string,isErr=false) => { if(isErr)setErr(m);else setMsg(m); setTimeout(()=>{setMsg('');setErr('')},3500) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s,r,c,u,a] = await Promise.allSettled([
        api.get<{stats:Stats}>('/creator/stats'),
        api.get<{requests:CubeRequest[]}>('/creator/cube-requests'),
        api.get<{cubes:Cube[]}>('/creator/cubes'),
        api.get<{users:UserRow[]}>('/creator/all-users'),
        api.get<{logs:AuditLog[]}>('/creator/audit-log'),
      ])
      if(s.status==='fulfilled') setStats(s.value.stats)
      if(r.status==='fulfilled') setRequests(r.value.requests||[])
      if(c.status==='fulfilled') setCubes(c.value.cubes||[])
      if(u.status==='fulfilled') setUsers(u.value.users||[])
      if(a.status==='fulfilled') setAudit(a.value.logs||[])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function approveRequest() {
    if (!approveModal) return
    setApproving(true)
    try {
      await api.post('/creator/cube-requests/approve', {
        request_id: approveModal.id,
        admin_username: approveForm.admin_username,
        admin_password: approveForm.admin_password,
        cube_slug: approveForm.cube_slug,
        plan: approveModal.plan
      })
      flash(`✅ Cube "${approveForm.cube_slug}" created for ${approveModal.company_name}`)
      setApproveModal(null); setApproveForm({admin_username:'',admin_password:'',cube_slug:''})
      load()
    } catch(e:unknown) { flash(e instanceof Error ? e.message : 'Approval failed', true) }
    setApproving(false)
  }

  async function rejectRequest(id:string) {
    if (!confirm('Reject this request?')) return
    try { await api.post('/creator/cube-requests/reject', { request_id:id, reason:'Rejected by Creator' }); flash('Request rejected'); load() }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
  }

  async function toggleCube(cubeId:string, isActive:boolean) {
    try { await api.patch('/creator/cubes/update', { cube_id:cubeId, is_active:!isActive }); flash(`Cube ${isActive?'deactivated':'activated'}`); load() }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
  }

  async function resetPassword() {
    if (!resetModal||!newPass) return
    setResetting(true)
    try { await api.post('/creator/reset-password', { user_id:resetModal.id, new_password:newPass }); flash(`Password reset for ${resetModal.full_name}`); setResetModal(null); setNewPass('') }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
    setResetting(false)
  }

  const S = { container:{ minHeight:'100dvh', background:'var(--base)', display:'flex', flexDirection:'column' as const },
    header:{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'.75rem 1.5rem', display:'flex', alignItems:'center', gap:'1rem', justifyContent:'space-between' },
    body:{ flex:1, padding:'1.5rem', maxWidth:1400, margin:'0 auto', width:'100%' },
    card:{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem' },
    label:{ color:'var(--text2)', fontSize:'.75rem', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.08em' },
    val:{ fontSize:'1.8rem', fontWeight:800, fontFamily:'var(--font-disp)' },
    btn:(color:string)=>({ padding:'.45rem .9rem', background:color, color:'#fff', border:'none', borderRadius:'var(--radius)', cursor:'pointer', fontWeight:600, fontSize:'.82rem' }),
    input:{ padding:'.6rem .8rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.9rem', width:'100%' }
  }

  const TABS:{ id:Tab; label:string; icon:string; badge?:number }[] = [
    {id:'overview', label:'Overview', icon:'◈'},
    {id:'requests', label:'Cube Requests', icon:'📥', badge:requests.filter(r=>r.status==='pending').length||undefined},
    {id:'cubes',    label:'All Cubes',    icon:'🧊'},
    {id:'users',    label:'All Users',    icon:'👥'},
    {id:'audit',    label:'Audit Log',    icon:'📋'},
    {id:'security', label:'Security',     icon:'🔐'},
  ]

  return (
    <div style={S.container}>
      {/* Header */}
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
          <img src={logoUrl} alt="Logo" style={{height:36}} onError={e=>(e.currentTarget.style.display='none')} />
          <div>
            <div style={{fontFamily:'var(--font-disp)',fontWeight:800,fontSize:'1rem',background:'linear-gradient(135deg,#f59e0b,#ef4444)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              CREATOR PANEL
            </div>
            <div style={{color:'var(--text2)',fontSize:'.75rem'}}>Alpha Quantum ERP · System Control</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'.75rem'}}>
          <span style={{color:'var(--amber)',fontSize:'.82rem',fontWeight:600}}>👑 {user?.full_name}</span>
          <button onClick={()=>nav('/')} style={S.btn('var(--blue)')}>ERP App</button>
          <button onClick={()=>{logout();nav('/login')}} style={S.btn('var(--rose-d)')}>Logout</button>
        </div>
      </header>

      {/* Flash messages */}
      {(msg||err) && (
        <div style={{padding:'.75rem 1.5rem',background:err?'var(--rose-d)':'var(--green-d)',borderBottom:`1px solid ${err?'var(--rose)':'var(--green)'}`,color:err?'var(--rose)':'var(--green)',fontWeight:600,fontSize:'.88rem'}}>
          {msg||err}
        </div>
      )}

      <div style={S.body}>
        {/* Tabs */}
        <div style={{display:'flex',gap:'.5rem',marginBottom:'1.5rem',borderBottom:'1px solid var(--border)',paddingBottom:'.75rem',flexWrap:'wrap'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'.5rem 1rem',background:tab===t.id?'var(--blue-d)':'transparent',border:`1px solid ${tab===t.id?'var(--blue)':'transparent'}`,borderRadius:'var(--radius)',color:tab===t.id?'var(--blue)':'var(--text2)',cursor:'pointer',fontWeight:600,fontSize:'.85rem',display:'flex',alignItems:'center',gap:'.4rem',position:'relative'}}>
              {t.icon} {t.label}
              {(t.badge??0)>0 && <span style={{background:'var(--rose)',color:'#fff',borderRadius:999,padding:'0 .4rem',fontSize:'.7rem',fontWeight:800}}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {loading && <div style={{textAlign:'center',padding:'3rem',color:'var(--text2)'}}>Loading…</div>}

        {/* OVERVIEW */}
        {!loading && tab==='overview' && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'1rem'}}>
            {[
              {label:'Total Cubes',      val:stats?.cubes_total||0,      icon:'🧊', color:'var(--blue)'},
              {label:'Pending Requests', val:stats?.pending_requests||0, icon:'📥', color:'var(--amber)'},
              {label:'Total Users',      val:stats?.users_total||0,      icon:'👥', color:'var(--green)'},
              {label:'Total Expenses',   val:stats?.expenses_total||0,   icon:'💰', color:'var(--violet)'},
              {label:'Total Invoices',   val:stats?.invoices_total||0,   icon:'🧾', color:'var(--cyan)'},
              {label:'DB Online',        val:'✓',                         icon:'🍃', color:'var(--green)'},
            ].map(c=>(
              <div key={c.label} style={{...S.card,borderTop:`2px solid ${c.color}`}}>
                <div style={{fontSize:'1.5rem',marginBottom:'.5rem'}}>{c.icon}</div>
                <div style={{...S.val,color:c.color}}>{c.val}</div>
                <div style={S.label}>{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS */}
        {!loading && tab==='requests' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h2 style={{color:'var(--text)',fontFamily:'var(--font-disp)'}}>Cube Requests ({requests.length})</h2>
            {requests.length===0 && <div style={{...S.card,textAlign:'center',color:'var(--text2)',padding:'3rem'}}>No requests yet</div>}
            {requests.map(r=>(
              <div key={r.id} style={{...S.card,display:'flex',alignItems:'flex-start',gap:'1.5rem',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:700,color:'var(--text)'}}>{r.company_name}</div>
                  <div style={{color:'var(--text2)',fontSize:'.85rem'}}>{r.admin_name} · {r.admin_email}</div>
                  {r.admin_phone && <div style={{color:'var(--text3)',fontSize:'.8rem'}}>{r.admin_phone}</div>}
                  {r.message && <div style={{color:'var(--text3)',fontSize:'.8rem',marginTop:'.3rem',fontStyle:'italic'}}>"{r.message}"</div>}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'.3rem',alignItems:'flex-end'}}>
                  <span style={{background:PLAN_COLORS[r.plan]||'var(--text2)',color:'#fff',borderRadius:999,padding:'.2rem .6rem',fontSize:'.75rem',fontWeight:700}}>{r.plan.toUpperCase()}</span>
                  <span style={{color:r.status==='pending'?'var(--amber)':r.status==='approved'?'var(--green)':'var(--rose)',fontSize:'.8rem',fontWeight:600}}>{r.status}</span>
                  <div style={{color:'var(--text3)',fontSize:'.75rem'}}>{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                {r.status==='pending' && (
                  <div style={{display:'flex',gap:'.5rem'}}>
                    <button onClick={()=>{ setApproveModal(r); setApproveForm({admin_username:'',admin_password:'',cube_slug:r.company_name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}) }} style={S.btn('var(--green)')}>✅ Approve</button>
                    <button onClick={()=>rejectRequest(r.id)} style={S.btn('var(--rose)')}>❌ Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* CUBES */}
        {!loading && tab==='cubes' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h2 style={{color:'var(--text)',fontFamily:'var(--font-disp)'}}>All Cubes ({cubes.length})</h2>
            {cubes.length===0 && <div style={{...S.card,textAlign:'center',color:'var(--text2)',padding:'3rem'}}>No cubes yet</div>}
            {cubes.map(c=>(
              <div key={c.id} style={{...S.card,display:'flex',alignItems:'center',gap:'1rem',flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:180}}>
                  <div style={{fontWeight:700,color:'var(--text)',fontFamily:'var(--font-mono)'}}>{c.slug}</div>
                  <div style={{color:'var(--text2)',fontSize:'.85rem'}}>{c.company_name}</div>
                  <div style={{color:'var(--text3)',fontSize:'.75rem'}}>{new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <span style={{background:PLAN_COLORS[c.plan]||'var(--text2)',color:'#fff',borderRadius:999,padding:'.2rem .7rem',fontSize:'.78rem',fontWeight:700}}>{c.plan}</span>
                <span style={{color:c.is_active?'var(--green)':'var(--rose)',fontWeight:600,fontSize:'.85rem'}}>{c.is_active?'● Active':'○ Inactive'}</span>
                <button onClick={()=>toggleCube(c.id,c.is_active)} style={S.btn(c.is_active?'var(--amber)':'var(--green)')}>
                  {c.is_active?'Deactivate':'Activate'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* USERS */}
        {!loading && tab==='users' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h2 style={{color:'var(--text)',fontFamily:'var(--font-disp)'}}>All Users ({users.length})</h2>
            <div style={{...S.card,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.85rem'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--border)'}}>
                    {['Username','Full Name','Email','Role','Cube','Status','Actions'].map(h=>(
                      <th key={h} style={{padding:'.6rem .8rem',textAlign:'left',color:'var(--text2)',fontWeight:600,fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.06em'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u=>(
                    <tr key={u.id} style={{borderBottom:'1px solid var(--border)',transition:'background .15s'}} onMouseEnter={e=>(e.currentTarget.style.background='var(--hover-bg)')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{padding:'.6rem .8rem',fontFamily:'var(--font-mono)',color:'var(--blue)'}}>{u.username}</td>
                      <td style={{padding:'.6rem .8rem',color:'var(--text)'}}>{u.full_name}</td>
                      <td style={{padding:'.6rem .8rem',color:'var(--text2)'}}>{u.email}</td>
                      <td style={{padding:'.6rem .8rem'}}>
                        <span style={{background:u.role==='creator'?'var(--amber-d)':u.role==='cube_admin'?'var(--violet-d)':'var(--blue-d)',color:u.role==='creator'?'var(--amber)':u.role==='cube_admin'?'var(--violet)':'var(--blue)',borderRadius:999,padding:'.15rem .5rem',fontSize:'.75rem',fontWeight:700}}>{u.role}</span>
                      </td>
                      <td style={{padding:'.6rem .8rem',color:'var(--text3)',fontFamily:'var(--font-mono)',fontSize:'.75rem'}}>{u.cube_id||'—'}</td>
                      <td style={{padding:'.6rem .8rem',color:u.is_active?'var(--green)':'var(--rose)'}}>{u.is_active?'Active':'Inactive'}</td>
                      <td style={{padding:'.6rem .8rem'}}>
                        <button onClick={()=>setResetModal(u)} style={S.btn('var(--amber)')}>Reset Pass</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT */}
        {!loading && tab==='audit' && (
          <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
            <h2 style={{color:'var(--text)',fontFamily:'var(--font-disp)'}}>Audit Log</h2>
            <div style={{...S.card,overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
                <thead>
                  <tr style={{borderBottom:'1px solid var(--border)'}}>
                    {['Time','User','Action','Entity','Cube'].map(h=>(
                      <th key={h} style={{padding:'.6rem .8rem',textAlign:'left',color:'var(--text2)',fontWeight:600,fontSize:'.73rem',textTransform:'uppercase'}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map(a=>(
                    <tr key={a.id} style={{borderBottom:'1px solid var(--border)'}}>
                      <td style={{padding:'.5rem .8rem',color:'var(--text3)',fontSize:'.75rem',whiteSpace:'nowrap'}}>{new Date(a.created_at).toLocaleString()}</td>
                      <td style={{padding:'.5rem .8rem',color:'var(--text)'}}>{a.user_name}</td>
                      <td style={{padding:'.5rem .8rem'}}><span style={{fontFamily:'var(--font-mono)',color:'var(--cyan)',fontSize:'.78rem'}}>{a.action}</span></td>
                      <td style={{padding:'.5rem .8rem',color:'var(--text2)'}}>{a.entity_type}</td>
                      <td style={{padding:'.5rem .8rem',color:'var(--text3)',fontFamily:'var(--font-mono)',fontSize:'.75rem'}}>{a.cube_id||'global'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECURITY */}
        {!loading && tab==='security' && (
          <div style={{display:'grid',gap:'1rem',gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))'}}>
            <div style={S.card}>
              <h3 style={{color:'var(--text)',marginBottom:'1rem',fontFamily:'var(--font-disp)'}}>🔐 Creator Password</h3>
              <p style={{color:'var(--text2)',fontSize:'.85rem',marginBottom:'1rem'}}>Change your Creator master password.</p>
              <button onClick={()=>setResetModal({id:'creator-system',username:'creator',full_name:'System Creator',email:'',role:'creator',cube_id:null,is_active:true,created_at:''})} style={S.btn('var(--amber)')}>Change Password</button>
            </div>
            <div style={S.card}>
              <h3 style={{color:'var(--text)',marginBottom:'1rem',fontFamily:'var(--font-disp)'}}>🍃 MongoDB Status</h3>
              <p style={{color:'var(--green)',fontSize:'.9rem',fontWeight:600}}>● Connected</p>
              <p style={{color:'var(--text2)',fontSize:'.82rem',marginTop:'.5rem'}}>DB Time: {stats?.db_time ? new Date(stats.db_time).toLocaleString() : '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'2rem',width:'100%',maxWidth:460}}>
            <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1.2rem'}}>Approve: {approveModal.company_name}</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'.85rem'}}>
              <div>
                <label style={{...S.label,display:'block',marginBottom:'.35rem'}}>Cube Slug (URL identifier) *</label>
                <input value={approveForm.cube_slug} onChange={e=>setApproveForm(f=>({...f,cube_slug:e.target.value.toLowerCase().replace(/\s+/g,'-')}))} style={S.input} placeholder="my-company" />
              </div>
              <div>
                <label style={{...S.label,display:'block',marginBottom:'.35rem'}}>Admin Username *</label>
                <input value={approveForm.admin_username} onChange={e=>setApproveForm(f=>({...f,admin_username:e.target.value}))} style={S.input} placeholder="companyadmin" />
              </div>
              <div>
                <label style={{...S.label,display:'block',marginBottom:'.35rem'}}>Admin Password *</label>
                <input type="password" value={approveForm.admin_password} onChange={e=>setApproveForm(f=>({...f,admin_password:e.target.value}))} style={S.input} placeholder="Secure password" />
              </div>
            </div>
            <div style={{display:'flex',gap:'.75rem',marginTop:'1.5rem'}}>
              <button onClick={approveRequest} disabled={approving} style={{...S.btn('var(--green)'),flex:1,padding:'.75rem'}}>
                {approving?'Creating…':'✅ Create Cube & Admin'}
              </button>
              <button onClick={()=>setApproveModal(null)} style={{...S.btn('var(--surface)'),border:'1px solid var(--border2)',color:'var(--text2)',flex:.5,padding:'.75rem'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
          <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'2rem',width:'100%',maxWidth:380}}>
            <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1rem'}}>Reset Password: {resetModal.full_name}</h3>
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={S.input} placeholder="New password" />
            <div style={{display:'flex',gap:'.75rem',marginTop:'1rem'}}>
              <button onClick={resetPassword} disabled={resetting||!newPass} style={{...S.btn('var(--amber)'),flex:1,padding:'.7rem'}}>
                {resetting?'Resetting…':'Reset Password'}
              </button>
              <button onClick={()=>{setResetModal(null);setNewPass('')}} style={{...S.btn('var(--surface)'),border:'1px solid var(--border2)',color:'var(--text2)',flex:.5,padding:'.7rem'}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
