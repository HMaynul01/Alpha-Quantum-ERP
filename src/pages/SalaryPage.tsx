// src/pages/SalaryPage.tsx — Full Payroll & Salary Module
import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface Worker {
  id: string; employee_id: string; full_name: string; position: string; department: string
  basic_salary: number; housing_allowance: number; transport_allowance: number
  other_allowance: number; bank_name?: string; bank_iban?: string
  photo_url?: string; status: string; phone?: string
}

interface SalaryRecord {
  id: string; worker_id: string; worker_name: string; employee_id: string
  department: string; position: string; period_month: number; period_year: number
  basic_salary: number; housing_allowance: number; transport_allowance: number
  other_allowance: number; overtime_hours: number; overtime_rate: number; overtime_pay: number
  deductions: number; deduction_reason?: string; bonus: number; bonus_reason?: string
  gross_salary: number; net_salary: number; gosi_employee: number; gosi_employer: number
  working_days: number; absent_days: number; leave_days: number
  payment_method: string; payment_date?: string; status: string; notes?: string
  created_by_name?: string; created_at: string
}

interface SalaryFormData {
  worker_id: string; period_month: number; period_year: number
  overtime_hours: number; overtime_rate: number
  deductions: number; deduction_reason: string
  bonus: number; bonus_reason: string
  working_days: number; absent_days: number; leave_days: number
  payment_method: string; payment_date: string; notes: string
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const sar = (n: number) => `SAR ${Number(n||0).toLocaleString('en-SA',{minimumFractionDigits:2})}`

function SlipModal({ rec, onClose, onPaid, su }: { rec: SalaryRecord; onClose: () => void; onPaid?: (id:string) => void; su?: boolean }) {
  const [paying, setPaying] = useState(false)
  function printPDF() {
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
    doc.setFillColor(5,5,26); doc.rect(0,0,210,297,'F')
    doc.setFontSize(18); doc.setTextColor(79,140,255)
    doc.text('ALPHA ULTIMATE', 15, 18)
    doc.setFontSize(10); doc.setTextColor(120,115,180)
    doc.text('Construction & Cleaning | KSA', 15, 25)
    doc.setFontSize(14); doc.setTextColor(255,255,255)
    doc.text('SALARY SLIP', 140, 18)
    doc.setFontSize(9); doc.setTextColor(120,115,180)
    doc.text(`${MONTHS[rec.period_month-1]} ${rec.period_year}`, 140, 25)
    doc.setDrawColor(79,140,255); doc.setLineWidth(0.5); doc.line(15,30,195,30)
    doc.setFontSize(11); doc.setTextColor(255,255,255)
    doc.text(rec.worker_name, 15, 40)
    doc.setFontSize(9); doc.setTextColor(150,145,200)
    doc.text(`EMP: ${rec.employee_id}  |  ${rec.position}  |  ${rec.department}`, 15, 47)

    const earnings = [
      ['Basic Salary', sar(rec.basic_salary)],
      ['Housing Allowance', sar(rec.housing_allowance)],
      ['Transport Allowance', sar(rec.transport_allowance)],
      ['Other Allowance', sar(rec.other_allowance)],
      ['Overtime Pay', sar(rec.overtime_pay)],
      ['Bonus', sar(rec.bonus)],
    ]
    const deductRows = [
      ['Deductions', `- ${sar(rec.deductions)}`],
      ['GOSI (Employee)', `- ${sar(rec.gosi_employee)}`],
      ['Absent Days Deduction', `- ${sar((rec.absent_days/rec.working_days)*rec.basic_salary)}`],
    ]

    autoTable(doc, {
      startY: 55, head:[['EARNINGS','AMOUNT']], body: earnings,
      theme:'plain',
      headStyles:{ fillColor:[14,13,46], textColor:[79,140,255], fontSize:9 },
      bodyStyles:{ textColor:[220,215,255], fontSize:9, fillColor:[10,9,33] },
      alternateRowStyles:{ fillColor:[14,13,46] },
      margin:{ left:15, right:110 }
    })
    autoTable(doc, {
      startY: 55, head:[['DEDUCTIONS','AMOUNT']], body: deductRows,
      theme:'plain',
      headStyles:{ fillColor:[14,13,46], textColor:[255,60,172], fontSize:9 },
      bodyStyles:{ textColor:[220,215,255], fontSize:9, fillColor:[10,9,33] },
      alternateRowStyles:{ fillColor:[14,13,46] },
      margin:{ left:110, right:15 }
    })

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFillColor(14,13,46); doc.roundedRect(15, finalY, 180, 18, 3, 3, 'F')
    doc.setFontSize(12); doc.setTextColor(0,255,179)
    doc.text('NET SALARY:', 20, finalY+12)
    doc.setFontSize(14); doc.setTextColor(0,255,179)
    doc.text(sar(rec.net_salary), 130, finalY+12)

    doc.setFontSize(8); doc.setTextColor(100,95,150)
    doc.text(`Working Days: ${rec.working_days}  |  Absent: ${rec.absent_days}  |  Leave: ${rec.leave_days}`, 15, finalY+30)
    doc.text(`Payment: ${rec.payment_method}  |  Date: ${rec.payment_date || 'Pending'}`, 15, finalY+37)
    doc.text(`Status: ${rec.status.toUpperCase()}`, 15, finalY+44)
    doc.setTextColor(60,55,110)
    doc.text('This is a computer-generated salary slip. Alpha Ultimate Ltd.', 15, 282)

    doc.save(`Salary_${rec.employee_id}_${rec.period_month}_${rec.period_year}.pdf`)
  }

  const totalEarnings = rec.basic_salary + rec.housing_allowance + rec.transport_allowance + rec.other_allowance + rec.overtime_pay + rec.bonus
  const totalDeductions = rec.deductions + rec.gosi_employee

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:600 }}>
        {/* Slip Header */}
        <div style={{ background:'linear-gradient(135deg,rgba(79,140,255,0.18),rgba(0,255,179,0.08))', padding:'1.5rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontFamily:'var(--font)', fontSize:'1.3rem', fontWeight:800, color:'var(--blue)', letterSpacing:'0.05em' }}>SALARY SLIP</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--text2)', marginTop:2 }}>
                {MONTHS[rec.period_month-1]} {rec.period_year}
              </div>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
          </div>
          <div style={{ marginTop:'0.75rem' }}>
            <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', fontFamily:'var(--font)' }}>{rec.worker_name}</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text2)', fontFamily:'var(--font-mono)' }}>
              {rec.employee_id} · {rec.position} · {rec.department}
            </div>
          </div>
        </div>

        {/* Slip Body */}
        <div style={{ padding:'1.25rem' }}>
          {/* Earnings */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--green)', letterSpacing:'0.1em', marginBottom:'0.5rem', textTransform:'uppercase' }}>EARNINGS</div>
            {[
              ['Basic Salary', rec.basic_salary],
              ['Housing Allowance', rec.housing_allowance],
              ['Transport Allowance', rec.transport_allowance],
              ['Other Allowance', rec.other_allowance],
              rec.overtime_pay > 0 ? [`Overtime (${rec.overtime_hours}hrs × SAR${rec.overtime_rate}/hr)`, rec.overtime_pay] : null,
              rec.bonus > 0 ? [`Bonus${rec.bonus_reason ? ' - '+rec.bonus_reason : ''}`, rec.bonus] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={String(label)} style={{ display:'flex', justifyContent:'space-between', padding:'0.35rem 0', borderBottom:'1px solid rgba(42,37,96,0.3)', fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text2)' }}>{String(label)}</span>
                <span style={{ color:'var(--green)', fontFamily:'var(--font-mono)', fontSize:'0.8rem' }}>{sar(Number(val))}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'0.45rem 0', fontSize:'0.88rem', fontWeight:700 }}>
              <span style={{ color:'var(--text)' }}>Gross Salary</span>
              <span style={{ color:'var(--green)', fontFamily:'var(--font-mono)' }}>{sar(totalEarnings)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--rose)', letterSpacing:'0.1em', marginBottom:'0.5rem', textTransform:'uppercase' }}>DEDUCTIONS</div>
            {[
              rec.deductions > 0 ? [`Deductions${rec.deduction_reason ? ' - '+rec.deduction_reason : ''}`, rec.deductions] : null,
              rec.gosi_employee > 0 ? ['GOSI (Employee 10%)', rec.gosi_employee] : null,
              rec.absent_days > 0 ? [`Absent Days (${rec.absent_days} days)`, (rec.absent_days/Math.max(rec.working_days,1))*rec.basic_salary] : null,
            ].filter(Boolean).map(([label, val]) => (
              <div key={String(label)} style={{ display:'flex', justifyContent:'space-between', padding:'0.35rem 0', borderBottom:'1px solid rgba(42,37,96,0.3)', fontSize:'0.85rem' }}>
                <span style={{ color:'var(--text2)' }}>{String(label)}</span>
                <span style={{ color:'var(--rose)', fontFamily:'var(--font-mono)', fontSize:'0.8rem' }}>- {sar(Number(val))}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'0.45rem 0', fontSize:'0.88rem', fontWeight:700 }}>
              <span style={{ color:'var(--text)' }}>Total Deductions</span>
              <span style={{ color:'var(--rose)', fontFamily:'var(--font-mono)' }}>- {sar(totalDeductions)}</span>
            </div>
          </div>

          {/* Net */}
          <div style={{ background:'rgba(0,255,179,0.08)', border:'1px solid rgba(0,255,179,0.25)', borderRadius:10, padding:'1rem', marginBottom:'1rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)', fontFamily:'var(--font)' }}>NET SALARY</span>
            <span style={{ fontSize:'1.3rem', fontWeight:800, color:'var(--green)', fontFamily:'var(--font-mono)', textShadow:'0 0 20px rgba(0,255,179,0.4)' }}>{sar(rec.net_salary)}</span>
          </div>

          {/* Attendance */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'1rem' }}>
            {[['Working Days', rec.working_days, '#4f8cff'],['Absent', rec.absent_days, '#ff3cac'],['Leave', rec.leave_days, '#ffe135']].map(([l,v,c]) => (
              <div key={String(l)} style={{ background:'rgba(255,255,255,0.03)', borderRadius:8, padding:'0.6rem', textAlign:'center', border:'1px solid var(--border)' }}>
                <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', color:String(c), fontWeight:700 }}>{String(v)}</div>
                <div style={{ fontSize:'0.62rem', color:'var(--text2)', marginTop:2 }}>{String(l)}</div>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="grid-2">
            <span>Payment: <strong style={{ color:'var(--text)' }}>{rec.payment_method}</strong></span>
            <span>Date: <strong style={{ color:'var(--text)' }}>{rec.payment_date || 'Pending'}</strong></span>
            <span>Status: <span className={`badge badge-${rec.status === 'paid' ? 'approved' : rec.status === 'pending' ? 'pending' : 'hold'}`}>{rec.status}</span></span>
            {rec.notes && <span>Notes: {rec.notes}</span>}
          </div>

          <div style={{ display:'flex', gap:'0.5rem', marginTop:'1.25rem' }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={printPDF}>📥 Download PDF</button>
            {su && rec.status !== 'paid' && (
              <button className="btn btn-success" disabled={paying} onClick={async () => {
                setPaying(true)
                try { await api.post('/salary/pay', { id: rec.id }); onPaid?.(rec.id) }
                catch (e) { alert(e instanceof Error ? e.message : 'Error') }
                finally { setPaying(false) }
              }}>
                {paying ? '…' : '✅ Mark Paid'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SalaryForm({ workers, onClose, onSave }: { workers: Worker[]; onClose: () => void; onSave: () => void }) {
  const now = new Date()
  const [form, setForm] = useState<SalaryFormData>({
    worker_id: '', period_month: now.getMonth()+1, period_year: now.getFullYear(),
    overtime_hours: 0, overtime_rate: 25,
    deductions: 0, deduction_reason: '', bonus: 0, bonus_reason: '',
    working_days: 26, absent_days: 0, leave_days: 0,
    payment_method: 'bank_transfer', payment_date: '', notes: ''
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const selectedWorker = workers.find(w => w.id === form.worker_id)
  const basicSalary = Number(selectedWorker?.basic_salary || 0)
  const housing = Number(selectedWorker?.housing_allowance || 0)
  const transport = Number(selectedWorker?.transport_allowance || 0)
  const other = Number(selectedWorker?.other_allowance || 0)
  const overtimePay = form.overtime_hours * form.overtime_rate
  const grossSalary = basicSalary + housing + transport + other + overtimePay + form.bonus
  const gosiEmployee = basicSalary * 0.10
  const absentDeduction = form.absent_days > 0 ? (form.absent_days / Math.max(form.working_days,1)) * basicSalary : 0
  const netSalary = grossSalary - form.deductions - gosiEmployee - absentDeduction

  const set = (k: keyof SalaryFormData, v: string | number) => setForm(p => ({ ...p, [k]: v }))

  async function submit() {
    if (!form.worker_id) { setErr('Please select a worker'); return }
    setSaving(true); setErr('')
    try {
      await api.post('/salary', { ...form, gross_salary: grossSalary, net_salary: Math.max(0,netSalary), overtime_pay: overtimePay, gosi_employee: gosiEmployee })
      onSave()
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const inputStyle = { width:'100%', background:'rgba(5,5,26,0.9)', border:'1px solid var(--border)', color:'var(--text)', padding:'0.55rem 0.8rem', borderRadius:'var(--radius)', fontSize:'0.875rem', fontFamily:'var(--font)', outline:'none', minHeight:38 }
  const labelStyle = { display:'block', fontSize:'0.6rem', fontWeight:700, color:'var(--text2)', marginBottom:'0.25rem', textTransform:'uppercase' as const, letterSpacing:'0.08em', fontFamily:'var(--font-mono)' }
  const rowStyle = { display:'flex', flexDirection:'column' as const, gap:'0.25rem' }

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:700 }}>
        <div style={{ padding:'1.25rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'var(--font)', fontSize:'1.15rem', fontWeight:800, color:'var(--text)' }}>💰 Generate Salary</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', cursor:'pointer', fontSize:'1.2rem' }}>✕</button>
        </div>
        <div style={{ padding:'1.25rem', overflowY:'auto', maxHeight:'75vh' }}>
          {err && <div className="alert-error">{err}</div>}

          <div className="grid-3">
            <div style={{ ...rowStyle, gridColumn:'1/-1' }}>
              <label style={labelStyle}>Worker *</label>
              <select style={inputStyle} value={form.worker_id} onChange={e=>set('worker_id',e.target.value)}>
                <option value="">Select Worker...</option>
                {workers.filter(w=>w.status==='active').map(w => (
                  <option key={w.id} value={w.id}>{w.full_name} — {w.employee_id} ({w.department})</option>
                ))}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Month *</label>
              <select style={inputStyle} value={form.period_month} onChange={e=>set('period_month',Number(e.target.value))}>
                {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Year *</label>
              <input type="number" style={inputStyle} value={form.period_year} onChange={e=>set('period_year',Number(e.target.value))} min={2020} max={2030} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Working Days</label>
              <input type="number" style={inputStyle} value={form.working_days} onChange={e=>set('working_days',Number(e.target.value))} min={0} max={31} />
            </div>
          </div>

          {selectedWorker && (
            <div style={{ background:'rgba(79,140,255,0.06)', border:'1px solid rgba(79,140,255,0.2)', borderRadius:10, padding:'0.75rem', marginBottom:'0.75rem' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--blue)', letterSpacing:'0.1em', marginBottom:'0.5rem' }}>BASE SALARY COMPONENTS</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.5rem', fontSize:'0.8rem' }}>
                {[['Basic',basicSalary],['Housing',housing],['Transport',transport],['Other',other]].map(([l,v]) => (
                  <div key={String(l)}>
                    <div style={{ color:'var(--text2)', fontSize:'0.65rem' }}>{String(l)}</div>
                    <div style={{ color:'var(--green)', fontFamily:'var(--font-mono)', fontSize:'0.78rem' }}>{sar(Number(v))}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid-3">
            <div style={rowStyle}>
              <label style={labelStyle}>Absent Days</label>
              <input type="number" style={inputStyle} value={form.absent_days} onChange={e=>set('absent_days',Number(e.target.value))} min={0} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Leave Days</label>
              <input type="number" style={inputStyle} value={form.leave_days} onChange={e=>set('leave_days',Number(e.target.value))} min={0} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Overtime Hours</label>
              <input type="number" style={inputStyle} value={form.overtime_hours} onChange={e=>set('overtime_hours',Number(e.target.value))} min={0} step={0.5} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>OT Rate (SAR/hr)</label>
              <input type="number" style={inputStyle} value={form.overtime_rate} onChange={e=>set('overtime_rate',Number(e.target.value))} min={0} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Bonus (SAR)</label>
              <input type="number" style={inputStyle} value={form.bonus} onChange={e=>set('bonus',Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Deductions (SAR)</label>
              <input type="number" style={inputStyle} value={form.deductions} onChange={e=>set('deductions',Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div style={{ ...rowStyle, gridColumn:'1/-1' }}>
              <label style={labelStyle}>Bonus Reason</label>
              <input type="text" style={inputStyle} value={form.bonus_reason} onChange={e=>set('bonus_reason',e.target.value)} placeholder="Performance bonus, Eid bonus..." />
            </div>
            <div style={{ ...rowStyle, gridColumn:'1/-1' }}>
              <label style={labelStyle}>Deduction Reason</label>
              <input type="text" style={inputStyle} value={form.deduction_reason} onChange={e=>set('deduction_reason',e.target.value)} placeholder="Loan repayment, penalty..." />
            </div>
          </div>

          <div className="grid-2">
            <div style={rowStyle}>
              <label style={labelStyle}>Payment Method</label>
              <select style={inputStyle} value={form.payment_method} onChange={e=>set('payment_method',e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>Payment Date</label>
              <input type="date" style={inputStyle} value={form.payment_date} onChange={e=>set('payment_date',e.target.value)} />
            </div>
            <div style={{ ...rowStyle, gridColumn:'1/-1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, minHeight:60, resize:'vertical' }} value={form.notes} onChange={e=>set('notes',e.target.value)} />
            </div>
          </div>

          {/* Summary */}
          {selectedWorker && (
            <div style={{ background:'rgba(0,255,179,0.06)', border:'1px solid rgba(0,255,179,0.2)', borderRadius:10, padding:'1rem', marginBottom:'1rem' }}>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.6rem', color:'var(--green)', letterSpacing:'0.1em', marginBottom:'0.6rem' }}>SALARY PREVIEW</div>
              <div className="grid-3">
                <div><div style={{color:'var(--text2)',fontSize:'0.65rem'}}>Gross</div><div style={{color:'var(--green)',fontFamily:'var(--font-mono)'}}>{sar(grossSalary)}</div></div>
                <div><div style={{color:'var(--text2)',fontSize:'0.65rem'}}>Deductions</div><div style={{color:'var(--rose)',fontFamily:'var(--font-mono)'}}>-{sar(form.deductions + gosiEmployee + absentDeduction)}</div></div>
                <div><div style={{color:'var(--text2)',fontSize:'0.65rem'}}>NET SALARY</div><div style={{color:'var(--green)',fontFamily:'var(--font-mono)',fontSize:'1rem',fontWeight:700}}>{sar(Math.max(0,netSalary))}</div></div>
              </div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-dim)' }}>GOSI (Employer 12%): {sar(basicSalary * 0.12)}</div>
            </div>
          )}

          <div style={{ display:'flex', gap:'0.5rem' }}>
            <button className="btn btn-primary" style={{ flex:1 }} onClick={submit} disabled={saving}>
              {saving ? 'Generating…' : '💰 Generate Salary'}
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SalaryPage() {
  const { user } = useAuth()
  const su = isSuperUser(user)
  const [records, setRecords] = useState<SalaryRecord[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<SalaryRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth()+1)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterDept, setFilterDept] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get<{ salary_records: SalaryRecord[] }>(`/salary?month=${filterMonth}&year=${filterYear}`),
      api.get<{ workers: Worker[] }>('/workers')
    ]).then(([s, w]) => {
      setRecords(s.salary_records || [])
      setWorkers(w.workers || [])
    }).catch(e => setError(e.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterMonth, filterYear])

  const filtered = records.filter(r => {
    const q = search.toLowerCase()
    return (!q || r.worker_name.toLowerCase().includes(q) || r.employee_id.toLowerCase().includes(q))
      && (filterDept === 'all' || r.department === filterDept)
      && (filterStatus === 'all' || r.status === filterStatus)
  })

  const totalNet = filtered.reduce((s,r) => s+Number(r.net_salary), 0)
  const totalGross = filtered.reduce((s,r) => s+Number(r.gross_salary), 0)
  const depts = [...new Set(records.map(r=>r.department))].filter(Boolean)

  function exportXLSX() {
    const rows = filtered.map(r => ({
      'Employee ID': r.employee_id, 'Name': r.worker_name, 'Department': r.department,
      'Position': r.position, 'Month': MONTHS[r.period_month-1], 'Year': r.period_year,
      'Basic Salary': r.basic_salary, 'Housing': r.housing_allowance, 'Transport': r.transport_allowance,
      'Other': r.other_allowance, 'Overtime': r.overtime_pay, 'Bonus': r.bonus,
      'Gross Salary': r.gross_salary, 'Deductions': r.deductions, 'GOSI (Emp)': r.gosi_employee,
      'Net Salary': r.net_salary, 'Working Days': r.working_days, 'Absent': r.absent_days,
      'Leave': r.leave_days, 'Payment': r.payment_method, 'Status': r.status
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Salary')
    XLSX.writeFile(wb, `Salary_${MONTHS[filterMonth-1]}_${filterYear}.xlsx`)
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
    doc.setFontSize(14); doc.setTextColor(79,140,255)
    doc.text(`Alpha Ultimate — Salary Report`, 14, 14)
    doc.setFontSize(10); doc.setTextColor(120,115,180)
    doc.text(`${MONTHS[filterMonth-1]} ${filterYear} | Total Net: ${sar(totalNet)}`, 14, 21)
    autoTable(doc, {
      startY: 28,
      head:[['EMP ID','Name','Dept','Basic','Gross','Deductions','Net','Status']],
      body: filtered.map(r => [r.employee_id, r.worker_name, r.department,
        sar(r.basic_salary), sar(r.gross_salary), sar(r.deductions+r.gosi_employee), sar(r.net_salary), r.status]),
      theme:'striped',
      headStyles:{ fillColor:[14,13,46], textColor:[79,140,255], fontSize:8 },
      bodyStyles:{ textColor:[200,195,240], fontSize:8 },
      alternateRowStyles:{ fillColor:[10,9,33] },
    })
    doc.save(`Salary_Report_${filterMonth}_${filterYear}.pdf`)
  }

  if (loading) return <div className="loading-center"><div className="spinner" /><div className="loading-text">LOADING PAYROLL…</div></div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <h1 className="page-title">💰 Payroll & Salary</h1>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--muted)', marginTop:2 }}>
            {records.length} records · Total Net: {sar(totalNet)} · Gross: {sar(totalGross)}
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {su && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Generate Salary</button>}
          <button className="btn btn-secondary" onClick={exportXLSX}>📊 Excel</button>
          <button className="btn btn-secondary" onClick={exportPDF}>📄 PDF</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom:'1rem' }}>
        {[
          { label:'Total Records', value:filtered.length, color:'#4f8cff', prefix:'' },
          { label:'Gross Payroll', value:totalGross, color:'#00ffb3', prefix:'SAR ' },
          { label:'Net Payroll', value:totalNet, color:'#00ffb3', prefix:'SAR ' },
          { label:'Paid', value:filtered.filter(r=>r.status==='paid').length, color:'#00ffb3', prefix:'' },
          { label:'Pending', value:filtered.filter(r=>r.status==='pending').length, color:'#ffe135', prefix:'' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{'--accent':s.color} as React.CSSProperties}>
            <div className="glow-dot" />
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.58rem', color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.4rem' }}>{s.label}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:'1.1rem', fontWeight:700, color:s.color }}>{s.prefix}{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
        <select className="input" style={{ maxWidth:140 }} value={filterMonth} onChange={e=>setFilterMonth(Number(e.target.value))}>
          {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
        </select>
        <input type="number" className="input" style={{ maxWidth:100 }} value={filterYear} onChange={e=>setFilterYear(Number(e.target.value))} min={2020} max={2030} />
        <select className="input" style={{ maxWidth:160 }} value={filterDept} onChange={e=>setFilterDept(e.target.value)}>
          <option value="all">All Departments</option>
          {depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="input" style={{ maxWidth:130 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="search-wrap" style={{ flex:1, minWidth:180 }}>
          <input className="search-input" placeholder="Search name, ID…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="glass table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Period</th>
              <th style={{ textAlign:'right' }}>Gross</th>
              <th style={{ textAlign:'right' }}>Deductions</th>
              <th style={{ textAlign:'right' }}>Net Salary</th>
              <th>Payment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', color:'var(--muted)', padding:'3rem' }}>
                No salary records for this period. Generate salaries using the button above.
              </td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id} className="clickable-row" onClick={() => setSelected(r)}>
                <td>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{r.worker_name}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:'0.65rem', color:'var(--cyan)' }}>{r.employee_id}</div>
                </td>
                <td style={{ color:'var(--text2)', fontSize:'0.85rem' }}>{r.department}</td>
                <td style={{ fontFamily:'var(--font-mono)', fontSize:'0.75rem', color:'var(--text2)' }}>
                  {MONTHS[r.period_month-1].slice(0,3)} {r.period_year}
                </td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.82rem', color:'var(--green)' }}>{sar(r.gross_salary)}</td>
                <td style={{ textAlign:'right', fontFamily:'var(--font-mono)', fontSize:'0.82rem', color:'var(--rose)' }}>-{sar(r.deductions + r.gosi_employee)}</td>
                <td style={{ textAlign:'right' }}>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.9rem', fontWeight:700, color:'var(--green)' }}>{sar(r.net_salary)}</span>
                </td>
                <td style={{ color:'var(--text2)', fontSize:'0.82rem' }}>{r.payment_method.replace('_',' ')}</td>
                <td><span className={`badge badge-${r.status === 'paid' ? 'approved' : r.status === 'pending' ? 'pending' : 'hold'}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <SlipModal rec={selected} su={su} onClose={() => setSelected(null)} onPaid={(id) => { setRecords(p => p.map(r => r.id===id ? {...r, status:'paid'} : r)); setSelected(null) }} />}
      {showForm && <SalaryForm workers={workers} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); load() }} />}
    </div>
  )
}
