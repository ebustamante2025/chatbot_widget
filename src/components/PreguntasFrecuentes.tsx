import { useState } from 'react'
import { VolverLink } from './VolverLink'
import './PreguntasFrecuentes.css'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: string
}

const FAQ_DATA: FaqItem[] = [
  {
    id: '1',
    pregunta: '¿Cómo puedo contactar soporte?',
    respuesta: 'Puedes escribirle a Isa en el chat o solicitar hablar con un agente. También puedes enviar un correo a soporte@empresa.com.',
  },
  {
    id: '2',
    pregunta: '¿Cuáles son los horarios de atención?',
    respuesta: 'Isa está disponible 24/7. Los agentes humanos atienden en horario de lunes a viernes, 8:00 a 18:00.',
  },
  {
    id: '3',
    pregunta: '¿Cómo cambio mis datos de contacto?',
    respuesta: 'Solicita a un agente la actualización de tus datos o escríbenos a soporte indicando los cambios necesarios.',
  },
  {
    id: '4',
    pregunta: '¿Dónde veo el estado de mi solicitud?',
    respuesta: 'Puedes preguntarle a Isa por el estado de tu solicitud o revisar el correo que te enviamos con el número de seguimiento.',
  },
]

interface PreguntasFrecuentesProps {
  onBack: () => void
}

function PreguntasFrecuentes({ onBack }: PreguntasFrecuentesProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="preguntas-frecuentes">
      <VolverLink onClick={onBack} ariaLabel="Volver al menú" title="Volver al menú" className="preguntas-frecuentes-volver" />
      <h3 className="preguntas-frecuentes-title">Preguntas frecuentes</h3>
      <div className="preguntas-frecuentes-list">
        {FAQ_DATA.map((item) => (
          <div
            key={item.id}
            className={`preguntas-frecuentes-item ${openId === item.id ? 'open' : ''}`}
          >
            <button
              type="button"
              className="preguntas-frecuentes-question"
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              aria-expanded={openId === item.id}
            >
              <span>{item.pregunta}</span>
              <span className="preguntas-frecuentes-chevron">{openId === item.id ? '▲' : '▼'}</span>
            </button>
            {openId === item.id && (
              <div className="preguntas-frecuentes-answer">{item.respuesta}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default PreguntasFrecuentes
