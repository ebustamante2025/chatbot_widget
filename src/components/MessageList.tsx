import { useEffect, useRef } from 'react'
import { Message } from '../types'
import './MessageList.css'

// Detectar líneas con viñetas: emojis numerados, •, -, *, números con punto/paréntesis
const esLineaConViñeta = /^(\d️⃣|[•\-\*]|\d+[.)]\s)/

function renderMensaje(texto: string) {
  const lineas = texto.split(/\n/)
  const tieneViñetas = lineas.some((l) => esLineaConViñeta.test(l.trim()))

  if (!tieneViñetas && lineas.length <= 1) {
    return <span>{texto}</span>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lineas.map((linea, idx) => {
        const trimmed = linea.trim()
        if (!trimmed) return null

        const esViñeta = esLineaConViñeta.test(trimmed)

        return (
          <div
            key={idx}
            style={{
              paddingLeft: esViñeta ? 8 : 0,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 4,
            }}
          >
            <span>{trimmed}</span>
          </div>
        )
      })}
    </div>
  )
}

interface MessageListProps {
  messages: Message[]
}

function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageListRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    // Usar setTimeout para asegurar que el DOM se haya actualizado
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        })
      }
      // Fallback: scroll directo del contenedor
      if (messageListRef.current) {
        messageListRef.current.scrollTop = messageListRef.current.scrollHeight
      }
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="message-list" ref={messageListRef}>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message ${message.sender === 'user' ? 'message-user' : 'message-isa'}`}
        >
          <div className="message-content">
            <div className="message-text">{renderMensaje(message.text)}</div>
            <span className="message-time">
              {message.timestamp.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList

