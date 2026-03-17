// src/types/globals.d.ts

// Augment jsPDF with lastAutoTable property (used by jspdf-autotable)
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: { finalY: number }
  }
}

// Type declaration for jspdf-autotable (no @types package available)
declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'
  interface UserOptions {
    startY?: number
    margin?: { top?:number; right?:number; bottom?:number; left?:number }
    head?: (string | number)[][]
    body?: (string | number | null)[][]
    headStyles?: Record<string, unknown>
    bodyStyles?: Record<string, unknown>
    alternateRowStyles?: Record<string, unknown>
    columnStyles?: Record<string | number, Record<string, unknown>>
    theme?: string
    styles?: Record<string, unknown>
    [key: string]: unknown
  }
  function autoTable(doc: jsPDF, options: UserOptions): void
  export default autoTable
}
