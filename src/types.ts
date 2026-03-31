export interface Message {
  id: string
  text: string
  sender: 'user' | 'isa'
  timestamp: Date
  /** Mapa IMG:0001 → data: o https del último POST /ia360-doc/chat (solo mensajes del asistente en vivo). */
  ia360Images?: Record<string, string>
}

export interface UserData {
  nit: string
  empresa: string
  funcionario: string
  empresaId?: number
  contactoId?: number
  licencia?: string
}
