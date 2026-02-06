import { useState, useRef } from 'react'
import ChatIcon from './ChatIcon'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import RegistrationForm from './RegistrationForm'
import WelcomePanel from './WelcomePanel'
import PreguntasFrecuentes from './PreguntasFrecuentes'
import ChatAgente from './ChatAgente'
import { Message, UserData } from '../types'
import { sendMessageToIsaAgent } from '../services/api'
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

  const handleRegistration = (data: UserData) => {
    setUserData(data)
    setIsRegistered(true)
    setView('panel')
    // Mensaje de bienvenida para cuando entre a chatear con Isa
    const welcomeMessage: Message = {
      id: '1',
      text: `¡Hola ${data.funcionario} de ${data.empresa}! 👋
    Soy ${AGENT_NAME}, tu asistente virtual.
    
    Por favor elige una opción escribiendo el número correspondiente:
    
    1️⃣ Nómina  
    2️⃣ Administrativo  
    3️⃣ Post  
    4️⃣ Contable  
    
    ¿En qué puedo ayudarte hoy?`,
      sender: 'isa',
      timestamp: new Date()
    }
    
    setMessages([welcomeMessage])
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
                onSelectChatearIsa={() => setView('isa')}
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

