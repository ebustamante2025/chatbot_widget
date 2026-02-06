import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import './MessageInput.css'

interface MessageInputProps {
  onSendMessage: (text: string) => void
  disabled?: boolean
}

function MessageInput({ onSendMessage, disabled = false }: MessageInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Mantener el foco en el input para escribir (al montar y cuando vuelve a estar habilitado)
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  const handleSend = () => {
    if (inputValue.trim() && !disabled) {
      onSendMessage(inputValue)
      setInputValue('')
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="message-input-container">
      <input
        ref={inputRef}
        type="text"
        className="message-input"
        placeholder={disabled ? 'Esperando respuesta...' : 'Escribe tu mensaje...'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={disabled}
        autoFocus
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


