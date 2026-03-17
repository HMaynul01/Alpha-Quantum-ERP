// src/App.tsx — Alpha Quantum ERP v15
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LangProvider } from './lib/LangContext'
import { ThemeProvider } from './lib/ThemeContext'
import { ReactNode } from 'react'

import LoginPage                from './pages/LoginPage'
import CubeRequestPage          from './pages/CubeRequestPage'
import ERPLayout                from './pages/ERPLayout'
import Dashboard                from './pages/Dashboard'
import ExpensesPage             from './pages/ExpensesPage'
import ExpenseFormPage          from './pages/ExpenseFormPage'
import InvoicesPage             from './pages/InvoicesPage'
import InvoiceFormPage          from './pages/InvoiceFormPage'
import ApprovalDashboard        from './pages/ApprovalDashboard'
import UsersPage                from './pages/UsersPage'
import PermissionsPage          from './pages/PermissionsPage'
import ReportsPage              from './pages/ReportsPage'
import WalletPage               from './pages/WalletPage'
import AssetsPage               from './pages/AssetsPage'
import InvestmentsPage          from './pages/InvestmentsPage'
import LiabilitiesPage          from './pages/LiabilitiesPage'
import BudgetPage               from './pages/BudgetPage'
import WorkersPage              from './pages/WorkersPage'
import SalaryPage               from './pages/SalaryPage'
import TimesheetPage            from './pages/TimesheetPage'
import SettingsPage             from './pages/SettingsPage'
import FormBuilderPage          from './pages/FormBuilderPage'
import NotificationSettingsPage from './pages/NotificationSettingsPage'
import SubscriptionPage         from './pages/SubscriptionPage'
import CreatorPanel             from './pages/CreatorPanel'
import CubeAdminPanel           from './pages/CubeAdminPanel'
import CustomersPage            from './pages/CustomersPage'
import LeadsPage                from './pages/LeadsPage'
import ProjectsPage             from './pages/ProjectsPage'
import TasksPage                from './pages/TasksPage'

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return (
    <div style={{ minHeight:'100dvh',background:'var(--base)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1rem' }}>
      <div className="spinner" style={{ width:40,height:40 }} />
      <span style={{ fontFamily:'var(--font-mono)',fontSize:'.75rem',color:'var(--text2)',letterSpacing:'.08em' }}>LOADING…</span>
    </div>
  )
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function CreatorGuard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'creator') return <Navigate to="/" replace />
  return <>{children}</>
}

function CubeAdminGuard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  if (!['creator','cube_admin'].includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LangProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"        element={<LoginPage />} />
              <Route path="/request-cube" element={<CubeRequestPage />} />
              <Route path="/creator"      element={<CreatorGuard><CreatorPanel /></CreatorGuard>} />
              <Route path="/" element={<Guard><ERPLayout /></Guard>}>
                <Route index                         element={<Dashboard />} />
                <Route path="cube-admin"             element={<CubeAdminGuard><CubeAdminPanel /></CubeAdminGuard>} />
                <Route path="expenses"               element={<ExpensesPage />} />
                <Route path="expenses/new"           element={<ExpenseFormPage />} />
                <Route path="invoices"               element={<InvoicesPage />} />
                <Route path="invoices/new"           element={<InvoiceFormPage />} />
                <Route path="wallet"                 element={<WalletPage />} />
                <Route path="approvals"              element={<ApprovalDashboard />} />
                <Route path="users"                  element={<UsersPage />} />
                <Route path="permissions"            element={<PermissionsPage />} />
                <Route path="reports"                element={<ReportsPage />} />
                <Route path="assets"                 element={<AssetsPage />} />
                <Route path="investments"            element={<InvestmentsPage />} />
                <Route path="liabilities"            element={<LiabilitiesPage />} />
                <Route path="budget"                 element={<BudgetPage />} />
                <Route path="workers"                element={<WorkersPage />} />
                <Route path="salary"                 element={<SalaryPage />} />
                <Route path="timesheet"              element={<TimesheetPage />} />
                <Route path="settings"               element={<SettingsPage />} />
                <Route path="form-builder"           element={<FormBuilderPage />} />
                <Route path="notifications/settings" element={<NotificationSettingsPage />} />
                <Route path="subscription"           element={<SubscriptionPage />} />
                <Route path="crm/customers"          element={<CustomersPage />} />
                <Route path="crm/leads"              element={<LeadsPage />} />
                <Route path="projects"               element={<ProjectsPage />} />
                <Route path="tasks"                  element={<TasksPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </LangProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
export default App
