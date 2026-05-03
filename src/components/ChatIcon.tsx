import './ChatIcon.css'
import iconoChatbotBlancoUrl from '../assets/icono_chatbot_blanco.png?url'

const MASK_STYLE = {
  WebkitMaskImage: `url(${iconoChatbotBlancoUrl})`,
  maskImage: `url(${iconoChatbotBlancoUrl})`,
} as const

/**
 * Máscara por luminancia del PNG + fondo blanco: la silueta blanca se ve sobre el azul del botón
 * sin mezclar el gris del “mate” como `mix-blend-mode: luminosity`.
 */
function ChatIcon() {
  return (
    <span
      className="chat-icon chat-icon-surface"
      style={MASK_STYLE}
      aria-hidden
      role="img"
    />
  )
}

export default ChatIcon
