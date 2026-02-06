/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ISA_AGENT_WEBHOOK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
