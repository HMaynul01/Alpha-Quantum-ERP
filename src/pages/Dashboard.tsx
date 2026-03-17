// src/pages/Dashboard.tsx — Alpha Quantum ERP v16
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DashData {
  expenses:          { total_count:number; approved_total:number; pending_count:number; approved_count:number; rejected_count:number }
  invoices:          { total_count:number; approved_total:number; pending_count:number; approved_count:number }
  pending_approvals: number
  monthly_trend:     { month:string; total:number }[]
  wallet:            { total_invoiced:number; total_expenses:number; balance:number } | null
  assets:            { total:number; total_value:number }
  workers:           { total:number }
  crm?:              { customers:number; leads:number; leads_won:number }
  projects?:         { total:number; active:number; tasks_total:number; tasks_done:number }
}

const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#22d3ee','#f43f5e']

function Counter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    const start = performance.now()
    const dur = 1100
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / dur, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.floor(ease * value))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
      else setDisplay(value)
    })
    return () => cancelAnimationFrame(rafRef.current)
  }, [value])
  return <>{prefix}{display.toLocaleString('en-SA')}{suffix}</>
}

const TOOLTIP_STYLE = {
  background: 'var(--card2)',
  border: '1px solid var(--border2)',
  borderRadius: 'var(--radius)',
  fontSize: '.8rem',
  color: 'var(--text)',
  boxShadow: 'var(--shadow)',
}
const TICK = { fill: 'var(--text3)', fontSize: 11 }

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const su = isSuperUser(user)
  const [data, setData]       = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = useCallback(() => {
    setLoading(true); setError('')
    api.get<DashData>('/reports/dashboard')
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const fmt = (n: number) => 'SAR ' + (n || 0).toLocaleString('en-SA', { minimumFractionDigits: 0 })

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:'1rem' }}>
      <div className="spinner" style={{ width:36, height:36 }} />
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'.75rem', color:'var(--text3)', letterSpacing:'.1em' }}>Loading…</span>
    </div>
  )

  if (error) return (
    <div className="page-content">
      <div className="alert alert-error">
        ⚠️ {error}
        <button className="btn btn-sm btn-secondary" onClick={load} style={{ marginLeft:'auto' }}>Retry</button>
      </div>
    </div>
  )

  if (!data) return null

  const pieData = [
    { name:'Approved', value: Number(data.expenses.approved_count) },
    { name:'Pending',  value: Number(data.expenses.pending_count) },
    { name:'Rejected', value: Number(data.expenses.rejected_count) },
  ].filter(d => d.value > 0)

  const kpis = [
    { label:'Total Expenses',  value: fmt(data.expenses.approved_total), sub:`${data.expenses.total_count} records`,   color:'#3b82f6', icon:'💰', path:'/expenses' },
    { label:'Total Invoiced',  value: fmt(data.invoices.approved_total), sub:`${data.invoices.total_count} invoices`,  color:'#10b981', icon:'🧾', path:'/invoices' },
    { label:'Balance',         value: fmt(data.wallet?.balance ?? 0),    sub: data.wallet ? fmt(data.wallet.total_invoiced)+' invoiced' : 'No data', color: (data.wallet?.balance ?? 0) >= 0 ? '#10b981' : '#f43f5e', icon:'💳', path:'/wallet' },
    { label:'Workers',         value: String(data.workers?.total ?? 0),  sub:'Active HR force',                        color:'#8b5cf6', icon:'👷', path:'/workers' },
    { label:'Assets',          value: String(data.assets?.total ?? 0),   sub:fmt(data.assets?.total_value ?? 0)+' value', color:'#22d3ee', icon:'🏗️', path:'/assets' },
    ...(su ? [{ label:'Pending Approvals', value: String(data.pending_approvals), sub:'Awaiting review', color:data.pending_approvals > 0 ? '#f43f5e' : '#10b981', icon:'✅', path:'/approvals' }] : []),
    ...(data.crm ? [{ label:'Customers', value: String(data.crm.customers), sub:`${data.crm.leads} leads · ${data.crm.leads_won} won`, color:'#f97316', icon:'🏢', path:'/crm/customers' }] : []),
    ...(data.projects ? [{ label:'Active Projects', value: String(data.projects.active), sub:`${data.projects.tasks_done}/${data.projects.tasks_total} tasks`, color:'#a3e635', icon:'📁', path:'/projects' }] : []),
  ]

  const quickActions = [
    { label:'New Expense', icon:'💰', path:'/expenses/new', color:'var(--blue)' },
    { label:'New Invoice', icon:'🧾', path:'/invoices/new', color:'var(--green)' },
    { label:'Add Worker',  icon:'👷', path:'/workers',      color:'var(--violet)' },
    { label:'New Project', icon:'📁', path:'/projects',     color:'var(--amber)' },
    { label:'New Lead',    icon:'🎯', path:'/crm/leads',    color:'var(--cyan)' },
    { label:'Reports',     icon:'📋', path:'/reports',      color:'var(--rose)' },
  ]

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Welcome back, <strong>{user?.full_name?.split(' ')[0]}</strong> 👋 · {new Date().toLocaleDateString('en-SA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid" style={{ marginBottom:'1.5rem' }}>
        {kpis.map((k, i) => (
          <div key={i} className="stat-card" onClick={() => navigate(k.path)}
            style={{ '--accent': k.color } as React.CSSProperties}>
            <div className="stat-icon">{k.icon}</div>
            <div className="stat-label">{k.label}</div>
            <div className="stat-value" style={{ color: k.color, fontSize:'1.5rem' }}>
              {k.value.startsWith('SAR') ? (
                <><span style={{ fontSize:'.75rem', opacity:.6 }}>SAR </span>{k.value.replace('SAR ', '')}</>
              ) : <Counter value={Number(k.value) || 0} />}
            </div>
            <div className="stat-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom:'1.1rem' }}>
        {/* Monthly trend */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Monthly Expense Trend</div>
              <div className="card-sub">Last 6 months · approved expenses</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={data.monthly_trend} margin={{ top:5, right:8, bottom:0, left:0 }}>
              <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+'k' : String(v)} />
              <Tooltip
                formatter={(v: number) => ['SAR ' + v.toLocaleString('en-SA'), 'Expenses']}
                contentStyle={TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#gBlue)" dot={{ r:3, fill:'#3b82f6' }} activeDot={{ r:5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense status pie */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Expense Status</div>
          </div>
          {pieData.length === 0 ? (
            <div className="empty-state" style={{ padding:'2.5rem 1rem' }}>
              <div className="empty-icon">📊</div>
              <div className="empty-desc">No expense data yet</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={8} iconType="circle"
                  wrapperStyle={{ fontSize:'.76rem', color:'var(--text2)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Finance summary + Quick actions */}
      <div className="grid-2" style={{ marginBottom:'1.1rem' }}>
        {/* Finance summary */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Finance Summary</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
            {[
              { label:'Total Revenue',  val:data.wallet?.total_invoiced ?? 0,       color:'var(--green)' },
              { label:'Total Expenses', val:data.wallet?.total_expenses ?? 0,        color:'var(--rose)' },
              { label:'Net Balance',    val:data.wallet?.balance ?? 0,               color:(data.wallet?.balance??0)>=0?'var(--green)':'var(--rose)' },
              { label:'Pending Value',  val:data.expenses.pending_count * 0,         color:'var(--amber)', hide:true },
            ].filter(r => !r.hide).map((r, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'.65rem .85rem', background:'var(--hover-bg)', borderRadius:'var(--radius)' }}>
                <span style={{ fontSize:'.82rem', color:'var(--text2)' }}>{r.label}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, color:r.color, fontSize:'.9rem' }}>{fmt(r.val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Quick Actions</div>
          </div>
          <div className="grid-2">
            {quickActions.map(a => (
              <button key={a.path} onClick={() => navigate(a.path)}
                style={{ display:'flex', alignItems:'center', gap:'.5rem', padding:'.65rem .9rem', background:'var(--hover-bg)', border:'1px solid var(--border2)', borderRadius:'var(--radius)', cursor:'pointer', fontSize:'.84rem', color:'var(--text2)', fontWeight:500, transition:'all .14s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover-bg2)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--hover-bg)'; e.currentTarget.style.color = 'var(--text2)' }}>
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly bar chart if CRM data */}
      {data.crm && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">CRM Overview</div>
          </div>
          <div className="grid-3">
            {[
              { label:'Total Customers', value:data.crm.customers, color:'#f97316', icon:'🏢' },
              { label:'Total Leads',     value:data.crm.leads,     color:'#3b82f6', icon:'🎯' },
              { label:'Leads Won',       value:data.crm.leads_won, color:'#10b981', icon:'🏆' },
            ].map((s, i) => (
              <div key={i} style={{ padding:'1rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'.72rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.35rem' }}>{s.label}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:700, color:s.color }}>{s.value}</div>
                </div>
                <span style={{ fontSize:'1.8rem', opacity:.3 }}>{s.icon}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
