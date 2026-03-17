// src/components/erp/CameraUploadForm.tsx — Alpha Quantum ERP v15
// File upload via Cloudflare R2 through API
import { useState, useRef } from 'react'

interface Props {
  onUpload: (url: string) => void
  label?: string
  accept?: string
  folder?: string
}

export default function CameraUploadForm({ onUpload, label = 'Upload File', accept = 'image/*,application/pdf', folder = 'uploads' }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('File too large (max 10MB)'); return }
    setUploading(true); setError('')
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string)
          const token = localStorage.getItem('erp_token')
          const res = await fetch(`/api?r=uploads%2Ffile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ file: base64, filename: file.name, mimetype: file.type, folder })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Upload failed')
          onUpload(data.url)
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Upload failed')
        } finally { setUploading(false) }
      }
      reader.readAsDataURL(file)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
        style={{ padding: '.5rem 1rem', background: 'var(--blue-d)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)', color: 'var(--blue)', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '.85rem', fontWeight: 600, opacity: uploading ? .6 : 1 }}>
        {uploading ? '⏳ Uploading…' : `📎 ${label}`}
      </button>
      {error && <span style={{ color: 'var(--rose)', fontSize: '.78rem' }}>{error}</span>}
    </div>
  )
}
