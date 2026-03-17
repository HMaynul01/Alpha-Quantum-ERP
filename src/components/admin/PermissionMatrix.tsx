// src/components/admin/PermissionMatrix.tsx
// Alpha Ultimate ERP — Granular Permission Matrix
// Super Users can assign per-user, per-module access levels:
//   none | view_only | submit_only | superuser
// Renders a full matrix grid with badge toggles, descriptions,
// save/reset controls, and live permission previews.

import { useState, useEffect, useCallback } from 'react'
import { useAuth }          from '../../lib/AuthContext'
import { isSuperUser }      from '../../lib/auth'
import { api }              from '../../lib/api'
import logoUrl              from '../../assets/logo-alpha.png'
import type { PermLevel }   from '../../lib/auth'

// ── Types ─────────────────────────────────────────────────────
interface UserRow {
  id:         string
  username:   string
  full_name:  string
  email:      string
  role:       string
  department: string | null
  is_active:  boolean
}

interface PermEntry {
  module:       string
  access_level: PermLevel
}

// ── Module definitions ────────────────────────────────────────
const MODULES: {
  key:   string
  label: string
  icon:  string
  desc:  string
  group: string
}[] = [
  // Finance
  { key: 'finance',     label: 'Finance',      icon: '◈', group: 'Core',
    desc: 'Expense forms, invoices, and all financial records' },
  { key: 'approvals',   label: 'Approvals',    icon: '✦', group: 'Core',
    desc: 'Approve, reject, or hold pending submissions' },
  { key: 'reports',     label: 'Reports',      icon: '▤', group: 'Core',
    desc: 'Export PDF, XLSX, and DOCX financial reports' },
  // People
  { key: 'users',       label: 'Users',        icon: '⊞', group: 'Admin',
    desc: 'Create, edit, and deactivate user accounts' },
  { key: 'settings',    label: 'Settings',     icon: '⚙', group: 'Admin',
    desc: 'System configuration, branding, and tax rules' },
  // Operations
  { key: 'bookings',    label: 'Bookings',     icon: '◧', group: 'Operations',
    desc: 'Project and job booking management' },
  { key: 'assets',      label: 'Assets',       icon: '◉', group: 'Operations',
    desc: 'Asset register, depreciation, and maintenance' },
  { key: 'liabilities', label: 'Liabilities',  icon: '◎', group: 'Operations',
    desc: 'Loans, supplier credits, and payment schedules' },
  { key: 'investments', label: 'Investments',  icon: '◆', group: 'Operations',
    desc: 'Investment portfolio and cash flow tracking' },
  // Media / Content
  { key: 'media',       label: 'Media',        icon: '⬡', group: 'Content',
    desc: 'Upload and manage files, receipts, and documents' },
  { key: 'content',     label: 'Content',      icon: '▣', group: 'Content',
    desc: 'Public-facing pages and communications' },
]

const GROUPS = ['Core', 'Admin', 'Operations', 'Content']

// ── Level definitions ─────────────────────────────────────────
const LEVELS: {
  value:   PermLevel
  label:   string
  short:   string
  color:   string
  bg:      string
  border:  string
  desc:    string
}[] = [
  {
    value: 'none', label: 'No Access', short: 'NONE',
    color: 'var(--muted)', bg: 'rgba(74,69,128,0.06)',
    border: 'rgba(74,69,128,0.2)',
    desc: 'Module is hidden. No data visible.',
  },
  {
    value: 'view_only', label: 'View Only', short: 'VIEW',
    color: 'var(--text2)', bg: 'rgba(139,134,200,0.1)',
    border: 'rgba(139,134,200,0.3)',
    desc: 'Can read records. No action buttons rendered.',
  },
  {
    value: 'submit_only', label: 'Submit Only', short: 'SUBMIT',
    color: 'var(--amber)', bg: 'rgba(255,225,53,0.1)',
    border: 'rgba(255,225,53,0.3)',
    desc: 'Can submit new records only. Cannot view history.',
  },
  {
    value: 'superuser', label: 'Superuser', short: 'SUPER',
    color: 'var(--cyan)', bg: 'rgba(0,212,255,0.1)',
    border: 'rgba(0,212,255,0.35)',
    desc: 'Full CRUD + Approval rights. Master override.',
  },
]

function levelDef(v: PermLevel) {
  return LEVELS.find(l => l.value === v) ?? LEVELS[0]
}

