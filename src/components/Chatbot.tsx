import { useState, useRef, useEffect } from 'react'
import ChatIcon from './ChatIcon'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import RegistrationForm from './RegistrationForm'
import WelcomePanel from './WelcomePanel'
import PreguntasFrecuentes from './PreguntasFrecuentes'
import ChatAgente from './ChatAgente'
import { Message, UserData } from '../types'
import { sendMessageToIsaAgent, crearConversacion, guardarMensajeBD, obtenerTokenAccesoFAQ, verificarServicioFAQ } from '../services/api'
import './Chatbot.css'

const STORAGE_KEY_USER = 'isa_widget_user'
const AGENT_NAME = 'Isa'

function loadStoredUser(): UserData | null {
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_USER) : null
    if (!raw) return null
    const data = JSON.parse(raw) as UserData
    return data.empresaId != null && data.contactoId != null ? data : null
  } catch {
    return null
  }
}

function saveStoredUser(data: UserData | null) {
  try {
    if (typeof sessionStorage === 'undefined') return
    if (data) sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data))
    else sessionStorage.removeItem(STORAGE_KEY_USER)
  } catch {}
}
// Preguntas frecuentes: desarrollo → localhost:3009, Docker/producción → 3008 (o VITE_FAQ_URL si está definida)
const FAQ_URL = (() => {
  const envUrl = (import.meta.env.VITE_FAQ_URL || '').replace(/\/$/, '')
  if (envUrl) return envUrl
  return import.meta.env.DEV ? 'http://localhost:3009' : 'http://localhost:3008'
})()

