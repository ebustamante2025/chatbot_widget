import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import './MessageInput.css'

interface MessageInputProps {
  onSendMessage: (text: string) => void
  disabled?: boolean
  /** Llamado al cambiar el texto (para que el CRM pueda ver lo que se está escribiendo en tiempo real) */
  onTextChange?: (text: string) => void
  /** Modo edición: muestra el texto a editar y botón "Guardar" / "Cancelar" */
  editMode?: boolean
  /** Valor controlado en modo edición */
  value?: string
  /** Cambios en modo edición */
  onChange?: (value: string) => void
  /** Al cancelar la edición */
  onCancelEdit?: () => void
  /** Al pulsar el botón verde en modo edición: guardar/actualizar el mensaje con el texto actual */
  onSaveEdit?: (text: string) => void
}

function MessageInput({ onSendMessage, disabled = false, onTextChange, editMode = false, value, onChange, onCancelEdit, onSaveEdit }: MessageInputProps) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isControlled = editMode && value !== undefined && onChange !== undefined
  const displayValue = isControlled ? value : inputValue

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    if (isControlled) onChange(v)
    else {
      setInputValue(v)
      onTextChange?.(v)
    }
  }

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  useEffect(() => {
    if (editMode && value !== undefined) {
      inputRef.current?.focus()
    }
  }, [editMode, value])

  const handleSend = () => {
    const text = (isControlled ? value : inputValue).trim()
    if (!text || disabled) return
    if (editMode && onSaveEdit) {
      onSaveEdit(text)
      return
    }
    onSendMessage(text)
    if (!isControlled) setInputValue('')
  }

  // Enter = enviar, Shift+Enter = nueva línea
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`message-input-container ${editMode ? 'message-input-container--edit' : ''}`}>
      {editMode && onCancelEdit && (
        <button type="button" className="message-input-btn-icon message-input-cancel" onClick={onCancelEdit} aria-label="Cancelar edición" title="Cancelar">
          <svg className="message-input-icon-cancel" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ width: 20, height: 20, display: 'block', flexShrink: 0 }}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <textarea
        ref={inputRef}
        className="message-input message-input-textarea"
        placeholder={disabled ? 'Esperando respuesta...' : editMode ? 'Edita tu mensaje...' : 'Escribe tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)'}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
        rows={2}
      />
      <button
        className="send-button"
        onClick={handleSend}
        disabled={(isControlled ? !(value?.trim()) : !inputValue.trim()) || disabled}
        aria-label={editMode ? 'Guardar cambios' : 'Enviar mensaje'}
        title={editMode ? 'Guardar' : undefined}
      >
        {editMode ? (
          <svg className="message-input-icon-guardar" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            className="message-input-icon-send"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default MessageInput


