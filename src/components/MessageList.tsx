import { useEffect, useRef } from 'react'
import { Message } from '../types'
import './MessageList.css'

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
            <p>{message.text}</p>
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

