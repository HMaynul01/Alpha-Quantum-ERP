// src/pages/ERPLayout.tsx — v18 Mobile Bottom Navigation
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useLang } from '../lib/LangContext'
import { useTheme } from '../lib/ThemeContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'
import { useEffect, useState, useCallback } from 'react'
import logoUrl from '../assets/logo-alpha.png'

interface NavItem { to: string; icon: string; label: string; perm?: string; su?: boolean; cubeAdmin?: boolean }
type NavSection = { title: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  { title: 'Finance', items: [
    { to: '/expenses',    icon: '💰', label: 'Expenses',    perm: 'expenses' },
    { to: '/invoices',    icon: '🧾', label: 'Invoices',    perm: 'finance' },
    { to: '/wallet',      icon: '💳', label: 'Wallet',      perm: 'finance' },
    { to: '/approvals',   icon: '✅', label: 'Approvals',   su: true },
    { to: '/budget',      icon: '📊', label: 'Budget',      perm: 'budget' },
  ]},
  { title: 'Assets', items: [
    { to: '/assets',      icon: '🏗️', label: 'Assets',      perm: 'assets' },
    { to: '/investments', icon: '📈', label: 'Investments', perm: 'investments' },
    { to: '/liabilities', icon: '🏦', label: 'Liabilities', perm: 'liabilities' },
  ]},
  { title: 'HR', items: [
    { to: '/workers',   icon: '👷', label: 'Employees',  perm: 'workers' },
    { to: '/timesheet', icon: '🕐', label: 'Timesheet',  perm: 'timesheet' },
    { to: '/salary',    icon: '💵', label: 'Payroll',    perm: 'salary' },
  ]},
  { title: 'CRM', items: [
    { to: '/crm/customers', icon: '🏢', label: 'Customers', perm: 'crm' },
    { to: '/crm/leads',     icon: '🎯', label: 'Leads',     perm: 'crm' },
  ]},
  { title: 'Projects', items: [
    { to: '/projects', icon: '📁', label: 'Projects', perm: 'projects' },
    { to: '/tasks',    icon: '✔️', label: 'Tasks',    perm: 'projects' },
  ]},
  { title: 'System', items: [
    { to: '/reports',              icon: '📋', label: 'Reports',      perm: 'reports' },
    { to: '/users',                icon: '👥', label: 'Users',        su: true },
    { to: '/permissions',          icon: '🔐', label: 'Permissions',  su: true },
    { to: '/form-builder',         icon: '🛠️', label: 'Form Builder', su: true },
    { to: '/subscription',         icon: '💎', label: 'Subscription', su: true },
    { to: '/cube-admin',           icon: '🧊', label: 'Cube Admin',   cubeAdmin: true },
    { to: '/settings',             icon: '⚙️', label: 'Settings' },
    { to: '/notifications/settings', icon: '🔔', label: 'Notifications' },
  ]},
]

// Bottom tabs for mobile — max 5
const BOTTOM_TABS = [
  { to: '/',         icon: '◈',  label: 'Dashboard' },
  { to: '/finance',  icon: '💰', label: 'Finance', group: true, key: 'finance' },
  { to: '/projects', icon: '📁', label: 'Projects', perm: 'projects' },
  { to: '/workers',  icon: '👷', label: 'HR',       perm: 'workers' },
  { to: '/more',     icon: '⋯',  label: 'More', group: true, key: 'more' },
]

