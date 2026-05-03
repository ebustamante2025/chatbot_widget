import { UserData } from '../types'
import { type MenuWid } from '../services/api'
import ChatIcon from './ChatIcon'
import { VolverLink } from './VolverLink'
import iconoAgente from '../assets/icono-agente.png'
import './WelcomePanel.css'

interface WelcomePanelProps {
  userData: UserData
  faqError?: string | null
  onSelectPreguntasFrecuentes: () => void
  onSelectChatearIsa: () => void
  onSelectChatearAgente: () => void
  onSelectPrueba?: () => void
  /** Volver a validar NIT, director y licencia (p. ej. se equivocó de empresa). */
  onCorregirDatos?: () => void
  /** Opciones de menú cargadas desde menus_wid. Si está vacío se muestran todos. */
  menusWid?: MenuWid[]
}

function WelcomePanel({
  userData,
  faqError,
  onSelectPreguntasFrecuentes,
  onSelectChatearIsa,
  onSelectChatearAgente,
  onSelectPrueba,
  onCorregirDatos,
  menusWid = [],
}: WelcomePanelProps) {
  const menuActivo = (clave: string): boolean => {
    if (menusWid.length === 0) return true  // sin datos = mostrar todo
    const fila = menusWid.find((m) => m.clave === clave)
    return fila ? fila.activo : true
  }
  return (
    <div className={`welcome-panel${onCorregirDatos ? ' welcome-panel--volver-arriba' : ''}`}>
      {onCorregirDatos && (
        <div className="welcome-panel-volver-bar">
          <VolverLink
            onClick={onCorregirDatos}
            ariaLabel="Volver al registro para corregir NIT y verificar de nuevo"
            title="Volver al registro para corregir NIT y verificar de nuevo"
          />
        </div>
      )}
      <div className="welcome-panel-greeting">
        <p className="welcome-panel-title">Hola, {userData.funcionario}</p>
        <p className="welcome-panel-subtitle">{userData.empresa}</p>
      </div>
      <p className="welcome-panel-choose">¿Cómo podemos ayudarte?</p>
      {faqError && (
        <div className="welcome-panel-error">
          {faqError.split('\n').map((line, index) => {
            if (line.trim() === '') return <br key={index} />
            if (line.includes('Acceso al Asistente Inteligente')) {
              return <h3 key={index} style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>{line}</h3>
            }
            return <p key={index} style={{ margin: '0 0 8px 0' }}>{line}</p>
          })}
        </div>
      )}
      <div className="welcome-panel-options">
        {menuActivo('frecuentes') && (
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
        )}
        {menuActivo('bot') && (
          <button
            type="button"
            className="welcome-panel-option welcome-panel-option-agente-isa"
            onClick={onSelectChatearIsa}
            aria-label="Hablar con Isa"
          >
            <span className="welcome-panel-option-avatar">
              <ChatIcon />
            </span>
            <span className="welcome-panel-option-label">Hablar con Isa</span>
            <span className="welcome-panel-option-desc">Isa · Asistente virtual inteligente 24/7</span>
          </button>
        )}
        {menuActivo('agente') && (
          <button
            type="button"
            className="welcome-panel-option"
            onClick={onSelectChatearAgente}
            aria-label="Chatear con un agente"
          >
            <span className="welcome-panel-option-avatar welcome-panel-option-avatar--img">
              <img src={iconoAgente} alt="Agente de soporte" className="welcome-panel-option-img" />
            </span>
            <span className="welcome-panel-option-label">Chatear con un agente</span>
            <span className="welcome-panel-option-desc">Atención humana en vivo</span>
          </button>
        )}
        {menuActivo('prueba') && onSelectPrueba && (
          <button
            type="button"
            className="welcome-panel-option"
            onClick={onSelectPrueba}
            aria-label="Prueba"
          >
            <span className="welcome-panel-option-icon">🧪</span>
            <span className="welcome-panel-option-label">Prueba</span>
            <span className="welcome-panel-option-desc">Opción de prueba</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default WelcomePanel
