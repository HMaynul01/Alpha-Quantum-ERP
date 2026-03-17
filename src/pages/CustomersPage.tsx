// src/pages/CustomersPage.tsx — Alpha Ultimate ERP v13
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../lib/AuthContext'
import { api } from '../lib/api'

interface Customer {
  id: string; customer_number: string; company_name: string; contact_name: string
  email: string; phone: string; address: string; city: string; country: string
  vat_number: string; cr_number: string; industry: string
  customer_type: 'business' | 'individual' | 'government'
  status: 'active' | 'inactive' | 'prospect'; notes: string; created_at: string
}

const EMPTY: Partial<Customer> = { company_name:'', contact_name:'', email:'', phone:'', address:'', city:'', country:'Saudi Arabia', vat_number:'', cr_number:'', industry:'', customer_type:'business', status:'active', notes:'' }

export default function CustomersPage() {
  const { user } = useAuth()
  const su = user?.role === 'superuser'
  const canEdit = su || user?.permissions?.crm === 'full_control'

  const [rows, setRows] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Customer>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusF) params.set('status', statusF)
      const d = await api.get<{ customers: Customer[]; total: number }>(`/customers?${params}`)
      setRows(d.customers); setTotal(d.total)
    } catch { setRows([]) }
    setLoading(false)
  }, [search, statusF])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setError('')
    try {
      if (form.id) { await api.put('/customers', form) }
      else { await api.post('/customers', form) }
      setModal(false); load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('Delete this customer?')) return
    try { await api.delete(`/customers`); load() } catch (e: any) { alert(e.message) }
  }

  const typeColor = (t: string) => t === 'government' ? '#4f8cff' : t === 'individual' ? '#00ffb3' : '#ffe135'
  const statusColor = (s: string) => s === 'active' ? '#00ffb3' : s === 'prospect' ? '#4f8cff' : '#666'

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">Total: {total} customers</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setModal(true) }}>
            + New Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem', padding:'1rem' }}>
        <input className="input" placeholder="Search company, contact, email…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:200 }} />
        <select className="select" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--text2)' }}>No customers found</div>
      ) : (
        <div className="card">
          <div style={{ overflowX:'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th><th>Company</th><th>Contact</th><th>Phone</th>
                  <th>Type</th><th>Status</th><th>City</th>{canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:'.8rem', color:'var(--accent)' }}>{r.customer_number}</td>
                    <td style={{ fontWeight:600 }}>{r.company_name}</td>
                    <td>{r.contact_name || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td><span className="badge" style={{ background: typeColor(r.customer_type)+'22', color: typeColor(r.customer_type), border:`1px solid ${typeColor(r.customer_type)}44` }}>{r.customer_type}</span></td>
                    <td><span className="badge" style={{ background: statusColor(r.status)+'22', color: statusColor(r.status) }}>{r.status}</span></td>
                    <td>{r.city || '—'}</td>
                    {canEdit && (
                      <td>
                        <button className="btn btn-sm" onClick={() => { setForm({...r}); setModal(true) }}>Edit</button>
                        {su && <button className="btn btn-sm btn-danger" style={{ marginLeft:4 }} onClick={() => del(r.id)}>Del</button>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:640, width:'95vw' }}>
            <div className="modal-header">
              <h2>{form.id ? 'Edit Customer' : 'New Customer'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="grid-2">
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Company Name *</label>
                <input className="input" value={form.company_name||''} onChange={e => setForm(f=>({...f,company_name:e.target.value}))} />
              </div>
              <div>
                <label className="label">Contact Name</label>
                <input className="input" value={form.contact_name||''} onChange={e => setForm(f=>({...f,contact_name:e.target.value}))} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone||''} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email||''} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.city||''} onChange={e => setForm(f=>({...f,city:e.target.value}))} />
              </div>
              <div>
                <label className="label">VAT Number</label>
                <input className="input" value={form.vat_number||''} onChange={e => setForm(f=>({...f,vat_number:e.target.value}))} />
              </div>
              <div>
                <label className="label">CR Number</label>
                <input className="input" value={form.cr_number||''} onChange={e => setForm(f=>({...f,cr_number:e.target.value}))} />
              </div>
              <div>
                <label className="label">Industry</label>
                <input className="input" value={form.industry||''} onChange={e => setForm(f=>({...f,industry:e.target.value}))} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="select" value={form.customer_type||'business'} onChange={e => setForm(f=>({...f,customer_type:e.target.value as any}))}>
                  <option value="business">Business</option>
                  <option value="individual">Individual</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={form.status||'active'} onChange={e => setForm(f=>({...f,status:e.target.value as any}))}>
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Address</label>
                <input className="input" value={form.address||''} onChange={e => setForm(f=>({...f,address:e.target.value}))} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Notes</label>
                <textarea className="textarea" rows={2} value={form.notes||''} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            {error && <div className="error-box" style={{ margin:'0 1.5rem' }}>{error}</div>}
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
