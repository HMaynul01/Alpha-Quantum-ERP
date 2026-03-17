// src/lib/AuthContext.tsx — Alpha Quantum ERP v15
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

interface UserData {
  id: string; username: string; email: string; full_name: string
  role: string; cube_id?: string | null; department?: string
  permissions: Record<string, string>; avatar_url?: string
}
interface AuthCtx {
  user: UserData | null; login: (u: string, p: string) => Promise<void>
  logout: () => void; ready: boolean; isAuthenticated: boolean
  refreshUser: () => Promise<void>; error?: string | null
}
const Ctx = createContext<AuthCtx>({
  user:null, login:async()=>{}, logout:()=>{}, ready:false, isAuthenticated:false, refreshUser:async()=>{}
})
const TOKEN_KEY='erp_token', USER_KEY='erp_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,setUser] = useState<UserData|null>(null)
  const [ready,setReady] = useState(false)
  const [error,setError] = useState<string|null>(null)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const saved = localStorage.getItem(USER_KEY)
    if (token && saved) {
      try { setUser(JSON.parse(saved)) }
      catch { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) }
    }
    setReady(true)
  }, [])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return
    try {
      const res = await fetch('/api?r=auth%2Fme', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const d = await res.json()
        setUser(d.user); localStorage.setItem(USER_KEY, JSON.stringify(d.user)); setError(null)
      } else if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); setUser(null)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!user) return
    const id = setInterval(refreshUser, 600000)
    return () => clearInterval(id)
  }, [user, refreshUser])

  async function login(username: string, password: string) {
    setError(null)
    const res = await fetch('/api?r=auth%2Flogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    let data: unknown
    try { data = await res.json() } catch { throw new Error('Server error') }
    if (!res.ok) {
      const msg = (data as { error?: string })?.error ?? `Login failed (${res.status})`
      setError(msg); throw new Error(msg)
    }
    const { token, user: u } = data as { token: string; user: UserData }
    localStorage.setItem(TOKEN_KEY, token); localStorage.setItem(USER_KEY, JSON.stringify(u))
    setUser(u); setError(null)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
    setUser(null); setError(null)
  }

  return (
    <Ctx.Provider value={{ user, login, logout, ready, isAuthenticated: !!user, refreshUser, error }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() { return useContext(Ctx) }

export async function apiCall(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  const headers = { 'Content-Type': 'application/json', ...options.headers } as Record<string,string>
  if (token) headers['Authorization'] = `Bearer ${token}`
  const clean = endpoint.replace(/^\/+/, '')
  const [routePart, queryPart] = clean.split('?')
  const url = `/api?r=${encodeURIComponent(routePart)}${queryPart ? '&' + queryPart : ''}`
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
    window.location.href = '/login'
  }
  return res
}
