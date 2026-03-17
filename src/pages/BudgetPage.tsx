// src/pages/BudgetPage.tsx — v18 Budget + Project Tracking
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Budget {
  id: string; ref?: string; title: string; category?: string
  amount: number; spent: number; period?: string; year?: number; month?: number
  status: string; notes?: string; created_at: string; project_id?: string; project_title?: string
}
interface Project {
  id: string; ref?: string; title: string; status: string
  budget: number; created_at: string
}
interface BudgetSummary {
  total_budget: number; total_spent: number; remaining: number
  by_category: { category: string; budget: number; spent: number }[]
  by_project:  { project: string; budget: number; spent: number; pct: number }[]
}

const CATS = ['Operations','Labour','Equipment','Materials','Marketing','IT','Travel','Office','Other']
const STATUS_BADGE: Record<string,string> = { active:'badge-green', draft:'badge-muted', closed:'badge-rose', exceeded:'badge-amber' }
const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#22d3ee','#f43f5e','#f97316','#a3e635']

const EMPTY_FORM = { title:'', category:'Operations', amount:'', spent:'0', period:'monthly', year: new Date().getFullYear(), month: new Date().getMonth()+1, notes:'', project_id:'' }

function pct(spent: number, budget: number) {
  if (!budget) return 0
  return Math.min(100, Math.round((spent / budget) * 100))
}
function barColor(p: number) {
  if (p >= 100) return '#f43f5e'
  if (p >= 80)  return '#f59e0b'
  return '#10b981'
}
const sar = (n: number) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:0})}`
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function BudgetPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [budgets,  setBudgets]  = useState<Budget[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [summary,  setSummary]  = useState<BudgetSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState<'budgets'|'projects'|'analytics'>('budgets')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,   setSaving]   = useState(false)
  const [filterYear, setFY]     = useState(new Date().getFullYear().toString())
  const [expand,   setExpand]   = useState<string|null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [bd, pd] = await Promise.all([
        api.get<{budgets: Budget[]}>('/budgets'),
        api.get<{projects: Project[]}>('/projects'),
      ])
      const bList = bd.budgets || []
      const pList = pd.projects || []
      setBudgets(bList)
      setProjects(pList)

      // Build summary
      const byCategory: Record<string,{budget:number;spent:number}> = {}
      bList.forEach(b => {
        const cat = b.category || 'Other'
        if (!byCategory[cat]) byCategory[cat] = {budget:0,spent:0}
        byCategory[cat].budget += Number(b.amount||0)
        byCategory[cat].spent  += Number(b.spent||0)
      })

      // Budget by project
      const byProject: Record<string,{project:string;budget:number;spent:number}> = {}
      bList.filter(b => b.project_id).forEach(b => {
        const pid = b.project_id!
        const pTitle = b.project_title || pList.find(p=>p.id===pid)?.title || 'Unknown'
        if (!byProject[pid]) byProject[pid] = {project:pTitle,budget:0,spent:0}
        byProject[pid].budget += Number(b.amount||0)
        byProject[pid].spent  += Number(b.spent||0)
      })

      const totalBudget = bList.reduce((s,b)=>s+Number(b.amount||0),0)
      const totalSpent  = bList.reduce((s,b)=>s+Number(b.spent||0),0)
      setSummary({
        total_budget: totalBudget,
        total_spent:  totalSpent,
        remaining:    totalBudget - totalSpent,
        by_category:  Object.entries(byCategory).map(([k,v]) => ({category:k,...v})).sort((a,b)=>b.budget-a.budget),
        by_project:   Object.values(byProject).map(v => ({...v, pct: pct(v.spent,v.budget)})).sort((a,b)=>b.budget-a.budget),
      })
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!form.title.trim() || !form.amount) { setError('Title and amount are required'); return }
    setSaving(true); setError('')
    try {
      await api.post('/budgets', {
        title:      form.title.trim(),
        category:   form.category,
        amount:     parseFloat(form.amount)||0,
        spent:      parseFloat(form.spent)||0,
        period:     form.period,
        year:       Number(form.year)||new Date().getFullYear(),
        month:      Number(form.month)||new Date().getMonth()+1,
        notes:      form.notes,
        project_id: form.project_id || null,
        status:     'active',
      })
      setShowForm(false); setForm(EMPTY_FORM); load()
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function updateSpent(id: string, spent: string) {
    try {
      await api.patch(`/budgets/${id}`, { spent: parseFloat(spent)||0 })
      setBudgets(p => p.map(b => b.id===id ? {...b, spent: parseFloat(spent)||0} : b))
      load() // refresh summary
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Update failed') }
  }

  const filteredBudgets = budgets.filter(b => !filterYear || String(b.year||'') === filterYear)
  const totalBudgetFiltered = filteredBudgets.reduce((s,b)=>s+Number(b.amount||0),0)
  const totalSpentFiltered  = filteredBudgets.reduce((s,b)=>s+Number(b.spent||0),0)
  const overBudget = filteredBudgets.filter(b => Number(b.spent||0) > Number(b.amount||0)).length

  if (loading) return <div className="loading-full"><div className="spinner"/><span style={{color:'var(--text2)',fontSize:'.85rem'}}>Loading budget data…</span></div>

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget & Tracking</h1>
          <p className="page-sub">Track spending by category and project</p>
        </div>
        <div className="action-row">
          <select className="input btn-sm" style={{width:100}} value={filterYear} onChange={e=>setFY(e.target.value)}>
            {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          {su && <button className="btn btn-primary btn-sm" onClick={()=>setShowForm(true)}>+ Add Budget</button>}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{marginBottom:'1rem'}}>⚠️ {error}<button style={{marginLeft:'auto',background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setError('')}>✕</button></div>}

      {/* KPI Row */}
      <div className="stat-grid" style={{marginBottom:'1.25rem'}}>
        {[
          {label:'Total Budget',   val:sar(totalBudgetFiltered),  color:'var(--blue)',  icon:'📊'},
          {label:'Total Spent',    val:sar(totalSpentFiltered),   color:'var(--amber)', icon:'💸'},
          {label:'Remaining',      val:sar(totalBudgetFiltered-totalSpentFiltered), color:totalBudgetFiltered-totalSpentFiltered>=0?'var(--green)':'var(--rose)', icon:'💰'},
          {label:'Over Budget',    val:overBudget,                color:overBudget>0?'var(--rose)':'var(--green)', icon:'⚠️'},
          {label:'Budget Lines',   val:filteredBudgets.length,    color:'var(--violet)', icon:'📋'},
          {label:'Active Projects',val:projects.filter(p=>p.status==='active'||p.status==='planning').length, color:'var(--cyan)', icon:'📁'},
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{color:s.color,fontSize:typeof s.val==='string'?'.95rem':'1.5rem'}}>{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      {totalBudgetFiltered > 0 && (
        <div className="card" style={{marginBottom:'1.25rem',padding:'1rem 1.25rem'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.65rem',flexWrap:'wrap',gap:'.5rem'}}>
            <span style={{fontWeight:600,color:'var(--text)',fontSize:'.9rem'}}>Overall Budget Utilization</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'.85rem',color:pct(totalSpentFiltered,totalBudgetFiltered)>=80?'var(--amber)':'var(--text2)'}}>
              {pct(totalSpentFiltered,totalBudgetFiltered)}% used
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width:`${pct(totalSpentFiltered,totalBudgetFiltered)}%`,
              background:barColor(pct(totalSpentFiltered,totalBudgetFiltered))
            }}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:'.5rem',fontSize:'.75rem',color:'var(--text3)'}}>
            <span>Spent: {sar(totalSpentFiltered)}</span>
            <span>Remaining: {sar(totalBudgetFiltered-totalSpentFiltered)}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {([['budgets','📋 Budgets'],['projects','📁 By Project'],['analytics','📊 Analytics']] as const).map(([v,l])=>(
          <button key={v} className={`tab-btn${tab===v?' active':''}`} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>

      {/* BUDGETS TAB */}
      {tab === 'budgets' && (
        <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
          {filteredBudgets.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">📊</div>
              <div className="empty-title">No budgets for {filterYear}</div>
              <div className="empty-desc">Create budget lines to start tracking your spending</div>
              {su && <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={()=>setShowForm(true)}>+ Create Budget</button>}
            </div>
          ) : filteredBudgets.map(b => {
            const p = pct(Number(b.spent||0), Number(b.amount||0))
            const isOpen = expand === b.id
            return (
              <div key={b.id} className="card" style={{padding:0,overflow:'hidden'}}>
                {/* Summary row - tap to expand */}
                <div onClick={()=>setExpand(isOpen?null:b.id)}
                  style={{display:'flex',alignItems:'center',gap:'.85rem',padding:'.9rem 1.1rem',cursor:'pointer',userSelect:'none'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',gap:'.4rem',alignItems:'center',flexWrap:'wrap',marginBottom:'.2rem'}}>
                      <span style={{fontWeight:600,fontSize:'.9rem',color:'var(--text)'}}>{b.title}</span>
                      <span className={`badge ${STATUS_BADGE[b.status]||'badge-muted'}`}>{b.status}</span>
                      {b.category && <span className="badge badge-muted">{b.category}</span>}
                    </div>
                    <div style={{display:'flex',gap:'.75rem',fontSize:'.76rem',color:'var(--text3)',flexWrap:'wrap'}}>
                      <span>{b.period || 'monthly'} · {b.year}{b.month ? ` · ${MONTHS[(b.month||1)-1]}` : ''}</span>
                      {b.project_title && <span>📁 {b.project_title}</span>}
                    </div>
                    {/* Mini progress */}
                    <div style={{display:'flex',alignItems:'center',gap:'.5rem',marginTop:'.5rem'}}>
                      <div className="progress-track" style={{flex:1}}>
                        <div className="progress-fill" style={{width:`${p}%`,background:barColor(p)}}/>
                      </div>
                      <span style={{fontFamily:'var(--font-mono)',fontSize:'.7rem',color:barColor(p),flexShrink:0}}>{p}%</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--text)',fontSize:'.88rem'}}>{sar(Number(b.amount||0))}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:'.75rem',color:p>=100?'var(--rose)':p>=80?'var(--amber)':'var(--text3)',marginTop:'.1rem'}}>
                      {sar(Number(b.spent||0))} spent
                    </div>
                    <div style={{fontSize:'.7rem',color:'var(--text3)',marginTop:'.2rem'}}>{isOpen?'▲':'▼'}</div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{borderTop:'1px solid var(--border)',padding:'1rem 1.1rem',background:'var(--card2)'}}>
                    {b.notes && <p style={{fontSize:'.83rem',color:'var(--text2)',marginBottom:'.85rem'}}>{b.notes}</p>}
                    {su && (
                      <div style={{display:'flex',gap:'.65rem',alignItems:'flex-end',flexWrap:'wrap'}}>
                        <div style={{flex:1,minWidth:140}}>
                          <label className="label">Update Spent Amount (SAR)</label>
                          <input className="input" type="number" min="0" step="0.01"
                            defaultValue={b.spent||0}
                            id={`spent-${b.id}`}
                            placeholder="0.00" />
                        </div>
                        <button className="btn btn-primary btn-sm" style={{marginBottom:1}} onClick={()=>{
                          const el = document.getElementById(`spent-${b.id}`) as HTMLInputElement
                          if (el) updateSpent(b.id, el.value)
                        }}>
                          Update
                        </button>
                      </div>
                    )}
                    <div style={{marginTop:'.75rem',fontSize:'.78rem',color:'var(--text3)'}}>
                      Remaining: <strong style={{color:Number(b.amount||0)-Number(b.spent||0)>=0?'var(--green-bright)':'var(--rose-bright)'}}>{sar(Number(b.amount||0)-Number(b.spent||0))}</strong>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* BY PROJECT TAB */}
      {tab === 'projects' && (
        <div style={{display:'flex',flexDirection:'column',gap:'.65rem'}}>
          {/* Projects with budgets */}
          {(summary?.by_project||[]).length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">📁</div>
              <div className="empty-title">No project budgets</div>
              <div className="empty-desc">Assign budgets to projects when creating budget lines</div>
            </div>
          ) : (summary?.by_project||[]).map((p,i) => (
            <div key={i} className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'.5rem',marginBottom:'.65rem'}}>
                <span style={{fontWeight:600,color:'var(--text)',fontSize:'.9rem'}}>📁 {p.project}</span>
                <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:'.8rem',color:'var(--text2)'}}>
                    {sar(p.spent)} / {sar(p.budget)}
                  </span>
                  <span className={`badge ${p.pct>=100?'badge-rose':p.pct>=80?'badge-amber':'badge-green'}`}>{p.pct}%</span>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{width:`${p.pct}%`,background:barColor(p.pct)}}/>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:'.45rem',fontSize:'.74rem',color:'var(--text3)'}}>
                <span>Spent</span>
                <span>Remaining: {sar(p.budget-p.spent)}</span>
              </div>
            </div>
          ))}

          {/* All projects without budget */}
          <div className="card">
            <div className="card-title" style={{marginBottom:'.85rem'}}>All Projects</div>
            {projects.length === 0 ? (
              <div className="empty-state" style={{padding:'1.5rem'}}>
                <div className="empty-desc">No projects yet</div>
              </div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'.5rem'}}>
                {projects.map(p => {
                  const pBudgets = budgets.filter(b => b.project_id === p.id)
                  const pBudget = pBudgets.reduce((s,b)=>s+Number(b.amount||0),0)
                  const pSpent  = pBudgets.reduce((s,b)=>s+Number(b.spent||0),0)
                  const pc = pct(pSpent, pBudget)
                  return (
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:'.75rem',padding:'.65rem .75rem',background:'var(--hover-bg)',borderRadius:'var(--radius)',flexWrap:'wrap'}}>
                      <div style={{flex:1,minWidth:100}}>
                        <div style={{fontWeight:600,fontSize:'.85rem',color:'var(--text)'}}>{p.title}</div>
                        <div style={{fontSize:'.73rem',color:'var(--text3)',marginTop:'.1rem'}}>
                          <span className={`badge badge-sm ${p.status==='active'?'badge-green':p.status==='planning'?'badge-blue':'badge-muted'}`} style={{fontSize:'.65rem'}}>{p.status}</span>
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        {pBudget > 0 ? (
                          <>
                            <div style={{fontFamily:'var(--font-mono)',fontSize:'.8rem',color:'var(--text)'}}>{sar(pBudget)}</div>
                            <div style={{fontFamily:'var(--font-mono)',fontSize:'.73rem',color:barColor(pc)}}>{pc}% used</div>
                          </>
                        ) : (
                          <span style={{fontSize:'.75rem',color:'var(--text3)'}}>No budget assigned</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div style={{display:'flex',flexDirection:'column',gap:'1.1rem'}}>
          {/* By Category Chart */}
          <div className="card">
            <div className="card-title">Spending by Category</div>
            {(summary?.by_category||[]).length === 0 ? (
              <div className="empty-state" style={{padding:'2rem'}}><div className="empty-desc">No data yet</div></div>
            ) : (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={summary?.by_category||[]} margin={{top:4,right:8,bottom:40,left:0}}>
                    <XAxis dataKey="category" tick={{fill:'var(--text3)',fontSize:11}} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false}
                      tickFormatter={v=>v>=1000?(v/1000).toFixed(0)+'k':String(v)}/>
                    <Tooltip
                      formatter={(v:number,n:string)=>[sar(v),n==='budget'?'Budget':'Spent']}
                      contentStyle={{background:'var(--card2)',border:'1px solid var(--border2)',borderRadius:'var(--radius)',fontSize:'.8rem',color:'var(--text)'}}/>
                    <Bar dataKey="budget" name="Budget" fill="var(--blue-d)" radius={[4,4,0,0]} strokeWidth={1} stroke="var(--blue)">
                      {(summary?.by_category||[]).map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]+'30'} stroke={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Bar>
                    <Bar dataKey="spent"  name="Spent"  fill="var(--amber-d)" radius={[4,4,0,0]}>
                      {(summary?.by_category||[]).map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]+'90'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Category table */}
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid var(--border)'}}>
              <div className="card-title">Category Breakdown</div>
            </div>
            <div className="table-wrap" style={{border:'none',borderRadius:0}}>
              <table className="table">
                <thead><tr>
                  <th>Category</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Usage</th>
                </tr></thead>
                <tbody>
                  {(summary?.by_category||[]).map((r,i)=>{
                    const pc2 = pct(r.spent,r.budget)
                    return (
                      <tr key={i}>
                        <td><strong>{r.category}</strong></td>
                        <td className="table-mono">{sar(r.budget)}</td>
                        <td className="table-mono" style={{color:pc2>=100?'var(--rose)':pc2>=80?'var(--amber)':'var(--text)'}}>{sar(r.spent)}</td>
                        <td className="table-mono" style={{color:r.budget-r.spent>=0?'var(--green)':'var(--rose)'}}>{sar(r.budget-r.spent)}</td>
                        <td style={{minWidth:120}}>
                          <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
                            <div className="progress-track" style={{flex:1}}><div className="progress-fill" style={{width:`${pc2}%`,background:barColor(pc2)}}/></div>
                            <span style={{fontFamily:'var(--font-mono)',fontSize:'.72rem',color:barColor(pc2),minWidth:32}}>{pc2}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {(summary?.by_category||[]).length===0 && (
                    <tr><td colSpan={5} style={{textAlign:'center',color:'var(--text3)',padding:'2rem'}}>No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ADD BUDGET MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Budget Line</span>
              <button className="modal-close" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{marginBottom:'.85rem'}}>⚠️ {error}</div>}
              <div style={{display:'flex',flexDirection:'column',gap:'.75rem'}}>
                <div><label className="label">Title *</label>
                  <input className="input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="e.g. Q1 Operations Budget"/>
                </div>
                <div className="form-row form-2col">
                  <div><label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}>
                      {CATS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Period</label>
                    <select className="input" value={form.period} onChange={e=>setForm(p=>({...p,period:e.target.value}))}>
                      {['monthly','quarterly','annual','project'].map(v=><option key={v}>{v}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row form-2col">
                  <div><label className="label">Year</label>
                    <select className="input" value={form.year} onChange={e=>setForm(p=>({...p,year:Number(e.target.value)}))}>
                      {[2023,2024,2025,2026].map(y=><option key={y}>{y}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Month (if monthly)</label>
                    <select className="input" value={form.month} onChange={e=>setForm(p=>({...p,month:Number(e.target.value)}))}>
                      {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row form-2col">
                  <div><label className="label">Budget Amount (SAR) *</label>
                    <input className="input" type="number" min="0" step="0.01" value={form.amount}
                      onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00"/>
                  </div>
                  <div><label className="label">Already Spent (SAR)</label>
                    <input className="input" type="number" min="0" step="0.01" value={form.spent}
                      onChange={e=>setForm(p=>({...p,spent:e.target.value}))} placeholder="0.00"/>
                  </div>
                </div>
                <div><label className="label">Link to Project (optional)</label>
                  <select className="input" value={form.project_id} onChange={e=>setForm(p=>({...p,project_id:e.target.value}))}>
                    <option value="">— No project —</option>
                    {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div><label className="label">Notes</label>
                  <textarea className="input" rows={2} style={{minHeight:64,resize:'none'}} value={form.notes}
                    onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes…"/>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{minWidth:140}}>
                {saving?'⟳ Saving…':'✓ Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
