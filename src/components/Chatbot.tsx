import { useState, useRef } from 'react'
import ChatIcon from './ChatIcon'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import RegistrationForm from './RegistrationForm'
import WelcomePanel from './WelcomePanel'
import PreguntasFrecuentes from './PreguntasFrecuentes'
import ChatAgente from './ChatAgente'
import { Message, UserData } from '../types'
import { sendMessageToIsaAgent, crearConversacion, guardarMensajeBD } from '../services/api'
import './Chatbot.css'

const AGENT_NAME = 'Isa'

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
  const isaSessionIdRef = useRef<string>(generateSessionId())
  // Conversación en BD para el chat con Isa
  const isaConversacionIdRef = useRef<number | null>(null)
  const creandoConversacionRef = useRef<boolean>(false)

  const handleRegistration = (data: UserData) => {
    setUserData(data)
    setIsRegistered(true)
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
                onSelectPreguntasFrecuentes={() => setView('faq')}
                onSelectChatearIsa={handleSelectChatearIsa}
                onSelectChatearAgente={() => setView('agente')}
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
              <ChatAgente userData={userData!} onBack={() => setView('panel')} />
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
