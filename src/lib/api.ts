// src/lib/api.ts — Alpha Quantum ERP v15
const MAX_RETRIES = 2, RETRY_DELAY = 800

interface ApiError extends Error { status?: number; response?: unknown }

function getToken(): string | null {
  try { return localStorage.getItem('erp_token') } catch { return null }
}
function createApiError(message: string, status?: number, response?: unknown): ApiError {
  const error = new Error(message) as ApiError
  error.status = status; error.response = response; return error
}
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
function buildUrl(path: string): string {
  const clean = path.replace(/^\/+/, '')
  const [routePart, queryPart] = clean.split('?')
  const base = `/api?r=${encodeURIComponent(routePart)}`
  return queryPart ? `${base}&${queryPart}` : base
}
async function request<T>(method: string, path: string, body?: unknown, retryCount = 0): Promise<T> {
  const token = getToken()
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }
  try {
    const res = await fetch(buildUrl(path), opts)
    if (res.status === 401) {
      localStorage.removeItem('erp_token'); localStorage.removeItem('erp_user')
      window.location.href = '/login'
      throw createApiError('Unauthorized', 401)
    }
    const ct = res.headers.get('content-type') ?? ''
    const data: unknown = ct.includes('application/json') ? await res.json() : { error: await res.text() }
    if (!res.ok) throw createApiError((data as{error?:string})?.error ?? `Request failed (${res.status})`, res.status, data)
    return data as T
  } catch (error: unknown) {
    if (retryCount < MAX_RETRIES && error instanceof TypeError) {
      await sleep(RETRY_DELAY * (retryCount + 1))
      return request<T>(method, path, body, retryCount + 1)
    }
    if (error instanceof Error) throw error
    throw createApiError('Unknown error')
  }
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
}
export type { ApiError }