function generateSessionId(): string {
  return crypto.randomUUID?.()?.replace(/-/g, '') ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

type ViewAfterRegistration = 'panel' | 'isa' | 'faq' | 'agente'

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [view, setView] = useState<ViewAfterRegistration>('panel')
  const [isSending, setIsSending] = useState(false)
  /** Mensaje de validación en el menú (ej. servicio sin preguntas frecuentes), como la cédula/permisos */
  const [panelFaqError, setPanelFaqError] = useState<string | null>(null)
  const isaSessionIdRef = useRef<string>(generateSessionId())
  // Conversación en BD para el chat con Isa
  const isaConversacionIdRef = useRef<number | null>(null)
  const creandoConversacionRef = useRef<boolean>(false)

  // Restaurar usuario desde sessionStorage al montar (para mantener historial al refrescar o reabrir)
  useEffect(() => {
    const stored = loadStoredUser()
    if (stored) {
      setUserData(stored)
      setIsRegistered(true)
    }
  }, [])

  const handleRegistration = (data: UserData) => {
    setUserData(data)
    setIsRegistered(true)
    saveStoredUser(data)
    setView('panel')
    // Mensaje de bienvenida para cuando entre a chatear con Isa
    const welcomeMessage: Message = {
      id: '1',
      text: `¡Hola ${data.funcionario} de ${data.empresa}! 👋
Soy ${AGENT_NAME}, tu asistente virtual.`,


      sender: 'isa',
      timestamp: new Date()
    }
    
    setMessages([welcomeMessage])
  }

  // Crear conversación en BD para Isa (si no existe aún)
  const asegurarConversacionIsa = async (): Promise<number | null> => {
    if (isaConversacionIdRef.current) return isaConversacionIdRef.current
    if (creandoConversacionRef.current) return null
    if (!userData?.empresaId || !userData?.contactoId) return null

    creandoConversacionRef.current = true
    try {
      const conv = await crearConversacion(userData.empresaId, userData.contactoId)
      isaConversacionIdRef.current = conv.id_conversacion
      return conv.id_conversacion
    } catch (err) {
      console.warn('Error al crear conversación Isa en BD:', err)
      return null
    } finally {
      creandoConversacionRef.current = false
    }
  }

  const handleSelectChatearIsa = async () => {
    setPanelFaqError(null)
    setIsSending(true)
    setView('isa')

    // Crear conversación en BD
    const convId = await asegurarConversacionIsa()

    // Enviar licencia/servicio seleccionado a la API y esperar respuesta de Isa
    if (userData?.licencia) {
      const sessionId = isaSessionIdRef.current

      // Guardar el servicio enviado como mensaje del usuario en BD
      if (convId && userData?.empresaId && userData?.contactoId) {
        try {
          await guardarMensajeBD({
            empresa_id: userData.empresaId,
            conversacion_id: convId,
            tipo_emisor: 'CONTACTO',
            contacto_id: userData.contactoId,
            contenido: userData.licencia,
          })
        } catch (err) {
          console.warn('Error al guardar servicio en BD:', err)
        }
      }

      try {
        // Enviar a la API y esperar respuesta
        const respuestaIsa = await sendMessageToIsaAgent(sessionId, userData.licencia)

        // Mostrar respuesta de Isa en el chat
        const isaResponse: Message = {
          id: (Date.now() + 1).toString(),
          text: respuestaIsa,
          sender: 'isa',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, isaResponse])

        // Guardar respuesta de Isa en BD
        if (convId && userData?.empresaId) {
          try {
            await guardarMensajeBD({
              empresa_id: userData.empresaId,
              conversacion_id: convId,
              tipo_emisor: 'BOT',
              contenido: respuestaIsa,
            })
          } catch (err) {
            console.warn('Error al guardar respuesta Isa en BD:', err)
          }
        }
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'No pude conectar con el agente. Intenta de nuevo.'
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          text: errorText,
          sender: 'isa',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } else {
      // Si no hay licencia, guardar el mensaje de bienvenida en BD
      if (convId && userData?.empresaId) {
        const bienvenidaTexto = messages.length > 0 ? messages[0].text : ''
        if (bienvenidaTexto) {
          try {
            await guardarMensajeBD({
              empresa_id: userData.empresaId,
              conversacion_id: convId,
              tipo_emisor: 'BOT',
              contenido: bienvenidaTexto,
            })
          } catch (err) {
            console.warn('Error al guardar bienvenida en BD:', err)
          }
        }
      }
    }

    setIsSending(false)
  }

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isSending) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setIsSending(true)

    // Asegurar que hay conversación en BD
    const convId = await asegurarConversacionIsa()

    // Guardar mensaje del usuario (CONTACTO) en BD
    if (convId && userData?.empresaId && userData?.contactoId) {
      try {
        await guardarMensajeBD({
          empresa_id: userData.empresaId,
          conversacion_id: convId,
          tipo_emisor: 'CONTACTO',
          contacto_id: userData.contactoId,
          contenido: text.trim(),
        })
      } catch (err) {
        console.warn('Error al guardar mensaje usuario en BD:', err)
      }
    }

    try {
      const sessionId = isaSessionIdRef.current
      const responseText = await sendMessageToIsaAgent(sessionId, text.trim())
      const isaResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: 'isa',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, isaResponse])

      // Guardar respuesta de Isa (BOT) en BD
      if (convId && userData?.empresaId) {
        try {
          await guardarMensajeBD({
            empresa_id: userData.empresaId,
            conversacion_id: convId,
            tipo_emisor: 'BOT',
            contenido: responseText,
          })
        } catch (err) {
          console.warn('Error al guardar respuesta Isa en BD:', err)
        }
      }
    } catch (err) {
      const fallbackText = err instanceof Error ? err.message : 'No pude conectar con el agente. Intenta de nuevo.'
      const isaResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: fallbackText,
        sender: 'isa',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, isaResponse])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="chatbot-container">
      {isOpen ? (
        <div className="chatbot-window">
          {!isRegistered ? (
            <RegistrationForm 
              onSubmit={handleRegistration}
              onClose={() => setIsOpen(false)}
            />
          ) : view === 'panel' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Menú</h3>
                  <span className="status-indicator"></span>
                </div>
                <button 
                  className="close-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar chat"
                >
                  ×
                </button>
              </div>
              <WelcomePanel
                userData={userData!}
                faqError={panelFaqError}
                onSelectPreguntasFrecuentes={async () => {
                  const licencia = userData!.licencia?.trim()
                  if (licencia) {
                    try {
                      const { existe } = await verificarServicioFAQ(licencia)
                      if (!existe) {
                        setPanelFaqError('❌ El servicio seleccionado no está disponible en preguntas frecuentes.')
                        return
                      }
                    } catch (e) {
                      if (import.meta.env?.DEV) console.warn('[Chatbot] Error al verificar servicio FAQ:', e)
                    }
                  }
                  setPanelFaqError(null)
                  const baseUrl = (typeof window !== 'undefined' && window.location.port === '3002')
                    ? 'http://localhost:3009'
                    : FAQ_URL
                  const params = new URLSearchParams()
                  if (userData!.empresaId != null && userData!.contactoId != null) {
                    try {
                      const token = await obtenerTokenAccesoFAQ(userData!.empresaId, userData!.contactoId)
                      if (token) {
                        params.set('token', token)
                      } else if (import.meta.env?.DEV) {
                        console.warn('[Chatbot] FAQ: no se obtuvo token. Verifique que el backend (api/faq-acceso) esté en ejecución y que empresaId/contactoId sean válidos.')
                      }
                    } catch (e) {
                      if (import.meta.env?.DEV) console.warn('[Chatbot] FAQ token error:', e)
                    }
                  }
                  if (userData!.licencia) {
                    try {
                      window.localStorage.setItem('faq_servicio_chatbot', userData!.licencia)
                    } catch (_) {}
                    params.set('servicio', userData!.licencia)
                  }
                  const qs = params.toString()
                  const url = qs ? `${baseUrl}?${qs}` : baseUrl
                  window.open(url, '_blank')
                }}
                onSelectChatearIsa={handleSelectChatearIsa}
                onSelectChatearAgente={() => {
                  setPanelFaqError(null)
                  setView('agente')
                }}
              />
            </>
          ) : view === 'faq' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Preguntas frecuentes</h3>
                </div>
                <button 
                  className="close-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar chat"
                >
                  ×
                </button>
              </div>
              <PreguntasFrecuentes onBack={() => setView('panel')} />
            </>
          ) : view === 'agente' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Chatear con agente</h3>
                </div>
                <button 
                  className="close-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar chat"
                >
                  ×
                </button>
              </div>
              <ChatAgente
                userData={userData!}
                onBack={() => setView('panel')}
                onBackFromClosed={() => {
                  setUserData(null)
                  saveStoredUser(null)
                  setIsRegistered(false)
                }}
              />
            </>
          ) : (
            <>
              <div className="chatbot-header">
                <div className="chatbot-header-content">
                  <div className="chatbot-avatar">
                    <ChatIcon />
                  </div>
                  <div className="chatbot-header-info">
                    <h3>{AGENT_NAME}</h3>
                    <span className="status-indicator">En línea</span>
                  </div>
                </div>
                <button 
                  className="close-button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Cerrar chat"
                >
                  ×
                </button>
              </div>
              <MessageList messages={messages} />
              <MessageInput onSendMessage={handleSendMessage} disabled={isSending} />
            </>
          )}
        </div>
      ) : (
        <button 
          className="chatbot-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Chatea con Isa"
          title="Chatea con Isa"
        >
          <ChatIcon />
          <span className="chatbot-toggle-text">{AGENT_NAME}</span>
        </button>
      )}
    </div>
  )
}

export default Chatbot
