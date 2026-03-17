// server.js — Alpha Quantum ERP v15 — Local Express Server
import express from 'express'
import { createServer } from 'vite'
import handler from './api/index.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// API routes
app.all('/api', (req, res) => handler(req, res))
app.all('/api/*', (req, res) => handler(req, res))

// In production serve built files
if (process.env.NODE_ENV === 'production') {
  const { default: sirv } = await import('sirv')
  app.use(sirv('dist', { single: true }))
} else {
  // In dev, Vite handles frontend
  console.log('Run "npm run dev" separately for frontend in dev mode')
}

app.listen(PORT, () => {
  console.log(`\n🚀 Alpha Quantum ERP v15 running at http://localhost:${PORT}`)
  console.log(`📡 API: http://localhost:${PORT}/api?r=health\n`)
})
