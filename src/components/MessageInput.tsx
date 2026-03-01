import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import './MessageInput.css'

interface MessageInputProps {
  onSendMessage: (text: string) => void
  disabled?: boolean
  /** Llamado al cambiar el texto (para que el CRM pueda ver lo que se está escribiendo en tiempo real) */
  onTextChange?: (text: string) => void
}

function MessageInput({ onSendMessage, disabled = false, onTextChange }: MessageInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setInputValue(v)
    onTextChange?.(v)
  }

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue.trim())
      setInputValue('')
    }
  }

  // Enter = enviar, Shift+Enter = nueva línea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input-container">
      <textarea
        ref={inputRef}
        className="message-input message-input-textarea"
        placeholder={disabled ? 'Esperando respuesta...' : 'Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)'}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
        rows={2}
      />
      <button
        className="send-button"
        onClick={handleSend}
        disabled={!inputValue.trim() || disabled}
        aria-label="Enviar mensaje"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  )
}

export default MessageInput


