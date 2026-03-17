// src/pages/NotificationSettingsPage.tsx — Alpha Quantum ERP v16
import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Notif { id:string; title:string; body:string; entity_type?:string; is_read:boolean; created_at:string }

export default function NotificationSettingsPage() {
  const [notifs,  setNotifs]  = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  function load() {
    setLoading(true)
    api.get<{ notifications:Notif[]; unread:number }>('/notifications')
      .then(d => setNotifs(d.notifications || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function markAll() {
    setMarking(true)
    await api.post('/notifications/read', {}).catch(() => {})
    setMarking(false); load()
  }

  const unread = notifs.filter(n => !n.is_read).length

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">{unread} unread · {notifs.length} total</p>
        </div>
        {unread > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={markAll} disabled={marking}>
            {marking ? 'Marking…' : '✓ Mark All Read'}
          </button>
        )}
      </div>
      {loading ? (
        <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><div className="spinner"/></div>
      ) : notifs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <div className="empty-title">No Notifications</div>
          <div className="empty-desc">You're all caught up!</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
          {notifs.map(n => (
            <div key={n.id} className="card" style={{ background:n.is_read?'var(--card)':'var(--blue-d)', border:`1px solid ${n.is_read?'var(--border)':'rgba(59,130,246,.25)'}`, padding:'1rem 1.25rem' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'1rem' }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--text)', marginBottom:'.25rem' }}>{n.title}</div>
                  <div style={{ fontSize:'.83rem', color:'var(--text2)' }}>{n.body}</div>
                </div>
                <div style={{ flexShrink:0, textAlign:'right' }}>
                  <div style={{ fontSize:'.72rem', color:'var(--text3)' }}>{new Date(n.created_at).toLocaleDateString('en-GB')}</div>
                  {!n.is_read && <span className="badge badge-draft" style={{ marginTop:'.3rem' }}>New</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
