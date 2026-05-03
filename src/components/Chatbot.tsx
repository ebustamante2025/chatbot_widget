import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import ChatIcon from './ChatIcon'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import RegistrationForm from './RegistrationForm'
import WelcomePanel from './WelcomePanel'
import PreguntasFrecuentes from './PreguntasFrecuentes'
import ChatAgente, { type ChatAgenteHandle } from './ChatAgente'
import ChatIA360 from './ChatIA360'
import { VolverLink } from './VolverLink'
import { Message, UserData } from '../types'
import {
  sendMessageToIsaAgent,
  crearConversacion,
  CANAL_WIDGET_ISA,
  guardarMensajeBD,
  obtenerTokenAccesoFAQ,
  verificarServicioFAQ,
  obtenerMenusWid,
  type MenuWid,
} from '../services/api'
import { isEmbeddedInIframe, postWidgetFrameResize } from '../utils/widgetEmbed'
import './Chatbot.css'

const STORAGE_KEY_USER = 'isa_widget_user'
const AGENT_NAME = 'Isa'
const TOGGLE_LABEL = 'Habla con Isa'

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
  // ? 'http://localhost:3009' : 'http://localhost:3008'
  return import.meta.env.VITE_FAQ_URL || 'https://preguntasfrecuntes.hginet.com.co'
})()