// ── Component ─────────────────────────────────────────────────
export default function PermissionMatrix() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [users,    setUsers]    = useState<UserRow[]>([])
  const [selUser,  setSelUser]  = useState<string>('')
  const [perms,    setPerms]    = useState<Record<string, PermLevel>>({})
  const [original, setOriginal] = useState<Record<string, PermLevel>>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')

  const isDirty = JSON.stringify(perms) !== JSON.stringify(original)

  // Load users
  useEffect(() => {
    if (!su) { setLoading(false); return }
    api.get<{ users: UserRow[] }>('/users')
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [su])

  // Load permissions when user selected
  const loadPerms = useCallback(async (userId: string) => {
    setMsg(''); setError('')
    try {
      const d = await api.get<{ permissions: PermEntry[] }>(`/permissions?userId=${userId}`)
      const map: Record<string, PermLevel> = {}
      d.permissions.forEach(p => { map[p.module] = p.access_level })
      MODULES.forEach(m => { if (!map[m.key]) map[m.key] = 'none' })
      setPerms({ ...map })
      setOriginal({ ...map })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load permissions.')
    }
  }, [])

  useEffect(() => {
    if (selUser) loadPerms(selUser)
  }, [selUser, loadPerms])

  function toggleLevel(moduleKey: string, level: PermLevel) {
    setMsg('')
    setPerms(p => ({ ...p, [moduleKey]: level }))
  }

  function setAllLevel(level: PermLevel) {
    const map: Record<string, PermLevel> = {}
    MODULES.forEach(m => { map[m.key] = level })
    setPerms(map)
  }

  function resetPerms() {
    setPerms({ ...original })
    setMsg('')
  }

  async function save() {
    setSaving(true); setMsg(''); setError('')
    try {
      await api.put('/permissions', { userId: selUser, permissions: perms })
      setOriginal({ ...perms })
      setMsg('Permissions saved successfully.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setSaving(false) }
  }

  // ── Filtered users for search ─────────────────────────────
  const filteredUsers = users.filter(u =>
    !search ||
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const selectedUserRow = users.find(u => u.id === selUser)

  // ── Guard ─────────────────────────────────────────────────
  if (!su) return (
    <div className="glass" style={{ padding: '2.5rem', textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⬡</div>
      <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '0.07em' }}>
        PERMISSION MANAGEMENT REQUIRES SUPERUSER PRIVILEGES
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <img src={logoUrl} alt="Alpha Ultimate" style={{ height: 34, width: 'auto', borderRadius: 6 }} />
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Permission Matrix</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text2)', letterSpacing: '0.07em' }}>
            GRANULAR FEATURE-BASED ACCESS CONTROL
          </div>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {msg   && <div className="alert-success">{msg}</div>}

      {/* ── Level Legend ── */}
      <div className="glass" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div className="section-label" style={{ marginBottom: '0.65rem' }}>Access Level Reference</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {LEVELS.map(lv => (
            <div key={lv.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                display: 'inline-block', padding: '0.12rem 0.55rem', borderRadius: 20,
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em',
                fontFamily: 'var(--font-mono)',
                color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`,
              }}>{lv.short}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{lv.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>Loading users…</div>
      ) : (
        <>
          {/* ── User Selector ── */}
          <div className="glass" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div className="section-label">Select User to Configure</div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 260px' }}>
                <label className="label" style={{ marginBottom: '0.3rem' }}>Search User</label>
                <input className="input" placeholder="Name, username, or email…"
                  value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 340 }} />
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label className="label" style={{ marginBottom: '0.3rem' }}>User</label>
                <select className="input" value={selUser}
                  onChange={e => { setSelUser(e.target.value) }}
                  style={{ maxWidth: 400 }}>
                  <option value="">— choose a user —</option>
                  {filteredUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.username}){!u.is_active ? ' [INACTIVE]' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selected user info card */}
            {selectedUserRow && (
              <div style={{
                marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.65rem 0.9rem',
                background: 'rgba(79,140,255,0.05)', border: '1px solid rgba(79,140,255,0.2)',
                borderRadius: 8, flexWrap: 'wrap',
              }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,rgba(79,140,255,0.3),rgba(191,95,255,0.3))',
                  border: '1px solid rgba(79,140,255,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '1rem', color: 'var(--blue)',
                }}>
                  {selectedUserRow.full_name[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                    {selectedUserRow.full_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                    {selectedUserRow.email} · {selectedUserRow.department ?? 'No department'}
                  </div>
                </div>
                <span style={{
                  marginLeft: 'auto', padding: '0.2rem 0.6rem', borderRadius: 20,
                  fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                  background: selectedUserRow.role === 'superuser' ? 'rgba(0,212,255,0.12)' : 'rgba(79,140,255,0.12)',
                  color:      selectedUserRow.role === 'superuser' ? 'var(--cyan)'      : 'var(--blue)',
                  border:     `1px solid ${selectedUserRow.role === 'superuser' ? 'rgba(0,212,255,0.3)' : 'rgba(79,140,255,0.3)'}`,
                }}>{selectedUserRow.role}</span>
              </div>
            )}
          </div>

          {/* ── Matrix Grid ── */}
          {selUser && (
            <div className="glass" style={{ padding: '1.25rem' }}>
              {/* Quick-set all */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div className="section-label" style={{ marginBottom: 0 }}>
                  Access Levels —
                  <span style={{ color: 'var(--text)', textTransform: 'none', letterSpacing: 0, marginLeft: '0.4rem', fontFamily: 'Rajdhani,sans-serif', fontSize: '0.9rem' }}>
                    {selectedUserRow?.full_name}
                  </span>
                  {isDirty && (
                    <span style={{
                      marginLeft: '0.6rem', fontSize: '0.62rem', padding: '0.08rem 0.4rem',
                      borderRadius: 12, background: 'rgba(255,225,53,0.12)',
                      border: '1px solid rgba(255,225,53,0.3)', color: 'var(--amber)',
                    }}>UNSAVED</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>QUICK SET ALL:</span>
                  {LEVELS.map(lv => (
                    <button key={lv.value} onClick={() => setAllLevel(lv.value)}
                      style={{
                        padding: '0.22rem 0.6rem', borderRadius: 20, cursor: 'pointer',
                        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em',
                        fontFamily: 'var(--font-mono)', transition: 'all 0.14s',
                        border: `1px solid ${lv.border}`,
                        background: lv.bg, color: lv.color,
                      }}>{lv.short}</button>
                  ))}
                </div>
              </div>

              {/* Per-group rows */}
              {GROUPS.map(group => {
                const groupModules = MODULES.filter(m => m.group === group)
                return (
                  <div key={group} style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                      fontSize: '0.62rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em',
                      color: 'var(--violet)', textTransform: 'uppercase', fontWeight: 700,
                      marginBottom: '0.6rem', paddingBottom: '0.35rem',
                      borderBottom: '1px solid rgba(191,95,255,0.2)',
                    }}>{group}</div>

                    {groupModules.map(mod => {
                      const current = perms[mod.key] ?? 'none'
                      const currentDef = levelDef(current)
                      return (
                        <div key={mod.key} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          marginBottom: '0.65rem', flexWrap: 'wrap',
                          padding: '0.5rem 0.6rem', borderRadius: 8,
                          background: current !== 'none' ? 'rgba(79,140,255,0.03)' : 'transparent',
                          border: `1px solid ${current !== 'none' ? 'rgba(79,140,255,0.12)' : 'transparent'}`,
                          transition: 'all 0.15s',
                        }}>
                          {/* Module identity */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 180, flex: '0 0 auto' }}>
                            <span style={{ fontSize: '0.95rem', width: 20, textAlign: 'center', flexShrink: 0, color: 'var(--text2)' }}>{mod.icon}</span>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.2 }}>{mod.label}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', lineHeight: 1.2 }}>{mod.desc}</div>
                            </div>
                          </div>

                          {/* Level toggles */}
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', flex: 1 }}>
                            {LEVELS.map(lv => {
                              const active = current === lv.value
                              return (
                                <button key={lv.value}
                                  onClick={() => toggleLevel(mod.key, lv.value)}
                                  title={lv.desc}
                                  style={{
                                    padding: '0.25rem 0.7rem', borderRadius: 20, cursor: 'pointer',
                                    fontSize: '0.72rem', fontWeight: active ? 700 : 400,
                                    letterSpacing: '0.05em', transition: 'all 0.14s',
                                    fontFamily: 'var(--font-mono)',
                                    border: `1px solid ${active ? lv.border : 'var(--border)'}`,
                                    background: active ? lv.bg : 'transparent',
                                    color: active ? lv.color : 'var(--muted)',
                                    boxShadow: active ? `0 0 10px ${lv.bg}` : 'none',
                                    transform: active ? 'scale(1.05)' : 'scale(1)',
                                  }}>{lv.short}</button>
                              )
                            })}
                          </div>

                          {/* Current badge */}
                          <span style={{
                            marginLeft: 'auto', flexShrink: 0,
                            padding: '0.15rem 0.55rem', borderRadius: 20,
                            fontSize: '0.62rem', fontWeight: 700,
                            fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
                            color: currentDef.color, background: currentDef.bg,
                            border: `1px solid ${currentDef.border}`,
                          }}>{currentDef.short}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Save / Reset */}
              <div style={{
                display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
                borderTop: '1px solid var(--border)', paddingTop: '1.1rem', marginTop: '0.5rem',
              }}>
                <button className="btn btn-primary" onClick={save} disabled={saving || !isDirty}>
                  {saving ? 'Saving…' : '✓ Save Permissions'}
                </button>
                <button className="btn btn-secondary" onClick={resetPerms} disabled={saving || !isDirty}>
                  Reset Changes
                </button>
                {!isDirty && msg && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    ✓ All changes saved
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
