/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_ISA_AGENT_WEBHOOK_URL: string
  /** URL base del asistente Streamlit (chatbot_Agente), ej. http://localhost:8501 o https://agente-docs.ejemplo.com */
  readonly VITE_AGENTE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
