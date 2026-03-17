// src/pages/TimesheetPage.tsx — Full Timesheet & Attendance Module
import { useEffect, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface Worker { id:string; employee_id:string; full_name:string; department:string; position:string; status:string }
interface AttendanceRecord {
  id:string; worker_id:string; worker_name:string; employee_id:string
  department:string; position:string; date:string; check_in?:string; check_out?:string
  hours_worked:number; status:string; overtime_hours:number; notes?:string
  project?:string; location?:string; approved_by?:string; created_at:string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const STATUS_COLORS: Record<string,string> = { present:'#00ffb3', absent:'#ff3cac', late:'#ffe135', leave:'#4f8cff', holiday:'#bf5fff', half_day:'#ff8800' }

function AttendanceModal({ rec, onClose }: { rec: AttendanceRecord; onClose: () => void }) {
  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:500 }}>
        <div style={{ padding:'1.25rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--font)', fontSize:'1.1rem', fontWeight:800, color:'var(--text)' }}>Attendance Detail</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ padding:'1.25rem' }}>
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', fontFamily:'var(--font)' }}>{rec.worker_name}</div>
            <div style={{ fontSize:'0.7rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>{rec.employee_id} · {rec.department}</div>
          </div>
          <div className="info-grid">
            {[
              ['Date', new Date(rec.date).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})],
              ['Status', rec.status],
              ['Check In', rec.check_in || '—'],
              ['Check Out', rec.check_out || '—'],
              ['Hours Worked', `${rec.hours_worked}h`],
              ['Overtime', `${rec.overtime_hours}h`],
              ['Project', rec.project || '—'],
              ['Location', rec.location || '—'],
              ['Notes', rec.notes || '—'],
            ].map(([l,v]) => (
              <div key={String(l)} className="info-cell">
                <div className="info-cell-label">{String(l)}</div>
                <div className="info-cell-value" style={{ color: l==='Status' ? STATUS_COLORS[String(v)] || 'var(--text)' : 'var(--text)' }}>
                  {String(v)}
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost" style={{ width:'100%', marginTop:'1rem' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function AddAttendanceModal({ workers, onClose, onSave }: { workers:Worker[]; onClose:()=>void; onSave:()=>void }) {
  const [form, setForm] = useState({
    worker_id:'', date:new Date().toISOString().split('T')[0],
    check_in:'08:00', check_out:'17:00', status:'present',
    overtime_hours:0, project:'', location:'', notes:''
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [bulk, setBulk] = useState(false)
  const [bulkWorkers, setBulkWorkers] = useState<string[]>([])

  const hoursWorked = form.check_in && form.check_out ? (() => {
    const [h1,m1] = form.check_in.split(':').map(Number)
    const [h2,m2] = form.check_out.split(':').map(Number)
    return Math.max(0, (h2*60+m2 - h1*60-m1) / 60).toFixed(1)
  })() : '0'

  const set = (k: string, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    setSaving(true); setErr('')
    try {
      const workers_list = bulk ? bulkWorkers : [form.worker_id]
      if (!workers_list.length || (bulk && !bulkWorkers.length) || (!bulk && !form.worker_id)) {
        setErr('Please select worker(s)'); setSaving(false); return
      }
      // API expects { records: [{worker_id, date, status, check_in, check_out, ...}] }
      const records = workers_list.map(wid => ({
        worker_id: wid,
        date: form.date,
        status: form.status,
        check_in: form.check_in || null,
        check_out: form.check_out || null,
        hours_worked: parseFloat(hoursWorked) || 0,
        overtime_hours: parseFloat(form.overtime_hours) || 0,
        project: form.project || null,
        location: form.location || null,
        notes: form.notes || null,
      }))
      await api.post('/attendance', { records })
      onSave()
    } catch(e:unknown) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const inputStyle = { width:'100%', background:'rgba(5,5,26,0.9)', border:'1px solid var(--border)', color:'var(--text)', padding:'0.52rem 0.75rem', borderRadius:'var(--radius)', fontSize:'0.875rem', fontFamily:'var(--font)', outline:'none', minHeight:38 }
  const labelStyle = { display:'block', fontSize:'0.58rem', fontWeight:700 as const, color:'var(--text2)', marginBottom:'0.25rem', textTransform:'uppercase' as const, letterSpacing:'0.08em', fontFamily:'var(--font-mono)' }

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:580 }}>
        <div style={{ padding:'1.15rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--font)', fontSize:'1.1rem', fontWeight:800, color:'var(--text)' }}>🕐 Record Attendance</div>
          <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', fontSize:'0.8rem', color:'var(--text2)' }}>
              <input type="checkbox" checked={bulk} onChange={e=>setBulk(e.target.checked)} /> Bulk Entry
            </label>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
          </div>
        </div>
        <div style={{ padding:'1.15rem' }}>
          {err && <div className="alert-error">{err}</div>}
          <div className="grid-2">
            {!bulk ? (
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>Worker *</label>
                <select style={inputStyle} value={form.worker_id} onChange={e=>set('worker_id',e.target.value)}>
                  <option value="">Select Worker...</option>
                  {workers.filter(w=>w.status==='active').map(w => (
                    <option key={w.id} value={w.id}>{w.full_name} — {w.employee_id}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ gridColumn:'1/-1' }}>
                <label style={labelStyle}>Workers * (Select multiple)</label>
                <select style={{ ...inputStyle, minHeight:100 }} multiple value={bulkWorkers}
                  onChange={e=>setBulkWorkers(Array.from(e.target.selectedOptions,o=>o.value))}>
                  {workers.filter(w=>w.status==='active').map(w => (
                    <option key={w.id} value={w.id}>{w.full_name} ({w.department})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" style={inputStyle} value={form.date} onChange={e=>set('date',e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e=>set('status',e.target.value)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="leave">Leave</option>
                <option value="holiday">Holiday</option>
                <option value="half_day">Half Day</option>
              </select>
            </div>
            {form.status !== 'absent' && form.status !== 'holiday' && (
              <>
                <div>
                  <label style={labelStyle}>Check In</label>
                  <input type="time" style={inputStyle} value={form.check_in} onChange={e=>set('check_in',e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Check Out</label>
                  <input type="time" style={inputStyle} value={form.check_out} onChange={e=>set('check_out',e.target.value)} />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Overtime Hrs</label>
              <input type="number" style={inputStyle} value={form.overtime_hours} onChange={e=>set('overtime_hours',Number(e.target.value))} min={0} step={0.5} />
            </div>
            <div>
              <label style={labelStyle}>Project</label>
              <input type="text" style={inputStyle} value={form.project} onChange={e=>set('project',e.target.value)} placeholder="Site name…" />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" style={inputStyle} value={form.location} onChange={e=>set('location',e.target.value)} placeholder="Work location…" />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input type="text" style={inputStyle} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any notes…" />
            </div>
          </div>
          {form.status !== 'absent' && form.status !== 'holiday' && (
            <div style={{ background:'rgba(79,140,255,0.06)', border:'1px solid rgba(79,140,255,0.2)', borderRadius:8, padding:'0.6rem', marginBottom:'0.75rem', fontSize:'0.82rem', color:'var(--blue)' }}>
              Hours Worked: <strong>{hoursWorked}h</strong>
            </div>
          )}
          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={submit} disabled={saving}>{saving ? 'Saving…' : '✓ Record Attendance'}</button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TimesheetPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<AttendanceRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()+1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterWorker, setFilterWorker] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<'list'|'calendar'>('list')
  const [calWorker, setCalWorker] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<{ attendance: AttendanceRecord[] }>(`/attendance?month=${filterMonth}&year=${filterYear}${filterWorker!=='all'?'&worker_id='+filterWorker:''}`),
      api.get<{ workers: Worker[] }>('/workers')
    ]).then(([a, w]) => {
      setRecords(a.attendance || [])
      setWorkers(w.workers || [])
      if (!calWorker && w.workers.length > 0 && !su) setCalWorker(w.workers[0]?.id || '')
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterMonth, filterYear, filterWorker])

  const filtered = records.filter(r => filterStatus === 'all' || r.status === filterStatus)

  // Stats
  const totalPresent = filtered.filter(r=>r.status==='present' || r.status==='late' || r.status==='half_day').length
  const totalAbsent = filtered.filter(r=>r.status==='absent').length
  const totalLeave = filtered.filter(r=>r.status==='leave').length
  const totalHours = filtered.reduce((s,r)=>s+Number(r.hours_worked),0)
  const totalOT = filtered.reduce((s,r)=>s+Number(r.overtime_hours),0)

  // Calendar view: build days for selected worker
  const daysInMonth = new Date(filterYear, filterMonth, 0).getDate()
  const firstDay = new Date(filterYear, filterMonth-1, 1).getDay()
  const workerRecordsMap: Record<string, AttendanceRecord> = {}
  records.filter(r => !calWorker || r.worker_id === calWorker).forEach(r => {
    const d = new Date(r.date).getDate()
    workerRecordsMap[d] = r
  })

  function exportXLSX() {
    const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
      'Employee ID': r.employee_id, 'Name': r.worker_name, 'Dept': r.department,
      'Date': new Date(r.date).toLocaleDateString('en-GB'), 'Status': r.status,
      'Check In': r.check_in || '', 'Check Out': r.check_out || '',
      'Hours': r.hours_worked, 'Overtime': r.overtime_hours,
      'Project': r.project || '', 'Location': r.location || ''
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet')
    XLSX.writeFile(wb, `Timesheet_${MONTHS[filterMonth-1]}_${filterYear}.xlsx`)
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
    doc.setFontSize(14); doc.setTextColor(79,140,255)
    doc.text(`Alpha Ultimate — Timesheet Report`, 14, 14)
    doc.setFontSize(9); doc.setTextColor(120,115,180)
    doc.text(`${MONTHS[filterMonth-1]} ${filterYear} | Present: ${totalPresent} | Absent: ${totalAbsent} | Total Hours: ${totalHours.toFixed(1)}h`, 14, 20)
    autoTable(doc, {
      startY: 26,
      head:[['ID','Name','Dept','Date','Status','In','Out','Hours','OT','Project']],
      body: filtered.map(r => [r.employee_id, r.worker_name, r.department,
        new Date(r.date).toLocaleDateString('en-GB'), r.status,
        r.check_in||'', r.check_out||'', r.hours_worked, r.overtime_hours, r.project||'']),
      theme:'striped',
      headStyles:{ fillColor:[14,13,46], textColor:[79,140,255], fontSize:7 },
      bodyStyles:{ textColor:[200,195,240], fontSize:7 },
      alternateRowStyles:{ fillColor:[10,9,33] },
    })
    doc.save(`Timesheet_${filterMonth}_${filterYear}.pdf`)
  }

  if (loading) return <div className="loading-center"><div className="spinner" /><div className="loading-text">LOADING TIMESHEET…</div></div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">🕐 Timesheet & Attendance</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--muted)', marginTop:2 }}>
            {filtered.length} records · {totalHours.toFixed(1)}h worked · {totalOT.toFixed(1)}h overtime
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          <button className={`btn ${viewMode==='list'?'btn-secondary':'btn-ghost'}`} onClick={()=>setViewMode('list')}>☰ List</button>
          <button className={`btn ${viewMode==='calendar'?'btn-secondary':'btn-ghost'}`} onClick={()=>setViewMode('calendar')}>📅 Calendar</button>
          {su && <button className="btn btn-primary" onClick={()=>setShowForm(true)}>+ Record</button>}
          <button className="btn btn-secondary" onClick={exportXLSX}>📊 Excel</button>
          <button className="btn btn-secondary" onClick={exportPDF}>📄 PDF</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom:'1rem' }}>
        {[
          { label:'Present', value:totalPresent, color:'#00ffb3' },
          { label:'Absent', value:totalAbsent, color:'#ff3cac' },
          { label:'On Leave', value:totalLeave, color:'#4f8cff' },
          { label:'Total Hours', value:Number(totalHours.toFixed(1)), color:'#bf5fff' },
          { label:'Overtime Hrs', value:Number(totalOT.toFixed(1)), color:'#ffe135' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{'--accent':s.color} as React.CSSProperties}>
            <div className="glow-dot" />
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>{s.label}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <select className="input" style={{ maxWidth:140 }} value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}>
          {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
        </select>
        <input type="number" className="input" style={{ maxWidth:95 }} value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} />
        {su && (
          <select className="input" style={{ maxWidth:200 }} value={filterWorker} onChange={e=>setFilterWorker(e.target.value)}>
            <option value="all">All Workers</option>
            {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
          </select>
        )}
        <select className="input" style={{ maxWidth:130 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {Object.keys(STATUS_COLORS).map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
      </div>

      {viewMode === 'calendar' && (
        <div className="glass" style={{ padding:'1.25rem', marginBottom:'1rem' }}>
          {su && (
            <div style={{ marginBottom:'1rem' }}>
              <select className="input" style={{ maxWidth:250 }} value={calWorker} onChange={e=>setCalWorker(e.target.value)}>
                <option value="">All Workers</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.full_name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'0.3rem', marginBottom:'0.5rem' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign:'center', fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--text2)', padding:'0.3rem' }}>{d}</div>
            ))}
          </div>
          <div className="timesheet-cal">
            {Array.from({length: firstDay}).map((_,i) => <div key={`e${i}`} className="ts-day empty" />)}
            {Array.from({length: daysInMonth}).map((_,i) => {
              const day = i+1
              const rec = workerRecordsMap[day]
              const isToday = new Date().getDate() === day && new Date().getMonth()+1 === filterMonth && new Date().getFullYear() === filterYear
              const cls = rec ? rec.status : ''
              return (
                <div key={day} className={`ts-day ${cls} ${isToday ? 'today' : ''}`}
                  onClick={() => rec && setSelected(rec)}
                  style={{ cursor: rec ? 'pointer' : 'default' }}>
                  <span style={{ fontWeight:600 }}>{day}</span>
                  {rec && <span style={{ fontSize:'0.52rem', opacity:0.8 }}>{rec.status.slice(0,3)}</span>}
                  {rec && rec.hours_worked > 0 && <span style={{ fontSize:'0.5rem', opacity:0.7 }}>{rec.hours_worked}h</span>}
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginTop:'0.75rem', fontSize:'0.7rem' }}>
            {Object.entries(STATUS_COLORS).map(([s,c]) => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                <div style={{ width:10, height:10, borderRadius:2, background:c, opacity:0.7 }} />
                <span style={{ color:'var(--text2)', textTransform:'capitalize' }}>{s.replace('_',' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="glass table-wrap">
          <table>
            <thead>
              <tr>
                {su && <th>Employee</th>}
                {su && <th>Department</th>}
                <th>Date</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th style={{ textAlign:'right' }}>Hours</th>
                <th style={{ textAlign:'right' }}>OT</th>
                <th>Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign:'center', color:'var(--muted)', padding:'3rem' }}>
                  No attendance records for this period.
                </td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="clickable-row" onClick={() => setSelected(r)}>
                  {su && <td>
                    <div style={{ fontWeight:600, color:'var(--text)', fontSize:'0.88rem' }}>{r.worker_name}</div>
                    <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.62rem', color:'var(--cyan)' }}>{r.employee_id}</div>
                  </td>}
                  {su && <td style={{ color:'var(--text2)', fontSize:'0.82rem' }}>{r.department}</td>}
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--text)', whiteSpace:'nowrap' }}>
                    {new Date(r.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',weekday:'short'})}
                  </td>
                  <td>
                    <span style={{ padding:'0.12rem 0.45rem', borderRadius:20, fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', fontFamily:'var(--font-mono)', background:`${STATUS_COLORS[r.status]}18`, color:STATUS_COLORS[r.status], border:`1px solid ${STATUS_COLORS[r.status]}44` }}>
                      {r.status.replace('_',' ')}
                    </span>
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--green)' }}>{r.check_in || '—'}</td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.78rem', color:'var(--rose)' }}>{r.check_out || '—'}</td>
                  <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.82rem', color:'var(--text)' }}>{r.hours_worked}h</td>
                  <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.82rem', color: r.overtime_hours > 0 ? 'var(--amber)' : 'var(--muted)' }}>{r.overtime_hours}h</td>
                  <td style={{ color:'var(--text2)', fontSize:'0.82rem' }}>{r.project || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && <AttendanceModal rec={selected} onClose={()=>setSelected(null)} />}
      {showForm && <AddAttendanceModal workers={workers} onClose={()=>setShowForm(false)} onSave={()=>{ setShowForm(false); load() }} />}
    </div>
  )
}
