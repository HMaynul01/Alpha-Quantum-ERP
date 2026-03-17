// src/pages/SettingsPage.tsx — v18 Fixed
import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'

type Tab = 'Company' | 'Finance' | 'Notifications' | 'Security' | 'Theme'

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [tab, setTab]     = useState<Tab>('Company')
  const [s, setS]         = useState<Record<string, string>>({})
  const [loading, setL]   = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]     = useState('')
  const [err, setErr]     = useState('')
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confPw, setConfPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  const isSu = ['creator', 'cube_admin', 'superuser'].includes(user?.role || '')

  useEffect(() => {
    api.get<{ settings: Record<string, unknown> }>('/settings')
      .then(d => {
        // Unwrap JSONB values (they come back as JS values, convert to strings for form)
        const flat: Record<string, string> = {}
        Object.entries(d.settings || {}).forEach(([k, v]) => {
          flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
        })
        setS(flat)
      })
      .catch(() => {})
      .finally(() => setL(false))
  }, [])

  function set(key: string, val: string) { setS(p => ({ ...p, [key]: val })) }
  function g(key: string, def = '') { return s[key] ?? def }

  async function save() {
    setSaving(true); setMsg(''); setErr('')
    try {
      const toSave = Object.entries(s).filter(([, v]) => v !== undefined && v !== '')
      await Promise.all(toSave.map(([key, value]) =>
        api.post('/settings', { key, value })
      ))
      setMsg('✓ Settings saved')
      setTimeout(() => setMsg(''), 3000)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  async function changePw() {
    if (!curPw || !newPw || !confPw) { setPwErr('All fields required'); return }
    if (newPw !== confPw) { setPwErr('Passwords do not match'); return }
    if (newPw.length < 8) { setPwErr('Minimum 8 characters'); return }
    setSavingPw(true); setPwErr(''); setPwMsg('')
    try {
      await api.post('/users/change-password', { current_password: curPw, new_password: newPw })
      setPwMsg('✓ Password changed'); setCurPw(''); setNewPw(''); setConfPw('')
      setTimeout(() => setPwMsg(''), 3000)
    } catch (e: unknown) { setPwErr(e instanceof Error ? e.message : 'Failed') }
    setSavingPw(false)
  }

  const Field = ({ k, label, type = 'text', ph = '' }: { k: string; label: string; type?: string; ph?: string }) => (
    <div style={{ marginBottom: '.85rem' }}>
      <label className="label">{label}</label>
      <input className="input" type={type} placeholder={ph} value={g(k)} onChange={e => set(k, e.target.value)} disabled={!isSu} />
    </div>
  )

  const SelectField = ({ k, label, options }: { k: string; label: string; options: string[] }) => (
    <div style={{ marginBottom: '.85rem' }}>
      <label className="label">{label}</label>
      <select className="input" value={g(k)} onChange={e => set(k, e.target.value)} disabled={!isSu}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  if (loading) return <div className="loading-full"><div className="spinner" /></div>

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Configure your workspace</p>
        </div>
        {isSu && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? '⟳ Saving…' : '💾 Save Settings'}
          </button>
        )}
      </div>

      {msg && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{msg}</div>}
      {err && <div className="alert alert-error"   style={{ marginBottom: '1rem' }}>⚠️ {err}</div>}

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: '1.25rem' }}>
        {(['Company','Finance','Notifications','Security','Theme'] as Tab[]).map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="card">
        {/* ── COMPANY ─────────────────────────────────────── */}
        {tab === 'Company' && (
          <div>
            <div className="card-title">Company Information</div>
            <Field k="company_name"    label="Company Name"    ph="Alpha Ultimate Ltd" />
            <Field k="company_cr"      label="CR Number"       ph="1234567890" />
            <Field k="company_vat"     label="VAT Number"      ph="300xxxxxxxxx1003" />
            <Field k="company_address" label="Address"         ph="Riyadh, KSA" />
            <Field k="company_phone"   label="Phone"           ph="+966 5x xxx xxxx" />
            <Field k="company_email"   label="Email"           ph="info@company.com" />
            <Field k="company_website" label="Website"         ph="https://company.com" />
          </div>
        )}

        {/* ── FINANCE ─────────────────────────────────────── */}
        {tab === 'Finance' && (
          <div>
            <div className="card-title">Finance Settings</div>
            <SelectField k="currency"       label="Default Currency"    options={['SAR','USD','EUR','GBP','AED','KWD','BHD','OMR','QAR']} />
            <Field       k="vat_rate"       label="Default VAT Rate (%)" type="number" ph="15" />
            <SelectField k="fiscal_year_start" label="Fiscal Year Start" options={['January','April','July','October']} />
            <Field       k="invoice_prefix" label="Invoice Prefix"      ph="INV" />
            <Field       k="expense_prefix" label="Expense Prefix"      ph="EXP" />
            <Field       k="payment_terms"  label="Default Payment Terms" ph="Net 30" />
          </div>
        )}

        {/* ── NOTIFICATIONS ───────────────────────────────── */}
        {tab === 'Notifications' && (
          <div>
            <div className="card-title">Notification Settings</div>
            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              Configure IONOS SMTP settings in your environment variables.<br />
              SMTP: smtp.ionos.com:587 · From: erp@alpha-01.info · Reply-To: reply@alpha-01.info
            </div>
            <SelectField k="email_on_approval"  label="Send email on approval"  options={['true','false']} />
            <SelectField k="email_on_rejection" label="Send email on rejection" options={['true','false']} />
            <SelectField k="whatsapp_enabled"   label="WhatsApp notifications"  options={['false','true']} />
            <SelectField k="whatsapp_on_approval" label="WhatsApp on Approval"  options={['Enabled','Disabled']} />
          </div>
        )}

        {/* ── SECURITY ────────────────────────────────────── */}
        {tab === 'Security' && (
          <div>
            <div className="card-title">Change Password</div>
            {pwMsg && <div className="alert alert-success" style={{ marginBottom: '.85rem' }}>{pwMsg}</div>}
            {pwErr && <div className="alert alert-error"   style={{ marginBottom: '.85rem' }}>⚠️ {pwErr}</div>}
            <div style={{ marginBottom: '.85rem' }}>
              <label className="label">Current Password</label>
              <input className="input" type="password" value={curPw} onChange={e => setCurPw(e.target.value)} />
            </div>
            <div style={{ marginBottom: '.85rem' }}>
              <label className="label">New Password</label>
              <input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div style={{ marginBottom: '1.1rem' }}>
              <label className="label">Confirm New Password</label>
              <input className="input" type="password" value={confPw} onChange={e => setConfPw(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-full" onClick={changePw} disabled={savingPw}>
              {savingPw ? '⟳ Changing…' : '🔐 Change Password'}
            </button>
          </div>
        )}

        {/* ── THEME ───────────────────────────────────────── */}
        {tab === 'Theme' && (
          <div>
            <div className="card-title">Appearance</div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label">Current Theme</label>
              <div style={{ display: 'flex', gap: '.75rem', marginTop: '.5rem' }}>
                {['dark', 'light'].map(t => (
                  <button key={t} onClick={toggleTheme}
                    style={{ flex: 1, padding: '.75rem', borderRadius: 'var(--radius-lg)', border: `2px solid ${theme === t ? 'var(--blue)' : 'var(--border2)'}`, background: t === 'dark' ? '#050810' : '#f1f5fb', color: t === 'dark' ? '#eef2ff' : '#0d1526', cursor: 'pointer', fontWeight: theme === t ? 700 : 400, fontSize: '.88rem' }}>
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                    {theme === t && ' ✓'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '1rem', background: 'var(--hover-bg)', borderRadius: 'var(--radius-lg)', fontSize: '.84rem', color: 'var(--text2)' }}>
              Theme preference is saved locally in your browser.
            </div>
          </div>
        )}
      </div>

      {/* Save button at bottom too */}
      {isSu && tab !== 'Security' && tab !== 'Theme' && (
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-primary btn-full btn-lg" onClick={save} disabled={saving}>
            {saving ? '⟳ Saving…' : '💾 Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
