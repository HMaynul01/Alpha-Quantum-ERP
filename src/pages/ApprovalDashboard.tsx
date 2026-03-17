// src/pages/ApprovalDashboard.tsx — V6 Enterprise (Swipe + AI + Drawer)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { isSuperUser } from '../lib/auth'
import { api } from '../lib/api'

interface Item {
  id: string; ref?: string; title?: string
  customer_name?: string; submitted_by_name?: string; created_by_name?: string
  grand_total?: number; total_amount?: number; amount?: number
  status: string; created_at: string; notes?: string; category?: string
}
type Tab = 'expenses' | 'invoices'

export default function ApprovalDashboard() {
  const { user } = useAuth()
  const su = isSuperUser(user)

  const [tab, setTab] = useState<Tab>('expenses')
  const [data, setData] = useState<{ expenses: Item[]; invoices: Item[] }>({ expenses: [], invoices: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawer, setDrawer] = useState<Item | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const touchStartX = useRef(0)

  function load() {
    if (!su) return
    setLoading(true)
    api.get('/approvals')
      .then((d: any) => setData({ expenses: d.expenses || [], invoices: d.invoices || [] }))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [su])

  async function act(id: string, type: Tab, action: 'approve' | 'reject') {
    setActing(id)
    try {
      await api.post(`/${type}/approve`, { [`${type.slice(0, -1)}_id`]: id, action })
      load()
    } finally { setActing(null) }
  }

  function aiRisk(item: Item) {
    const amt = item.grand_total || item.total_amount || item.amount || 0
    if (amt > 10000) return { level: 'high', msg: 'Unusually high amount' }
    if (amt < 10) return { level: 'low', msg: 'Suspiciously low amount' }
    return { level: 'normal', msg: 'Looks normal' }
  }

  const items = useMemo(() => (tab === 'expenses' ? data.expenses : data.invoices), [tab, data])

  function handleTouchStart(e: any) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: any, item: Item) {
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (diff > 80) act(item.id, tab, 'approve')
    if (diff < -80) act(item.id, tab, 'reject')
  }

  const sar = (n: number) => `SAR ${Number(n || 0).toLocaleString()}`

  if (!su) return <div className="p-4">No Access</div>

  return (
    <div className="p-3 space-y-3">

      {/* Header */}
      <div className="flex justify-between items-center sticky top-0 bg-[var(--bg)] z-10 py-2">
        <h1 className="text-lg font-bold">Approvals V6</h1>
        <button onClick={load} className="btn btn-sm">↻</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('expenses')} className={`btn ${tab==='expenses'?'btn-primary':''}`}>Expenses</button>
        <button onClick={() => setTab('invoices')} className={`btn ${tab==='invoices'?'btn-primary':''}`}>Invoices</button>
      </div>

      {/* List */}
      {loading ? <div>Loading...</div> : items.map(item => {
        const risk = aiRisk(item)
        const amount = item.grand_total || item.total_amount || item.amount || 0

        return (
          <div key={item.id}
            onTouchStart={handleTouchStart}
            onTouchEnd={(e)=>handleTouchEnd(e,item)}
            className="p-3 rounded-xl shadow bg-[var(--card)]">

            <div className="flex justify-between">
              <div>
                <div className="text-sm font-bold">{item.title || item.customer_name}</div>
                <div className="text-xs opacity-70">{item.created_at}</div>
              </div>
              <div className="text-right">
                <div className="font-mono">{sar(amount)}</div>
                <div className={`text-xs ${risk.level==='high'?'text-red-500':risk.level==='low'?'text-yellow-500':'text-green-500'}`}>
                  {risk.msg}
                </div>
              </div>
            </div>

            <button onClick={()=>setDrawer(item)} className="mt-2 text-xs underline">View Details</button>
          </div>
        )
      })}

      {/* Drawer */}
      {drawer && (
        <div className="fixed inset-0 bg-black/40 flex items-end" onClick={()=>setDrawer(null)}>
          <div className="bg-white w-full p-4 rounded-t-2xl" onClick={e=>e.stopPropagation()}>
            <h2 className="font-bold mb-2">Details</h2>
            <div>ID: {drawer.id}</div>
            <div>Amount: {sar(drawer.grand_total||drawer.amount||0)}</div>
            <div>Notes: {drawer.notes||'-'}</div>

            <div className="flex gap-2 mt-4">
              <button className="btn btn-success flex-1" onClick={()=>act(drawer.id,tab,'approve')}>Approve</button>
              <button className="btn btn-danger flex-1" onClick={()=>act(drawer.id,tab,'reject')}>Reject</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
