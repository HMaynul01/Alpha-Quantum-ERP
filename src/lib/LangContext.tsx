// src/lib/LangContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react'

type Lang = 'en' | 'ar'

const EN = {
  dashboard: 'Dashboard',
  welcome: 'Welcome',
  approvedExpenses: 'Approved Expenses',
  approvedInvoices: 'Approved Invoices',
  walletBalance: 'Wallet Balance',
  pendingApprovals: 'Pending Approvals',
  records: 'records',
  awaitingReview: 'awaiting review',
  cashMinusExpenses: 'cash – approved expenses',
  expensesLast6: 'Approved Expenses — Last 6 Months',
  quickActions: 'Quick Actions',
  newExpense: '+ New Expense',
  newInvoice: '+ New Invoice',
  viewWallet: 'View Wallet',
  reviewApprovals: 'Review Approvals',
  loading: 'Loading…',
  totalExpenses: 'Total Expenses',
  totalInvoices: 'Total Invoices',
  pendingExpenses: 'Pending Expenses',
  pendingInvoices: 'Pending Invoices',
  recentActivity: 'Recent Activity',
  monthlyTrend: 'Monthly Trend',
  netFlow: 'Net Cash Flow',
  expenses: 'Expenses',
  invoices: 'Invoices',
  wallet: 'My Wallet',
  approvals: 'Approvals',
  users: 'Users',
  permissions: 'Permissions',
  reports: 'Reports',
  signOut: 'Sign Out',
  approved: 'APPROVED',
  pending: 'PENDING',
  rejected: 'REJECTED',
  amount: 'Amount',
  status: 'Status',
  date: 'Date',
  // Invoice PDF
  invoiceFrom: 'Invoice From',
  invoiceTo: 'Invoice To',
  invoiceNumber: 'Invoice #',
  invoiceDate: 'Invoice Date',
  dueDate: 'Due Date',
  itemDescription: 'Item Description',
  qty: 'QTY',
  unitPrice: 'Unit Price',
  tax: 'Tax',
  total: 'Total',
  subtotal: 'Subtotal',
  grandTotal: 'Grand Total',
  paymentInfo: 'Payment Information',
  vatNumber: 'VAT Number',
  thanksBusiness: 'THANK YOU FOR YOUR BUSINESS!',
  companyName: 'Alpha Ultimate Ltd',
  companyTagline: 'Construction & Cleaning | KSA',
  exportPDF: '⬇ PDF',
  exportExcel: '⬇ Excel',
  allExpenses: 'All Expenses',
  allInvoices: 'All Invoices',
}

const BN: typeof EN = {
  dashboard: 'ড্যাশবোর্ড',
  welcome: 'স্বাগতম',
  approvedExpenses: 'অনুমোদিত ব্যয়',
  approvedInvoices: 'অনুমোদিত চালান',
  walletBalance: 'ওয়ালেট ব্যালেন্স',
  pendingApprovals: 'অপেক্ষমান অনুমোদন',
  records: 'রেকর্ড',
  awaitingReview: 'পর্যালোচনার অপেক্ষায়',
  cashMinusExpenses: 'নগদ – অনুমোদিত ব্যয়',
  expensesLast6: 'অনুমোদিত ব্যয় — গত ৬ মাস',
  quickActions: 'দ্রুত কার্যক্রম',
  newExpense: '+ নতুন ব্যয়',
  newInvoice: '+ নতুন চালান',
  viewWallet: 'ওয়ালেট দেখুন',
  reviewApprovals: 'অনুমোদন পর্যালোচনা',
  loading: 'লোড হচ্ছে…',
  totalExpenses: 'মোট ব্যয়',
  totalInvoices: 'মোট চালান',
  pendingExpenses: 'অপেক্ষমান ব্যয়',
  pendingInvoices: 'অপেক্ষমান চালান',
  recentActivity: 'সাম্প্রতিক কার্যক্রম',
  monthlyTrend: 'মাসিক প্রবণতা',
  netFlow: 'নিট নগদ প্রবাহ',
  expenses: 'ব্যয়',
  invoices: 'চালান',
  wallet: 'আমার ওয়ালেট',
  approvals: 'অনুমোদন',
  users: 'ব্যবহারকারী',
  permissions: 'অনুমতি',
  reports: 'প্রতিবেদন',
  signOut: 'প্রস্থান',
  approved: 'অনুমোদিত',
  pending: 'অপেক্ষমান',
  rejected: 'প্রত্যাখ্যাত',
  amount: 'পরিমাণ',
  status: 'অবস্থা',
  date: 'তারিখ',
  invoiceFrom: 'চালান প্রদানকারী',
  invoiceTo: 'চালান গ্রাহক',
  invoiceNumber: 'চালান নং',
  invoiceDate: 'চালানের তারিখ',
  dueDate: 'পরিশোধের তারিখ',
  itemDescription: 'পণ্যের বিবরণ',
  qty: 'পরিমাণ',
  unitPrice: 'একক মূল্য',
  tax: 'কর',
  total: 'মোট',
  subtotal: 'উপ-মোট',
  grandTotal: 'সর্বমোট',
  paymentInfo: 'পেমেন্ট তথ্য',
  vatNumber: 'ভ্যাট নম্বর',
  thanksBusiness: 'আপনার ব্যবসার জন্য ধন্যবাদ!',
  companyName: 'আলফা আলটিমেট লিমিটেড',
  companyTagline: 'নির্মাণ ও পরিষ্কার | সৌদি আরব',
  exportPDF: '⬇ পিডিএফ',
  exportExcel: '⬇ এক্সেল',
  allExpenses: 'সকল ব্যয়',
  allInvoices: 'সকল চালান',
}

const TRANSLATIONS: Record<Lang, typeof EN> = { en: EN, bn: BN }

interface LangCtx {
  lang: Lang
  t: typeof EN
  toggle: () => void
}

const Ctx = createContext<LangCtx>({ lang:'en', t: EN, toggle: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('erp_lang') as Lang) ?? 'en')
  function toggle() {
    setLang(p => {
      const next = p === 'en' ? 'bn' : 'en'
      localStorage.setItem('erp_lang', next)
      return next
    })
  }
  return <Ctx.Provider value={{ lang, t: TRANSLATIONS[lang], toggle }}>{children}</Ctx.Provider>
}

export function useLang() { return useContext(Ctx) }
