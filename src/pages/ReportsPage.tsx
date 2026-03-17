// src/pages/ReportsPage.tsx — Alpha Quantum ERP v16
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

type ReportType = 'expenses' | 'invoices' | 'workers' | 'salary' | 'assets' | 'wallet'

interface Settings {
  company_name?: string; company_address?: string; company_cr?: string
  company_vat?: string; report_footer?: string
}

const REPORT_TYPES: { key: ReportType; label: string; icon: string }[] = [
  { key:'expenses',  label:'Expenses',  icon:'💰' },
  { key:'invoices',  label:'Invoices',  icon:'🧾' },
  { key:'workers',   label:'Workers',   icon:'👷' },
  { key:'salary',    label:'Payroll',   icon:'💵' },
  { key:'assets',    label:'Assets',    icon:'🏗️' },
  { key:'wallet',    label:'Wallet',    icon:'💳' },
]

const STATUS_OPTS: Record<ReportType, string[]> = {
  expenses:  ['','pending','approved','rejected'],
  invoices:  ['','draft','pending','approved','paid','rejected'],
  workers:   ['','active','inactive'],
  salary:    ['','pending','paid'],
  assets:    ['','in_use','under_maintenance','disposed'],
  wallet:    [''],
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [type,     setType]     = useState<ReportType>('expenses')
  const [data,     setData]     = useState<Record<string, unknown>[]>([])
  const [loading,  setLoading]  = useState(false)
  const [err,      setErr]      = useState('')
  const [settings, setSettings] = useState<Settings>({})
  const [filters,  setFilters]  = useState({ from:'', to:'', status:'', year: String(new Date().getFullYear()) })

  useEffect(() => {
    api.get<{ settings: Settings }>('/settings')
      .then(d => setSettings(d.settings || {}))
      .catch(() => {})
  }, [])

  async function loadData() {
    setLoading(true); setErr('')
    try {
      let rows: Record<string,unknown>[] = []
      if (type === 'expenses') {
        const r = await api.get<{ expenses: Record<string,unknown>[] }>('/expenses')
        rows = r.expenses || []
      } else if (type === 'invoices') {
        const r = await api.get<{ invoices: Record<string,unknown>[] }>('/invoices')
        rows = r.invoices || []
      } else if (type === 'workers') {
        const r = await api.get<{ workers: Record<string,unknown>[] }>('/reports/workers')
        rows = r.workers || []
      } else if (type === 'salary') {
        const r = await api.get<{ records: Record<string,unknown>[] }>('/salary')
        rows = r.records || []
      } else if (type === 'assets') {
        const r = await api.get<{ assets: Record<string,unknown>[] }>('/assets')
        rows = r.assets || []
      } else if (type === 'wallet') {
        const r = await api.get<{ wallets: Record<string,unknown>[] }>('/reports/wallet')
        rows = r.wallets || []
      }

      // Apply filters
      if (filters.status) rows = rows.filter(r => r.status === filters.status)
      if (filters.from)   rows = rows.filter(r => {
        const d = String(r.created_at || r.submitted_at || '')
        return d >= filters.from
      })
      if (filters.to)     rows = rows.filter(r => {
        const d = String(r.created_at || r.submitted_at || '')
        return d <= filters.to + 'T23:59:59'
      })

      setData(rows)
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Load failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [type])

  function getColumns(): string[] {
    if (data.length === 0) return []
    const skip = ['_id','cube_id','password_hash','id_photo_url','photo_url','passport_photo_url','iqama_photo_url','media_urls','line_items']
    return Object.keys(data[0]).filter(k => !skip.includes(k))
  }

  function exportPDF() {
    const cols = getColumns()
    const company = settings.company_name || 'Alpha Ultimate Ltd.'
    const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit:'mm', format:'a4' })

    doc.setFillColor(5, 8, 16); doc.rect(0, 0, 300, 200, 'F')
    doc.setFontSize(18); doc.setTextColor(59, 130, 246)
    doc.text(company, 14, 16)
    doc.setFontSize(10); doc.setTextColor(120, 140, 170)
    doc.text(`${REPORT_TYPES.find(t => t.key === type)?.label} Report`, 14, 23)
    doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 29)
    doc.setDrawColor(59, 130, 246); doc.setLineWidth(0.4); doc.line(14, 33, 280, 33)

    const rows = data.map(r => cols.map(c => {
      const v = r[c]
      if (v == null) return '—'
      if (typeof v === 'number') return v.toLocaleString('en-SA', { maximumFractionDigits: 2 })
      if (String(c).includes('_at') || String(c).includes('date')) {
        try { return new Date(String(v)).toLocaleDateString('en-GB') } catch { return String(v) }
      }
      return String(v).slice(0, 60)
    }))

    autoTable(doc, {
      startY: 38,
      head: [cols.map(c => c.replace(/_/g,' ').toUpperCase())],
      body: rows,
      theme: 'plain',
      headStyles: { fillColor:[14,20,32], textColor:[79,140,255], fontSize:7, fontStyle:'bold' },
      bodyStyles: { textColor:[200,210,230], fontSize:7, fillColor:[10,15,26] },
      alternateRowStyles: { fillColor:[14,20,32] },
      margin: { left:14, right:14 },
    })

    const footer = settings.report_footer || `${company} · erp.alpha-01.info · erp@alpha-01.info`
    doc.setFontSize(7); doc.setTextColor(60, 80, 110)
    doc.text(footer, 14, doc.internal.pageSize.height - 8)
    doc.save(`${type}-report-${new Date().toISOString().slice(0,10)}.pdf`)
  }

  function exportExcel() {
    const cols = getColumns()
    const rows = data.map(r => {
      const row: Record<string,unknown> = {}
      cols.forEach(c => {
        const v = r[c]
        if (String(c).includes('_at') || String(c).includes('date')) {
          try { row[c.replace(/_/g,' ')] = v ? new Date(String(v)).toLocaleDateString('en-GB') : '' }
          catch { row[c.replace(/_/g,' ')] = String(v || '') }
        } else {
          row[c.replace(/_/g,' ')] = v ?? ''
        }
      })
      return row
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, type)
    XLSX.writeFile(wb, `${type}-report-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const cols = getColumns()

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">{data.length} records · {REPORT_TYPES.find(t => t.key === type)?.label}</p>
        </div>
        <div style={{ display:'flex', gap:'.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={exportPDF}  disabled={loading || data.length===0}>📄 PDF</button>
          <button className="btn btn-success  btn-sm" onClick={exportExcel} disabled={loading || data.length===0}>📊 Excel</button>
        </div>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {/* Report type tabs */}
      <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap', marginBottom:'1.25rem' }}>
        {REPORT_TYPES.map(rt => (
          <button key={rt.key}
            className={`btn btn-sm ${type===rt.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setType(rt.key)}>
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom:'1.25rem', padding:'1rem' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'.75rem', alignItems:'end' }}>
          <div>
            <label className="label">From Date</label>
            <input className="input" type="date" value={filters.from}
              onChange={e => setFilters(f => ({...f,from:e.target.value}))} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input className="input" type="date" value={filters.to}
              onChange={e => setFilters(f => ({...f,to:e.target.value}))} />
          </div>
          {STATUS_OPTS[type]?.length > 1 && (
            <div>
              <label className="label">Status</label>
              <select className="input" value={filters.status}
                onChange={e => setFilters(f => ({...f,status:e.target.value}))}>
                <option value="">All Statuses</option>
                {STATUS_OPTS[type].filter(Boolean).map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          )}
          <button className="btn btn-primary" onClick={loadData} disabled={loading}>
            {loading ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Loading…</> : '🔍 Generate'}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {data.length > 0 && (
        <div className="stat-grid" style={{ marginBottom:'1.25rem' }}>
          <div className="stat-card" style={{ '--accent':'var(--blue)' } as React.CSSProperties}>
            <div className="stat-label">Total Records</div>
            <div className="stat-value">{data.length}</div>
          </div>
          {(type === 'expenses' || type === 'invoices') && (
            <div className="stat-card" style={{ '--accent':'var(--green)' } as React.CSSProperties}>
              <div className="stat-label">{type === 'expenses' ? 'Total Amount' : 'Total Value'}</div>
              <div className="stat-value" style={{ fontSize:'1.15rem' }}>
                SAR {data.reduce((s, r) => s + (Number(r.grand_total || r.total_amount || 0)), 0)
                  .toLocaleString('en-SA', { minimumFractionDigits:0 })}
              </div>
            </div>
          )}
          {type === 'workers' && (
            <div className="stat-card" style={{ '--accent':'var(--violet)' } as React.CSSProperties}>
              <div className="stat-label">Active Workers</div>
              <div className="stat-value">{data.filter(r => r.status === 'active').length}</div>
            </div>
          )}
        </div>
      )}

      {/* Data table */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'3rem' }}><div className="spinner"/></div>
      ) : data.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No Data</div>
          <div className="empty-desc">Click "Generate" to load report data, or adjust your filters.</div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="table-wrap" style={{ border:'none', borderRadius:0, maxHeight:'60vh' }}>
            <table>
              <thead>
                <tr>
                  {cols.map(c => (
                    <th key={c}>{c.replace(/_/g,' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i}>
                    {cols.map(c => {
                      const v = row[c]
                      const isAmt = ['grand_total','total_amount','amount','net_salary','gross_salary','basic_salary','purchase_cost','current_value','balance','total_invoiced','total_expenses'].includes(c)
                      const isDate = String(c).includes('_at') || String(c).includes('date')
                      const isStatus = c === 'status'
                      return (
                        <td key={c}>
                          {isStatus && v
                            ? <span className={`badge badge-${v}`}>{String(v)}</span>
                            : isAmt && typeof v === 'number'
                            ? <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:'var(--text)' }}>
                                {Number(v).toLocaleString('en-SA', { minimumFractionDigits:2 })}
                              </span>
                            : isDate && v
                            ? <span style={{ fontSize:'.8rem', color:'var(--text2)' }}>
                                {new Date(String(v)).toLocaleDateString('en-GB')}
                              </span>
                            : v == null
                            ? <span style={{ color:'var(--text3)' }}>—</span>
                            : <span style={{ fontSize:'.84rem' }}>{String(v).slice(0, 80)}</span>
                          }
                        </td>
                      )
                    })}
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
