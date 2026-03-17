/// <reference types="vite/client" />

// PNG/JPG/SVG asset imports
declare module '*.png' { const src: string; export default src }
declare module '*.jpg' { const src: string; export default src }
declare module '*.jpeg' { const src: string; export default src }
declare module '*.svg' { const src: string; export default src }
declare module '*.webp' { const src: string; export default src }

interface ImportMetaEnv {
  readonly VITE_CREATOR_USERNAME?: string
  readonly VITE_API_URL?: string
  readonly MODE: string
  readonly BASE_URL: string
  readonly PROD: boolean
  readonly DEV: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
