// src/pages/CubeAdminPanel.tsx — Alpha Quantum ERP v15 — Cube Admin Panel
import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

type Tab = 'overview'|'branding'|'features'|'users'|'permissions'|'audit'

interface Cube { id:string; slug:string; company_name:string; plan:string; is_active:boolean; logo_url?:string; settings?:Record<string,string>; features?:Record<string,boolean|number> }
interface UserRow { id:string; username:string; full_name:string; email:string; role:string; is_active:boolean; permissions:Record<string,string> }

const MODULES = ['finance','expenses','invoices','wallet','assets','investments','liabilities','budget','workers','salary','timesheet','crm','projects','reports','settings']
const PERM_LEVELS = ['none','submit_only','view_own','view_all','full_control']
const ACCENT_COLORS = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#f97316']

export default function CubeAdminPanel() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [cube, setCube] = useState<Cube|null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [audit, setAudit] = useState<{id:string;user_name:string;action:string;entity_type:string;created_at:string}[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const [branding, setBranding] = useState({ company_name:'', accent_color:'#3b82f6', theme:'dark', language:'en', currency:'SAR', timezone:'Asia/Riyadh' })
  const [saving, setSaving] = useState(false)
  const [features, setFeatures] = useState<Record<string,boolean>>({})

  const flash = (m:string,isErr=false) => { if(isErr)setErr(m);else setMsg(m); setTimeout(()=>{setMsg('');setErr('')},3000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cubeRes, usersRes, auditRes] = await Promise.allSettled([
        api.get<{cube:Cube}>('/cube/me'),
        api.get<{users:UserRow[]}>('/users'),
        api.get<{logs:typeof audit}>('/audit-log'),
      ])
      if (cubeRes.status==='fulfilled' && cubeRes.value.cube) {
        const c = cubeRes.value.cube
        setCube(c)
        setBranding({ company_name:c.company_name||'', accent_color:c.settings?.accent_color||'#3b82f6', theme:c.settings?.theme||'dark', language:c.settings?.language||'en', currency:c.settings?.currency||'SAR', timezone:c.settings?.timezone||'Asia/Riyadh' })
        setFeatures((c.features||{}) as Record<string,boolean>)
      }
      if (usersRes.status==='fulfilled') setUsers(usersRes.value.users||[])
      if (auditRes.status==='fulfilled') setAudit(auditRes.value.logs||[])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveBranding() {
    setSaving(true)
    try { await api.patch('/cube/settings', branding); flash('Branding saved ✓') }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
    setSaving(false)
  }

  async function saveFeatures() {
    setSaving(true)
    try { await api.patch('/cube/features', { features }); flash('Features saved ✓') }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
    setSaving(false)
  }
  async function _saveFeatures_old() {
    setSaving(true)
    try { await api.patch('/cube/settings', { features }); flash('Features saved ✓') }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
    setSaving(false)
  }

  async function setUserPerm(userId:string, module:string, level:string) {
    try { await api.post('/permissions', { user_id:userId, module, level }); load() }
    catch(e:unknown) { flash(e instanceof Error ? e.message : 'Error', true) }
  }

  const S = {
    card:{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem' },
    label:{ display:'block' as const, color:'var(--text2)', fontSize:'.78rem', fontWeight:600, textTransform:'uppercase' as const, letterSpacing:'.07em', marginBottom:'.4rem' },
    input:{ width:'100%', padding:'.6rem .8rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.88rem' },
    select:{ width:'100%', padding:'.6rem .8rem', background:'var(--input-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', color:'var(--text)', fontSize:'.88rem' },
    btn:(c:string)=>({ padding:'.5rem 1rem', background:c, color:'#fff', border:'none', borderRadius:'var(--radius)', cursor:'pointer', fontWeight:600, fontSize:'.85rem' }),
  }

  const TABS:{ id:Tab; label:string; icon:string }[] = [
    {id:'overview',    label:'Overview',    icon:'◈'},
    {id:'branding',    label:'Branding',    icon:'🎨'},
    {id:'features',    label:'Features',    icon:'⚡'},
    {id:'users',       label:'Users',       icon:'👥'},
    {id:'permissions', label:'Permissions', icon:'🔐'},
    {id:'audit',       label:'Audit Log',   icon:'📋'},
  ]

  return (
    <div style={{padding:'1.5rem',maxWidth:1200,margin:'0 auto'}}>
      <div style={{marginBottom:'1.5rem'}}>
        <h1 style={{fontFamily:'var(--font-disp)',fontSize:'1.4rem',fontWeight:800,color:'var(--text)'}}>
          🧊 Cube Admin Panel
        </h1>
        <p style={{color:'var(--text2)',fontSize:'.85rem',marginTop:'.25rem'}}>
          {cube?.company_name||'Your Workspace'} · Plan: <span style={{color:'var(--blue)',fontWeight:700}}>{cube?.plan?.toUpperCase()||'—'}</span>
        </p>
      </div>

      {(msg||err) && (
        <div style={{marginBottom:'1rem',padding:'.75rem',background:err?'var(--rose-d)':'var(--green-d)',border:`1px solid ${err?'var(--rose)':'var(--green)'}`,borderRadius:'var(--radius)',color:err?'var(--rose)':'var(--green)',fontWeight:600,fontSize:'.88rem'}}>
          {msg||err}
        </div>
      )}

      <div style={{display:'flex',gap:'.5rem',marginBottom:'1.5rem',flexWrap:'wrap'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:'.45rem .9rem',background:tab===t.id?'var(--blue-d)':'transparent',border:`1px solid ${tab===t.id?'var(--blue)':'transparent'}`,borderRadius:'var(--radius)',color:tab===t.id?'var(--blue)':'var(--text2)',cursor:'pointer',fontWeight:600,fontSize:'.83rem'}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{textAlign:'center',padding:'3rem',color:'var(--text2)'}}>Loading…</div>}

      {/* OVERVIEW */}
      {!loading && tab==='overview' && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'1rem'}}>
          {[
            {label:'Plan',         val:(cube?.plan||'?').toUpperCase(), color:'var(--blue)'},
            {label:'Total Users',  val:users.length,                    color:'var(--green)'},
            {label:'Active Users', val:users.filter(u=>u.is_active).length, color:'var(--cyan)'},
            {label:'Status',       val:cube?.is_active?'Active':'Inactive', color:cube?.is_active?'var(--green)':'var(--rose)'},
          ].map(c=>(
            <div key={c.label} style={S.card}>
              <div style={{fontSize:'1.6rem',fontWeight:800,fontFamily:'var(--font-disp)',color:c.color}}>{c.val}</div>
              <div style={{color:'var(--text2)',fontSize:'.75rem',fontWeight:600,textTransform:'uppercase',marginTop:'.3rem'}}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* BRANDING */}
      {!loading && tab==='branding' && (
        <div style={{...S.card,maxWidth:520,display:'flex',flexDirection:'column',gap:'1rem'}}>
          <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)'}}>🎨 Workspace Branding</h3>
          <div><label style={S.label}>Company Name</label><input value={branding.company_name} onChange={e=>setBranding(b=>({...b,company_name:e.target.value}))} style={S.input} /></div>
          <div>
            <label style={S.label}>Accent Color</label>
            <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
              {ACCENT_COLORS.map(c=>(
                <button key={c} onClick={()=>setBranding(b=>({...b,accent_color:c}))}
                  style={{width:32,height:32,borderRadius:'50%',background:c,border:branding.accent_color===c?'3px solid #fff':'2px solid transparent',cursor:'pointer'}} />
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div><label style={S.label}>Theme</label>
              <select value={branding.theme} onChange={e=>setBranding(b=>({...b,theme:e.target.value}))} style={S.select}>
                <option value="dark">Dark</option><option value="light">Light</option>
              </select>
            </div>
            <div><label style={S.label}>Language</label>
              <select value={branding.language} onChange={e=>setBranding(b=>({...b,language:e.target.value}))} style={S.select}>
                <option value="en">English</option><option value="ar">Arabic</option>
              </select>
            </div>
            <div><label style={S.label}>Currency</label>
              <select value={branding.currency} onChange={e=>setBranding(b=>({...b,currency:e.target.value}))} style={S.select}>
                <option value="SAR">SAR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="AED">AED</option>
              </select>
            </div>
            <div><label style={S.label}>Timezone</label>
              <select value={branding.timezone} onChange={e=>setBranding(b=>({...b,timezone:e.target.value}))} style={S.select}>
                <option value="Asia/Riyadh">Asia/Riyadh</option><option value="UTC">UTC</option><option value="Asia/Dubai">Asia/Dubai</option>
              </select>
            </div>
          </div>
          <button onClick={saveBranding} disabled={saving} style={{...S.btn('var(--blue)'),padding:'.75rem'}}>
            {saving?'Saving…':'💾 Save Branding'}
          </button>
        </div>
      )}

      {/* FEATURES */}
      {!loading && tab==='features' && (
        <div style={{...S.card,maxWidth:520}}>
          <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1rem'}}>⚡ Enable / Disable Features</h3>
          <p style={{color:'var(--text2)',fontSize:'.85rem',marginBottom:'1.5rem'}}>Control which modules are accessible to your users.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
            {MODULES.map(mod=>(
              <label key={mod} style={{display:'flex',alignItems:'center',gap:'1rem',cursor:'pointer',padding:'.6rem .8rem',background:'var(--surface)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                <div style={{width:44,height:24,borderRadius:999,background:features[mod]?'var(--green)':'var(--border2)',position:'relative',transition:'background .2s',cursor:'pointer',flexShrink:0}}
                  onClick={()=>setFeatures(f=>({...f,[mod]:!f[mod]}))}>
                  <div style={{position:'absolute',top:2,left:features[mod]?20:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left .2s'}} />
                </div>
                <span style={{color:'var(--text)',fontWeight:600,textTransform:'capitalize'}}>{mod}</span>
                <span style={{color:features[mod]?'var(--green)':'var(--text3)',fontSize:'.8rem',marginLeft:'auto'}}>{features[mod]?'Enabled':'Disabled'}</span>
              </label>
            ))}
          </div>
          <button onClick={saveFeatures} disabled={saving} style={{...S.btn('var(--blue)'),padding:'.75rem',width:'100%',marginTop:'1.25rem'}}>
            {saving?'Saving…':'⚡ Save Features'}
          </button>
        </div>
      )}

      {/* USERS */}
      {!loading && tab==='users' && (
        <div style={S.card}>
          <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1rem'}}>👥 Cube Users ({users.length})</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.85rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Username','Name','Email','Role','Status'].map(h=>(
                    <th key={h} style={{padding:'.6rem .8rem',textAlign:'left',color:'var(--text2)',fontWeight:600,fontSize:'.75rem',textTransform:'uppercase'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'.55rem .8rem',fontFamily:'var(--font-mono)',color:'var(--blue)'}}>{u.username}</td>
                    <td style={{padding:'.55rem .8rem',color:'var(--text)'}}>{u.full_name}</td>
                    <td style={{padding:'.55rem .8rem',color:'var(--text2)'}}>{u.email}</td>
                    <td style={{padding:'.55rem .8rem'}}>
                      <span style={{background:'var(--violet-d)',color:'var(--violet)',borderRadius:999,padding:'.15rem .5rem',fontSize:'.75rem',fontWeight:700}}>{u.role}</span>
                    </td>
                    <td style={{padding:'.55rem .8rem',color:u.is_active?'var(--green)':'var(--rose)',fontWeight:600}}>{u.is_active?'Active':'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PERMISSIONS */}
      {!loading && tab==='permissions' && (
        <div style={S.card}>
          <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1rem'}}>🔐 User Permissions</h3>
          <p style={{color:'var(--text2)',fontSize:'.82rem',marginBottom:'1rem'}}>Set per-module access levels for each user (excluding admins).</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  <th style={{padding:'.5rem .8rem',textAlign:'left',color:'var(--text2)',whiteSpace:'nowrap',position:'sticky',left:0,background:'var(--card)'}}>User</th>
                  {MODULES.map(m=><th key={m} style={{padding:'.5rem .4rem',textAlign:'center',color:'var(--text2)',fontSize:'.7rem',textTransform:'uppercase',whiteSpace:'nowrap'}}>{m}</th>)}
                </tr>
              </thead>
              <tbody>
                {users.filter(u=>u.role==='staff'||u.role==='manager').map(u=>(
                  <tr key={u.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'.4rem .8rem',color:'var(--text)',fontWeight:600,whiteSpace:'nowrap',position:'sticky',left:0,background:'var(--card)'}}>{u.full_name}</td>
                    {MODULES.map(mod=>(
                      <td key={mod} style={{padding:'.3rem .4rem',textAlign:'center'}}>
                        <select value={u.permissions?.[mod]||'none'} onChange={e=>setUserPerm(u.id,mod,e.target.value)}
                          style={{fontSize:'.7rem',padding:'.2rem .3rem',background:'var(--input-bg)',border:'1px solid var(--border2)',borderRadius:4,color:'var(--text)',minWidth:70}}>
                          {PERM_LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT */}
      {!loading && tab==='audit' && (
        <div style={S.card}>
          <h3 style={{color:'var(--text)',fontFamily:'var(--font-disp)',marginBottom:'1rem'}}>📋 Cube Audit Log</h3>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.82rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--border)'}}>
                  {['Time','User','Action','Entity'].map(h=><th key={h} style={{padding:'.5rem .8rem',textAlign:'left',color:'var(--text2)',fontSize:'.73rem',textTransform:'uppercase'}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {audit.map(a=>(
                  <tr key={a.id} style={{borderBottom:'1px solid var(--border)'}}>
                    <td style={{padding:'.45rem .8rem',color:'var(--text3)',fontSize:'.75rem',whiteSpace:'nowrap'}}>{new Date(a.created_at).toLocaleString()}</td>
                    <td style={{padding:'.45rem .8rem',color:'var(--text)'}}>{a.user_name}</td>
                    <td style={{padding:'.45rem .8rem',fontFamily:'var(--font-mono)',color:'var(--cyan)',fontSize:'.78rem'}}>{a.action}</td>
                    <td style={{padding:'.45rem .8rem',color:'var(--text2)'}}>{a.entity_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
