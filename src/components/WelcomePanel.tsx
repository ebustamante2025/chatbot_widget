import { UserData } from '../types'
import ChatIcon from './ChatIcon'
import './WelcomePanel.css'

interface WelcomePanelProps {
  userData: UserData
  onSelectPreguntasFrecuentes: () => void
  onSelectChatearIsa: () => void
  onSelectChatearAgente: () => void
}

function WelcomePanel({
  userData,
  onSelectPreguntasFrecuentes,
  onSelectChatearIsa,
  onSelectChatearAgente,
}: WelcomePanelProps) {
  return (
    <div className="welcome-panel">
      <div className="welcome-panel-greeting">
        <p className="welcome-panel-title">Hola, {userData.funcionario}</p>
        <p className="welcome-panel-subtitle">{userData.empresa}</p>
      </div>
      <p className="welcome-panel-choose">¿Cómo podemos ayudarte?</p>
      <div className="welcome-panel-options">
        <button
          type="button"
          className="welcome-panel-option"
          onClick={onSelectPreguntasFrecuentes}
          aria-label="Ver preguntas frecuentes"
        >
          <span className="welcome-panel-option-icon">❓</span>
          <span className="welcome-panel-option-label">Preguntas frecuentes</span>
          <span className="welcome-panel-option-desc">Consulta respuestas rápidas</span>
        </button>
        <button
          type="button"
          className="welcome-panel-option welcome-panel-option-isa"
          onClick={onSelectChatearIsa}
          aria-label="Chatear con Isa"
        >
          <span className="welcome-panel-option-avatar">
            <ChatIcon />
          </span>
          <span className="welcome-panel-option-label">Chatear con Isa</span>
          <span className="welcome-panel-option-desc">Asistente virtual 24/7</span>
        </button>
        <button
          type="button"
          className="welcome-panel-option"
          onClick={onSelectChatearAgente}
          aria-label="Chatear con un agente"
        >
          <span className="welcome-panel-option-icon">👤</span>
          <span className="welcome-panel-option-label">Chatear con un agente</span>
          <span className="welcome-panel-option-desc">Atención humana en vivo</span>
        </button>
      </div>
    </div>
  )
}

export default WelcomePanel
