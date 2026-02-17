export interface Message {
  id: string
  text: string
  sender: 'user' | 'isa'
  timestamp: Date
}

export interface UserData {
  nit: string
  empresa: string
  funcionario: string
  empresaId?: number
  contactoId?: number
  licencia?: string
}
