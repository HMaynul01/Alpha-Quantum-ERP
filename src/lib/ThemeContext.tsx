// src/lib/ThemeContext.tsx — Alpha Ultimate ERP v12
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeCtx {
  theme: Theme
  toggleTheme: () => void
  isDark: boolean
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', toggleTheme: () => {}, isDark: true })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('erp_theme') as Theme) || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('erp_theme', theme) } catch {}
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  return (
    <Ctx.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useTheme() { return useContext(Ctx) }
