// src/pages/SettingsPage.tsx — Alpha Quantum ERP v16
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

type Tab = 'Company' | 'Finance' | 'Notifications' | 'Security' | 'Theme'
const TABS: Tab[] = ['Company', 'Finance', 'Notifications', 'Security', 'Theme']

export default function SettingsPage() {
  const { user }               = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab]           = useState<Tab>('Company')
  const [settings, setSettings] = useState<Record<string,unknown>>({})
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [err, setErr]           = useState('')

  const [curPass, setCurPass]     = useState('')
  const [newPass, setNewPass]     = useState('')
  const [confPass, setConfPass]   = useState('')
  const [passMsg, setPassMsg]     = useState('')
  const [passErr, setPassErr]     = useState('')
  const [changingPass, setChanging] = useState(false)

  const isSu = ['creator','cube_admin','superuser'].includes(user?.role || '')

  useEffect(() => {
    api.get<{ settings: Record<string,unknown> }>('/settings')
      .then(d => setSettings(d.settings || {}))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function set(key: string, val: unknown) {
    setSettings(s => ({ ...s, [key]: val }))
  }

  async function save() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const entries = Object.entries(settings)
      await Promise.all(entries.map(([key, value]) =>
        api.post('/settings', { key, value })
      ))
      setMsg('Settings saved successfully ✓')
    } catch(e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function changePassword() {
    if (!newPass || !confPass || !curPass) { setPassErr('All password fields required'); return }
    if (newPass !== confPass) { setPassErr('New passwords do not match'); return }
    if (newPass.length < 8)   { setPassErr('Password must be at least 8 characters'); return }
    setChanging(true); setPassErr(''); setPassMsg('')
    try {
      await api.post('/users/change-password', { current_password: curPass, new_password: newPass })
      setPassMsg('Password changed successfully ✓')
      setCurPass(''); setNewPass(''); setConfPass('')
    } catch(e: unknown) {
      setPassErr(e instanceof Error ? e.message : 'Failed to change password')
    } finally { setChanging(false) }
  }

  const inp = (key: string, label: string, type = 'text', placeholder = '') => (
    <div className="form-row">
      <label className="label">{label}</label>
      <input className="input" type={type} placeholder={placeholder}
        value={String(settings[key] || '')}
        onChange={e => set(key, e.target.value)} />
    </div>
  )

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Configure your workspace</p>
        </div>
        {isSu && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Saving…</> : '💾 Save Settings'}
          </button>
        )}
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {/* Tabs */}
      <div style={{ display:'flex', gap:'.4rem', marginBottom:'1.5rem', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t} className={`btn btn-sm ${tab===t?'btn-primary':'btn-secondary'}`}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ maxWidth:680 }}>
        {tab === 'Company' && (
          <div>
            <div className="card-title" style={{ marginBottom:'1.25rem' }}>Company Information</div>
            {inp('company_name',    'Company Name',    'text', 'Alpha Ultimate Ltd.')}
            {inp('company_cr',      'CR Number',       'text', '1234567890')}
            {inp('company_vat',     'VAT Number',      'text', '300xxxxxxxxx1003')}
            {inp('company_address', 'Address',         'text', 'Riyadh, Saudi Arabia')}
            {inp('company_phone',   'Phone',           'tel',  '+966 5x xxx xxxx')}
            {inp('company_email',   'Email',           'email','info@alpha-01.info')}
            {inp('company_website', 'Website',         'url',  'https://alpha-01.info')}
          </div>
        )}

        {tab === 'Finance' && (
          <div>
            <div className="card-title" style={{ marginBottom:'1.25rem' }}>Finance Settings</div>
            <div className="form-row">
              <label className="label">Default Currency</label>
              <select className="input" value={String(settings.currency||'SAR')} onChange={e=>set('currency',e.target.value)}>
                {['SAR','USD','EUR','GBP','AED'].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            {inp('vat_rate',       'Default VAT Rate (%)', 'number', '15')}
            {inp('fiscal_year',    'Fiscal Year Start',    'text',   'January')}
            {inp('invoice_prefix', 'Invoice Prefix',       'text',   'INV')}
            {inp('expense_prefix', 'Expense Prefix',       'text',   'EXP')}
            {inp('payment_terms',  'Default Payment Terms','text',   'Net 30')}
          </div>
        )}

        {tab === 'Notifications' && (
          <div>
            <div className="card-title" style={{ marginBottom:'1.25rem' }}>Notification Settings</div>
            <div className="alert alert-info" style={{ marginBottom:'1.25rem' }}>
              Configure IONOS SMTP settings in your environment variables.<br/>
              SMTP: smtp.ionos.com:587 · From: erp@alpha-01.info · Reply-To: reply@alpha-01.info
            </div>
            {inp('notif_email_on_approve', 'Send email on approval', 'text', 'true')}
            {inp('notif_email_on_reject',  'Send email on rejection','text', 'true')}
            {inp('notif_whatsapp_enabled', 'WhatsApp notifications', 'text', 'false')}
            <div className="form-row">
              <label className="label">WhatsApp on Approval</label>
              <select className="input" value={String(settings.wa_on_approve||'false')} onChange={e=>set('wa_on_approve',e.target.value)}>
                <option value="true">Enabled</option><option value="false">Disabled</option>
              </select>
            </div>
          </div>
        )}

        {tab === 'Security' && (
          <div>
            <div className="card-title" style={{ marginBottom:'1.25rem' }}>Change Password</div>
            {passMsg && <div className="alert alert-success">{passMsg}</div>}
            {passErr && <div className="alert alert-error">{passErr}</div>}
            <div className="form-row">
              <label className="label">Current Password</label>
              <input className="input" type="password" value={curPass}
                onChange={e=>setCurPass(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-row">
              <label className="label">New Password</label>
              <input className="input" type="password" value={newPass}
                onChange={e=>setNewPass(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div className="form-row">
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={confPass}
                onChange={e=>setConfPass(e.target.value)} placeholder="Repeat new password" />
            </div>
            <button className="btn btn-primary" onClick={changePassword} disabled={changingPass}>
              {changingPass ? <><div className="spinner" style={{width:14,height:14,borderWidth:2}}/> Updating…</> : '🔒 Change Password'}
            </button>
          </div>
        )}

        {tab === 'Theme' && (
          <div>
            <div className="card-title" style={{ marginBottom:'1.25rem' }}>Appearance</div>
            <div style={{ display:'flex', gap:'1rem', marginBottom:'1.5rem' }}>
              {['dark','light'].map(t => (
                <button key={t} onClick={toggleTheme}
                  style={{ flex:1, padding:'1rem', background:theme===t?'var(--blue-d)':'var(--hover-bg)', border:`2px solid ${theme===t?'var(--blue)':'var(--border2)'}`, borderRadius:'var(--radius-lg)', cursor:'pointer', color:theme===t?'var(--blue)':'var(--text2)', fontWeight:600, fontSize:'.9rem' }}>
                  {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  {theme === t && ' ✓'}
                </button>
              ))}
            </div>
            <div className="alert alert-info">Theme preference is saved locally in your browser.</div>
          </div>
        )}
      </div>
    </div>
  )
}