function generateSessionId(): string {
  return crypto.randomUUID?.()?.replace(/-/g, '') ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

type ViewAfterRegistration = 'panel' | 'isa' | 'faq' | 'agente' | 'ia360'

/**
 * Prueba → IA360 en el widget por defecto (mismo token/servicio/CRM que chatbot_Agente).
 * Backend: POST /api/ia360-doc/chat (OpenAI + Notion + mensajes canal IA360_DOC).
 * Para abrir solo Streamlit: VITE_IA360_USE_WIDGET=false
 */
const IA360_USE_WIDGET =
  import.meta.env.VITE_IA360_USE_WIDGET !== 'false' && import.meta.env.VITE_IA360_USE_WIDGET !== '0'

function ChatExpandToggleButton({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="chatbot-expand-button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Restaurar tamaño del chat' : 'Ampliar ventana del chat'}
      title={expanded ? 'Restaurar tamaño' : 'Ampliar'}
    >
      {expanded ? (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M4 10V4h6v2H6v4H4zm16-6h-6v2h4v4h2V4zM4 20v-6h2v4h4v2H4zm12-6v6h2v-6h-4v2z"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M10 4H4v6h2V6h4V4zm10 0v2h4v4h2V4h-6zM4 14v6h6v-2H6v-4H4zm14 0v4h-4v2h6v-6h-2z"
          />
        </svg>
      )}
    </button>
  )
}

function Chatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRegistered, setIsRegistered] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [view, setView] = useState<ViewAfterRegistration>('panel')
  const [isSending, setIsSending] = useState(false)
  /** Mensaje de validación en el menú (ej. servicio sin preguntas frecuentes), como la cédula/permisos */
  const [panelFaqError, setPanelFaqError] = useState<string | null>(null)
  /** Sesión IA360 en widget: token FAQ + servicio (licencia) */
  const [ia360WidgetSession, setIa360WidgetSession] = useState<{ token: string; servicio: string } | null>(
    null
  )
  const isaSessionIdRef = useRef<string>(generateSessionId())
  // Conversación en BD para el chat con Isa
  const isaConversacionIdRef = useRef<number | null>(null)
  const creandoConversacionRef = useRef<boolean>(false)
  const chatAgenteRef = useRef<ChatAgenteHandle | null>(null)
  const agenteMenuBtnRef = useRef<HTMLButtonElement>(null)
  const agenteMenuDropdownRef = useRef<HTMLDivElement>(null)
  const [agenteMenuOpen, setAgenteMenuOpen] = useState(false)
  const [agenteConvListo, setAgenteConvListo] = useState(false)
  const [agenteMenuPos, setAgenteMenuPos] = useState({ top: 0, right: 0 })
  const [menusWid, setMenusWid] = useState<MenuWid[]>([])

  const updateAgenteMenuPosition = useCallback(() => {
    const el = agenteMenuBtnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAgenteMenuPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
  }, [])

  useEffect(() => {
    if (view !== 'agente') {
      setAgenteConvListo(false)
      setAgenteMenuOpen(false)
    }
  }, [view])

  useEffect(() => {
    if (!agenteMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (agenteMenuBtnRef.current?.contains(t)) return
      if (agenteMenuDropdownRef.current?.contains(t)) return
      setAgenteMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAgenteMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [agenteMenuOpen])

  useEffect(() => {
    if (!agenteMenuOpen) return
    const onResize = () => updateAgenteMenuPosition()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [agenteMenuOpen, updateAgenteMenuPosition])

  const handleIa360TokenRenewed = useCallback((newToken: string) => {
    setIa360WidgetSession((prev) => (prev ? { ...prev, token: newToken } : null))
  }, [])

  // Restaurar usuario desde sessionStorage al montar (para mantener historial al refrescar o reabrir)
  useEffect(() => {
    const stored = loadStoredUser()
    if (stored) {
      setUserData(stored)
      setIsRegistered(true)
      obtenerMenusWid()
        .then(setMenusWid)
        .catch(() => setMenusWid([]))
    }
  }, [])

  useEffect(() => {
    if (!isOpen) setIsExpanded(false)
  }, [isOpen])

  useEffect(() => {
    if (!isEmbeddedInIframe()) return
    document.documentElement.classList.add('isa-widget--iframe')
    return () => {
      document.documentElement.classList.remove('isa-widget--iframe')
      document.documentElement.classList.remove('isa-widget--iframe-expanded')
    }
  }, [])

  useEffect(() => {
    if (!isEmbeddedInIframe()) return
    const root = document.documentElement
    if (isOpen && isExpanded) {
      root.classList.add('isa-widget--iframe-expanded')
    } else {
      root.classList.remove('isa-widget--iframe-expanded')
    }
  }, [isOpen, isExpanded])

  // En iframe (loader externo): avisar al padre el tamaño para no tapar toda la página cuando el chat está cerrado
  useEffect(() => {
    postWidgetFrameResize({
      open: isOpen,
      registered: isRegistered,
      view,
      expanded: isExpanded && isOpen,
    })
  }, [isOpen, isRegistered, view, isExpanded])

  const handleCorregirIdentificacion = useCallback(() => {
    setUserData(null)
    saveStoredUser(null)
    setIsRegistered(false)
    setView('panel')
    setPanelFaqError(null)
    setIa360WidgetSession(null)
    isaConversacionIdRef.current = null
    creandoConversacionRef.current = false
    isaSessionIdRef.current = generateSessionId()
    setMessages([])
    setAgenteConvListo(false)
    setAgenteMenuOpen(false)
  }, [])

  const handleAgenteConvListo = useCallback(() => {
    setAgenteConvListo(true)
  }, [])

  const handleRegistration = (data: UserData) => {
    setUserData(data)
    setIsRegistered(true)
    saveStoredUser(data)
    obtenerMenusWid()
      .then(setMenusWid)
      .catch(() => setMenusWid([]))
    setView('panel')
    // Mensaje de bienvenida para cuando entre a hablar con Isa
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
      const conv = await crearConversacion(userData.empresaId, userData.contactoId, {
        canal: CANAL_WIDGET_ISA,
      })
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
              tipo_emisor: 'IA360',
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
            tipo_emisor: 'IA360',
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
        <div
          className={
            isExpanded ? 'chatbot-window chatbot-window--expanded' : 'chatbot-window'
          }
        >
          {!isRegistered ? (
            <RegistrationForm
              onSubmit={handleRegistration}
              onClose={() => setIsOpen(false)}
              expanded={isExpanded}
              onToggleExpand={() => setIsExpanded((v) => !v)}
            />
          ) : view === 'panel' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Menú</h3>
                  <span className="status-indicator"></span>
                </div>
                <div className="chatbot-header-actions">
                  <ChatExpandToggleButton
                    expanded={isExpanded}
                    onToggle={() => setIsExpanded((v) => !v)}
                  />
                  <button
                    className="close-button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Cerrar chat"
                  >
                    ×
                  </button>
                </div>
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
                 // const baseUrl = (typeof window !== 'undefined' && window.location.port === '3002')
                  //  ? 'http://localhost:3009'
                   // : FAQ_URL
                   const baseUrl = FAQ_URL
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
                onCorregirDatos={handleCorregirIdentificacion}
                menusWid={menusWid}
                onSelectPrueba={async () => {
                  const mensajeAcceso =
                    'Acceso al Asistente Inteligente\n\nPara acceder al asistente inteligente debe validarse con su NIT y usuario en el chat de soporte. Abra el chatbot, ingrese el NIT de su empresa, valide el director (usuario) y seleccione la licencia. Luego pulse "Prueba" en el menú del chat.\n\nHasta entonces no podrá acceder a esta opción.'

                  if (!userData) {
                    setPanelFaqError(mensajeAcceso)
                    return
                  }
                  if (!userData.empresaId || !userData.contactoId) {
                    setPanelFaqError(mensajeAcceso)
                    return
                  }
                  const servicio = userData.licencia?.trim()
                  if (!servicio) {
                    setPanelFaqError(mensajeAcceso)
                    return
                  }

                  setPanelFaqError(null)
                  try {
                    const token = await obtenerTokenAccesoFAQ(
                      userData.empresaId,
                      userData.contactoId,
                      servicio
                    )
                    if (!token) {
                      setPanelFaqError(
                        'No se pudo obtener acceso. Verifique que el backend esté en ejecución y que haya completado el registro con NIT y director.'
                      )
                      return
                    }
                    if (IA360_USE_WIDGET) {
                      setIa360WidgetSession({ token, servicio })
                      setView('ia360')
                      return
                    }
                    const baseUrl = (import.meta.env.VITE_AGENTE_URL || 'http://localhost:8501').replace(/\/$/, '')
                    const params = new URLSearchParams()
                    params.set('servicio', servicio)
                    params.set('token', token)
                    window.open(`${baseUrl}/?${params.toString()}`, '_blank')
                  } catch {
                    setPanelFaqError(mensajeAcceso)
                  }
                }}
              />
            </>
          ) : view === 'faq' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Preguntas frecuentes</h3>
                </div>
                <div className="chatbot-header-actions">
                  <ChatExpandToggleButton
                    expanded={isExpanded}
                    onToggle={() => setIsExpanded((v) => !v)}
                  />
                  <button
                    className="close-button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Cerrar chat"
                  >
                    ×
                  </button>
                </div>
              </div>
              <PreguntasFrecuentes onBack={() => setView('panel')} />
            </>
          ) : view === 'agente' ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <h3>Chatear con agente</h3>
                </div>
                <div className="chatbot-header-actions">
                  <ChatExpandToggleButton
                    expanded={isExpanded}
                    onToggle={() => setIsExpanded((v) => !v)}
                  />
                  <div className="chatbot-header-agente-menu-wrap">
                    <button
                      ref={agenteMenuBtnRef}
                      type="button"
                      className="chatbot-header-more-button"
                      aria-haspopup="menu"
                      aria-expanded={agenteMenuOpen}
                      aria-controls="chatbot-agente-header-menu"
                      disabled={!agenteConvListo}
                      title={agenteConvListo ? 'Más opciones' : 'Esperando conversación…'}
                      aria-label="Más opciones del chat con agente"
                      onClick={() => {
                        setAgenteMenuOpen((was) => {
                          if (was) return false
                          updateAgenteMenuPosition()
                          return true
                        })
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                        <circle cx="12" cy="6" r="1.75" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.75" fill="currentColor" />
                        <circle cx="12" cy="18" r="1.75" fill="currentColor" />
                      </svg>
                    </button>
                  </div>
                  <button
                    className="close-button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Cerrar chat"
                  >
                    ×
                  </button>
                </div>
              </div>
              {agenteMenuOpen &&
                createPortal(
                  <div
                    ref={agenteMenuDropdownRef}
                    id="chatbot-agente-header-menu"
                    className="chatbot-agente-header-menu-dropdown"
                    role="menu"
                    style={{ position: 'fixed', top: agenteMenuPos.top, right: agenteMenuPos.right }}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="chatbot-agente-header-menu-item"
                      onClick={() => {
                        setAgenteMenuOpen(false)
                        chatAgenteRef.current?.solicitarCierreConversacion()
                      }}
                    >
                      Cerrar conversación
                    </button>
                  </div>,
                  document.body,
                )}
              <ChatAgente
                ref={chatAgenteRef}
                userData={userData!}
                onBack={() => setView('panel')}
                onBackFromClosed={handleCorregirIdentificacion}
                onConversacionReady={handleAgenteConvListo}
                onSolicitudCierreRegistrada={handleCorregirIdentificacion}
              />
            </>
          ) : view === 'ia360' && ia360WidgetSession ? (
            <>
              <div className="chatbot-header chatbot-header-panel">
                <div className="chatbot-header-content">
                  <VolverLink
                    variant="onDark"
                    onClick={() => {
                      setView('panel')
                      setIa360WidgetSession(null)
                    }}
                    ariaLabel="Volver al menú"
                    title="Volver al menú"
                  />
                  <h3>IA360 · documentación</h3>
                </div>
                <div className="chatbot-header-actions">
                  <ChatExpandToggleButton
                    expanded={isExpanded}
                    onToggle={() => setIsExpanded((v) => !v)}
                  />
                  <button
                    className="close-button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Cerrar chat"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="chatbot-ia360-body">
                <ChatIA360
                  userData={userData!}
                  token={ia360WidgetSession.token}
                  servicio={ia360WidgetSession.servicio}
                  onTokenRenewed={handleIa360TokenRenewed}
                />
              </div>
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
                <div className="chatbot-header-actions">
                  <ChatExpandToggleButton
                    expanded={isExpanded}
                    onToggle={() => setIsExpanded((v) => !v)}
                  />
                  <button
                    className="close-button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Cerrar chat"
                  >
                    ×
                  </button>
                </div>
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
          aria-label={TOGGLE_LABEL}
        >
          <ChatIcon />
          <span className="chatbot-toggle-text">{TOGGLE_LABEL}</span>
        </button>
      )}
    </div>
  )
}

export default Chatbot