export default function ERPLayout() {
  const { user, logout } = useAuth()
  const { lang, toggle } = useLang()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const su       = isSuperUser(user)
  const isAdmin  = ['creator','cube_admin','superuser'].includes(user?.role || '')

  const [unread,     setUnread]     = useState(0)
  const [sideOpen,   setSide]       = useState(false)
  const [userMenu,   setUserMenu]   = useState(false)
  const [drawerKey,  setDrawerKey]  = useState<'finance'|'more'|null>(null)

  const fetchUnread = useCallback(() => {
    api.get<{ unread: number }>('/notifications')
      .then(d => setUnread(d.unread ?? 0)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnread()
    const id = setInterval(fetchUnread, 30_000)
    return () => clearInterval(id)
  }, [fetchUnread])

  // Close drawer on route change
  useEffect(() => { setSide(false); setDrawerKey(null) }, [location.pathname])

  function canSee(item: NavItem) {
    if (item.cubeAdmin) return isAdmin
    if (item.su)        return su
    if (!item.perm)     return true
    const lv = user?.permissions?.[item.perm]
    return su || (!!lv && lv !== 'none')
  }

  const initials = user?.full_name
    ?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'AQ'

  const FinanceItems = SECTIONS.find(s => s.title === 'Finance')?.items.filter(canSee) || []
  const MoreSections = SECTIONS.filter(s => s.title !== 'Finance').map(s => ({ ...s, items: s.items.filter(canSee) })).filter(s => s.items.length)

  // ── Sidebar (desktop) ────────────────────────────────────────────────────
  const Sidebar = (
    <aside className={`erp-sidebar${sideOpen ? ' open' : ''}`}>
      <div className="sidebar-brand">
        <img src={logoUrl} alt="Alpha" style={{ width: 36, height: 36, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }}
          onError={e => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
        <div style={{ flex: 1 }}>
          <div className="sidebar-brand-name">ALPHA</div>
          <div className="sidebar-brand-sub">QUANTUM ERP</div>
        </div>
        <button onClick={() => setSide(false)} className="mobile-menu-btn" style={{ display: 'flex' }} aria-label="Close">✕</button>
      </div>

      {/* Dashboard quick link */}
      <div style={{ padding: '.5rem .4rem .25rem' }}>
        <NavLink to="/" end onClick={() => setSide(false)}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span className="nav-icon">◈</span><span>Dashboard</span>
        </NavLink>
      </div>

      <nav className="sidebar-nav">
        {SECTIONS.map(sec => {
          const visible = sec.items.filter(canSee)
          if (!visible.length) return null
          return (
            <div key={sec.title}>
              <div className="sidebar-section-title">{sec.title}</div>
              {visible.map(item => (
                <NavLink key={item.to} to={item.to} end={item.to === '/'}
                  onClick={() => setSide(false)}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          )
        })}
        {user?.role === 'creator' && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '.5rem', paddingTop: '.5rem' }}>
            <NavLink to="/creator" onClick={() => setSide(false)}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              style={{ color: 'var(--amber-bright)', fontWeight: 600 }}>
              <span className="nav-icon">👑</span><span>Creator Panel</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-user">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.6rem' }}>
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div className="user-avatar">{initials}</div>
          }
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ color: 'var(--text)', fontSize: '.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name}</div>
            <div style={{ color: 'var(--text3)', fontSize: '.69rem', textTransform: 'capitalize' }}>{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <button className="btn btn-ghost btn-sm" onClick={toggle}>{lang === 'en' ? 'AR' : 'EN'}</button>
          <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => { logout(); navigate('/login') }}>Sign Out</button>
        </div>
      </div>
    </aside>
  )

  // ── Mobile Bottom Drawer ─────────────────────────────────────────────────
  const BottomDrawer = drawerKey && (
    <div style={{ position: 'fixed', inset: 0, zIndex: 490 }} onClick={() => setDrawerKey(null)}>
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 60, left: 0, right: 0,
          background: 'var(--card)', borderTop: '1px solid var(--border2)',
          borderRadius: '20px 20px 0 0', padding: '1rem',
          maxHeight: '65dvh', overflowY: 'auto',
          animation: 'slideUp .2s ease-out' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border2)', borderRadius: 2, margin: '0 auto .85rem' }}/>
        {drawerKey === 'finance' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem' }}>
            {FinanceItems.map(item => (
              <button key={item.to} onClick={() => { navigate(item.to); setDrawerKey(null) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.35rem',
                  padding: '.75rem .5rem', background: location.pathname === item.to ? 'var(--blue-d)' : 'var(--hover-bg)',
                  border: `1px solid ${location.pathname === item.to ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer' }}>
                <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
                <span style={{ fontSize: '.72rem', color: location.pathname === item.to ? 'var(--blue-bright)' : 'var(--text2)', fontWeight: 500, textAlign: 'center' }}>{item.label}</span>
              </button>
            ))}
          </div>
        )}
        {drawerKey === 'more' && MoreSections.map(sec => (
          <div key={sec.title} style={{ marginBottom: '.75rem' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '.35rem' }}>{sec.title}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.4rem' }}>
              {sec.items.map(item => (
                <button key={item.to} onClick={() => { navigate(item.to); setDrawerKey(null) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem',
                    padding: '.65rem .4rem', background: location.pathname === item.to ? 'var(--blue-d)' : 'var(--hover-bg)',
                    border: `1px solid ${location.pathname === item.to ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '.68rem', color: location.pathname === item.to ? 'var(--blue-bright)' : 'var(--text2)', textAlign: 'center' }}>{item.label}</span>
                </button>
              ))}
              {user?.role === 'creator' && sec.title === 'System' && (
                <button onClick={() => { navigate('/creator'); setDrawerKey(null) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.3rem',
                    padding: '.65rem .4rem', background: 'var(--amber-d)', border: '1px solid rgba(245,158,11,.3)',
                    borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <span style={{ fontSize: '1.1rem' }}>👑</span>
                  <span style={{ fontSize: '.68rem', color: 'var(--amber-bright)', textAlign: 'center' }}>Creator</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const isFinanceActive = ['/expenses','/invoices','/wallet','/approvals','/budget'].some(p => location.pathname.startsWith(p))
  const isMoreActive    = !['/','finance','/projects','/workers'].some(p => location.pathname === p || location.pathname.startsWith('/crm') || location.pathname.startsWith('/tasks')) && location.pathname !== '/'

  return (
    <div className="erp-root">
      {/* Mobile backdrop */}
      {sideOpen && (
        <div onClick={() => setSide(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 299, backdropFilter: 'blur(3px)' }} />
      )}

      {Sidebar}
      {BottomDrawer}

      <div className="erp-main">
        {/* Topbar */}
        <header className="erp-topbar">
          <button className="mobile-menu-btn" onClick={() => setSide(p => !p)} aria-label="Menu">☰</button>
          <div className="topbar-title" style={{ flex: 1 }}>Alpha Quantum ERP</div>

          {/* Notifications */}
          <button className="btn btn-ghost btn-sm" style={{ position: 'relative', padding: '.4rem' }}
            onClick={() => navigate('/notifications/settings')}>
            🔔
            {unread > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--rose)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16, fontSize: '.58rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* User avatar */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserMenu(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                : <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '.68rem' }}>{initials}</div>
              }
            </button>
            {userMenu && (
              <>
                <div onClick={() => setUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                  background: 'var(--card)', border: '1px solid var(--border2)',
                  borderRadius: 'var(--radius-lg)', padding: '.5rem', minWidth: 180,
                  zIndex: 200, boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ padding: '.5rem .75rem', borderBottom: '1px solid var(--border)', marginBottom: '.3rem' }}>
                    <div style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text)' }}>{user?.full_name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text3)' }}>{user?.email}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={() => { navigate('/settings'); setUserMenu(false) }}>⚙️ Settings</button>
                  <button className="btn btn-ghost btn-sm btn-full" onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
                  <button className="btn btn-danger btn-sm btn-full" style={{ marginTop: '.25rem' }} onClick={() => { logout(); navigate('/login') }}>Sign Out</button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Main content — add bottom padding for mobile nav */}
        <main className="erp-content" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <Outlet />
        </main>

        {/* ── Mobile Bottom Navigation ──────────────────────── */}
        <nav style={{
          display: 'none', // overridden by CSS media query below
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 400,
          background: 'var(--surface)', borderTop: '1px solid var(--border2)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          backdropFilter: 'blur(12px)',
        }} className="bottom-nav">
          {/* Dashboard */}
          <button onClick={() => navigate('/')}
            className={`bottom-tab${location.pathname === '/' ? ' active' : ''}`}>
            <span className="bottom-tab-icon">◈</span>
            <span className="bottom-tab-label">Dashboard</span>
          </button>

          {/* Finance group */}
          <button onClick={() => isFinanceActive ? null : setDrawerKey(drawerKey === 'finance' ? null : 'finance')}
            className={`bottom-tab${isFinanceActive || drawerKey === 'finance' ? ' active' : ''}`}>
            <span className="bottom-tab-icon">💰</span>
            <span className="bottom-tab-label">Finance</span>
          </button>

          {/* Projects */}
          <button onClick={() => navigate('/projects')}
            className={`bottom-tab${location.pathname.startsWith('/projects') || location.pathname.startsWith('/tasks') ? ' active' : ''}`}>
            <span className="bottom-tab-icon">📁</span>
            <span className="bottom-tab-label">Projects</span>
          </button>

          {/* HR */}
          <button onClick={() => navigate('/workers')}
            className={`bottom-tab${location.pathname.startsWith('/workers') || location.pathname.startsWith('/salary') || location.pathname.startsWith('/timesheet') ? ' active' : ''}`}>
            <span className="bottom-tab-icon">👷</span>
            <span className="bottom-tab-label">HR</span>
          </button>

          {/* More */}
          <button onClick={() => setDrawerKey(drawerKey === 'more' ? null : 'more')}
            className={`bottom-tab${drawerKey === 'more' ? ' active' : ''}`}>
            <span className="bottom-tab-icon" style={{ fontSize: '1.3rem', lineHeight: 1 }}>⋯</span>
            <span className="bottom-tab-label">More</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
