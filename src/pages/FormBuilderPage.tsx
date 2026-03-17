// src/pages/FormBuilderPage.tsx — Alpha Quantum ERP v16
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'

interface FieldDef {
  id: string; type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox'
  label: string; placeholder?: string; required: boolean; options?: string[]
}
interface Form {
  id: string; name: string; description: string; fields: FieldDef[]
  created_at: string; created_by: string
}

const FIELD_TYPES = [
  { value:'text',     label:'Text Input',     icon:'T' },
  { value:'number',   label:'Number',         icon:'#' },
  { value:'date',     label:'Date',           icon:'📅' },
  { value:'select',   label:'Dropdown',       icon:'▼' },
  { value:'textarea', label:'Text Area',      icon:'¶' },
  { value:'checkbox', label:'Checkbox',       icon:'☑' },
]

let fieldCounter = 0
function newField(): FieldDef {
  return { id: String(++fieldCounter), type:'text', label:'', placeholder:'', required:false }
}

export default function FormBuilderPage() {
  const { user } = useAuth()
  const isSu = ['creator','cube_admin','superuser'].includes(user?.role || '')

  const [forms,    setForms]    = useState<Form[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Form | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [err,      setErr]      = useState('')
  const [msg,      setMsg]      = useState('')
  const [saving,   setSaving]   = useState(false)

  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [fields,   setFields]   = useState<FieldDef[]>([newField()])

  function load() {
    setLoading(true)
    api.get<{ forms: Form[] }>('/forms')
      .then(d => setForms(d.forms || []))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function addField() { setFields(f => [...f, newField()]) }
  function removeField(id: string) { setFields(f => f.filter(x => x.id !== id)) }
  function updateField(id: string, updates: Partial<FieldDef>) {
    setFields(f => f.map(x => x.id === id ? {...x, ...updates} : x))
  }

  async function saveForm() {
    if (!formName.trim()) { setErr('Form name required'); return }
    if (fields.some(f => !f.label.trim())) { setErr('All fields need labels'); return }
    setSaving(true); setErr(''); setMsg('')
    try {
      if (editing && selected) {
        await api.post('/forms/update', { id: selected.id, name: formName, description: formDesc, fields })
        setMsg('Form updated ✓')
      } else {
        await api.post('/forms', { name: formName, description: formDesc, fields })
        setMsg('Form created ✓')
      }
      setFormName(''); setFormDesc(''); setFields([newField()]); setEditing(false); setSelected(null)
      load()
    } catch(e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  function startEdit(form: Form) {
    setFormName(form.name); setFormDesc(form.description || '')
    setFields(form.fields && form.fields.length > 0 ? form.fields : [newField()])
    setEditing(true); setSelected(form); setErr(''); setMsg('')
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Form Builder</h1>
          <p className="page-sub">Create custom data entry forms</p>
        </div>
        {isSu && !editing && (
          <button className="btn btn-primary" onClick={() => { setEditing(true); setSelected(null); setFormName(''); setFormDesc(''); setFields([newField()]) }}>
            + New Form
          </button>
        )}
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="grid-sidebar">
        {/* Form list */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:'2rem' }}><div className="spinner"/></div>
          ) : forms.length === 0 ? (
            <div className="empty-state" style={{ padding:'2rem' }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">No Forms Yet</div>
              {isSu && <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>Create First Form</button>}
            </div>
          ) : (
            forms.map(f => (
              <div key={f.id}
                style={{ padding:'.85rem 1rem', borderBottom:'1px solid var(--border)', cursor:'pointer', background:selected?.id===f.id?'var(--blue-d)':'transparent' }}
                onClick={() => { setSelected(f); setEditing(false) }}>
                <div style={{ fontWeight:600, fontSize:'.86rem', color:'var(--text)', marginBottom:'.2rem' }}>{f.name}</div>
                <div style={{ fontSize:'.75rem', color:'var(--text3)' }}>{f.fields?.length || 0} fields · {new Date(f.created_at).toLocaleDateString('en-GB')}</div>
                {f.description && <div style={{ fontSize:'.78rem', color:'var(--text2)', marginTop:'.2rem' }}>{f.description}</div>}
              </div>
            ))
          )}
        </div>

        {/* Builder / detail */}
        {editing ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">{editing && selected ? 'Edit Form' : 'New Form'}</div>
              <button className="modal-close" onClick={() => { setEditing(false); setSelected(null) }}>✕</button>
            </div>

            <div className="form-row">
              <label className="label">Form Name *</label>
              <input className="input" value={formName} onChange={e=>setFormName(e.target.value)} placeholder="e.g. Site Inspection Form" />
            </div>
            <div className="form-row">
              <label className="label">Description</label>
              <input className="input" value={formDesc} onChange={e=>setFormDesc(e.target.value)} placeholder="Optional description" />
            </div>

            <div className="sep" />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
              <div className="section-label">Fields ({fields.length})</div>
              <button className="btn btn-secondary btn-sm" onClick={addField}>+ Add Field</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
              {fields.map((field, idx) => (
                <div key={field.id} style={{ padding:'.9rem', background:'var(--hover-bg)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', gap:'.5rem', marginBottom:'.6rem', alignItems:'center' }}>
                    <span style={{ fontFamily:'var(--font-mono)', fontSize:'.7rem', color:'var(--text3)', minWidth:20 }}>{idx+1}.</span>
                    <input className="input" style={{ flex:1 }} placeholder="Field label *"
                      value={field.label} onChange={e => updateField(field.id, { label: e.target.value })} />
                    <select className="input" style={{ width:140 }} value={field.type}
                      onChange={e => updateField(field.id, { type: e.target.value as FieldDef['type'] })}>
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button className="btn btn-danger btn-sm" onClick={() => removeField(field.id)} disabled={fields.length <= 1}>✕</button>
                  </div>
                  <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
                    {field.type !== 'checkbox' && (
                      <input className="input" style={{ flex:1 }} placeholder="Placeholder text"
                        value={field.placeholder || ''} onChange={e => updateField(field.id, { placeholder: e.target.value })} />
                    )}
                    {field.type === 'select' && (
                      <input className="input" style={{ flex:1 }} placeholder="Options (comma-separated)"
                        value={(field.options || []).join(',')} onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s=>s.trim()) })} />
                    )}
                    <label style={{ display:'flex', alignItems:'center', gap:'.35rem', fontSize:'.82rem', color:'var(--text2)', cursor:'pointer', whiteSpace:'nowrap' }}>
                      <input type="checkbox" checked={field.required}
                        onChange={e => updateField(field.id, { required: e.target.checked })} />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:'flex', gap:'.6rem', marginTop:'1.25rem' }}>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Form'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setSelected(null) }}>Cancel</button>
            </div>
          </div>
        ) : selected ? (
          <div className="card">
            <div className="card-header">
              <div className="card-title">{selected.name}</div>
              <div style={{ display:'flex', gap:'.5rem' }}>
                {isSu && <button className="btn btn-secondary btn-sm" onClick={() => startEdit(selected)}>✏️ Edit</button>}
                <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
              </div>
            </div>
            {selected.description && <p style={{ fontSize:'.84rem', color:'var(--text2)', marginBottom:'1rem' }}>{selected.description}</p>}
            <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
              {(selected.fields || []).map((f, i) => (
                <div key={f.id} style={{ padding:'.75rem', background:'var(--hover-bg)', borderRadius:'var(--radius)', display:'flex', justifyContent:'space-between' }}>
                  <div>
                    <span style={{ fontWeight:600, fontSize:'.85rem', color:'var(--text)' }}>{f.label}</span>
                    {f.required && <span style={{ color:'var(--rose)', marginLeft:'.3rem', fontSize:'.7rem' }}>*</span>}
                    {f.placeholder && <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:'.15rem' }}>Placeholder: {f.placeholder}</div>}
                    {f.type === 'select' && f.options && (
                      <div style={{ fontSize:'.75rem', color:'var(--text3)', marginTop:'.1rem' }}>Options: {f.options.join(', ')}</div>
                    )}
                  </div>
                  <span className="chip chip-blue" style={{ alignSelf:'flex-start' }}>{f.type}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state card">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Select a Form</div>
            <div className="empty-desc">Click a form to view or edit it</div>
          </div>
        )}
      </div>
    </div>
  )
}
