import { useState, useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  crearConversacion,
  enviarMensajeAgente,
  getBackendBaseUrl,
} from '../services/api'
import type { UserData } from '../types'
import './ChatAgente.css'

const TYPING_DEBOUNCE_MS = 400
const TYPING_STOP_MS = 2000

interface ChatAgenteProps {
  userData: UserData
  onBack: () => void
}

function ChatAgente({ userData, onBack }: ChatAgenteProps) {
  const [conversacionId, setConversacionId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<Array<{ id_mensaje?: number | string; tipo_emisor: string; contenido: string; creado_en: string }>>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [creando, setCreando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agenteEscribiendo, setAgenteEscribiendo] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Una sola petición por apertura: reutilizar la misma promesa si el efecto se ejecuta dos veces (p. ej. Strict Mode)
  const initPromiseRef = useRef<Promise<{ id_conversacion: number; mensajes?: Array<{ id_mensaje?: number | string; tipo_emisor: string; contenido: string; creado_en: string }> }> | null>(null)
  const initKeyRef = useRef<string | null>(null)

  const empresaId = userData.empresaId
  const contactoId = userData.contactoId

  useEffect(() => {
    if (!empresaId || !contactoId) {
      setCreando(false)
      return
    }

    let cancelled = false
    const eid = empresaId
    const cid = contactoId
    const key = `${eid}_${cid}`

    if (initKeyRef.current !== key) {
      initKeyRef.current = key
      initPromiseRef.current = crearConversacion(eid, cid)
    }
    const promise = initPromiseRef.current
    if (!promise) {
      setCreando(false)
      return
    }

    promise
      .then((conv) => {
        if (cancelled) return
        setConversacionId(conv.id_conversacion)
        setMensajes(conv.mensajes || [])
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al conectar')
      })
      .finally(() => {
        if (!cancelled) setCreando(false)
      })

    return () => { cancelled = true }
  }, [empresaId, contactoId])

  // WebSocket: tiempo real para mensajes y "está escribiendo"
  useEffect(() => {
    if (!conversacionId) return
    const socket = io(getBackendBaseUrl(), { path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket
    const joinRoom = () => socket.emit('join_conversation', conversacionId)
    socket.on('connect', joinRoom)
    if (socket.connected) joinRoom()
    socket.on('new_message', (mensaje: { id_mensaje?: number; tipo_emisor: string; contenido: string; creado_en: string }) => {
      setMensajes((prev) => {
        if (mensaje.id_mensaje && prev.some((m) => m.id_mensaje === mensaje.id_mensaje)) return prev
        const ultimo = prev[prev.length - 1]
        const esNuestroTemp = ultimo && typeof ultimo.id_mensaje === 'string' && ultimo.contenido === mensaje.contenido && mensaje.tipo_emisor === 'CONTACTO'
        if (esNuestroTemp) return [...prev.slice(0, -1), { ...mensaje, id_mensaje: mensaje.id_mensaje }]
        return [...prev, mensaje]
      })
    })
    socket.on('user_typing', (data: { quien?: string }) => {
      if (data?.quien === 'agente') setAgenteEscribiendo(true)
    })
    socket.on('user_typing_stop', () => setAgenteEscribiendo(false))
    return () => {
      socketRef.current = null
      socket.emit('leave_conversation', conversacionId)
      socket.emit('typing_stop', { conversacionId })
      socket.disconnect()
    }
  }, [conversacionId])

  // Scroll automático al final cuando llegan nuevos mensajes
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [mensajes])

  // Emitir "está escribiendo" al CRM cuando el usuario escribe (debounce)
  useEffect(() => {
    if (!conversacionId) return
    if (!texto.trim()) {
      socketRef.current?.emit('typing_stop', { conversacionId })
      return
    }
    const t = setTimeout(() => {
      socketRef.current?.emit('typing', { conversacionId, quien: 'contacto' })
      typingStopRef.current = setTimeout(() => {
        socketRef.current?.emit('typing_stop', { conversacionId })
        typingStopRef.current = null
      }, TYPING_STOP_MS)
    }, TYPING_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      if (typingStopRef.current) {
        clearTimeout(typingStopRef.current)
        typingStopRef.current = null
      }
    }
  }, [conversacionId, texto])

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || !conversacionId || !empresaId || !contactoId || enviando) return

    const contenido = texto.trim()
    setTexto('')
    socketRef.current?.emit('typing_stop', { conversacionId })

    const tempId = `temp-${Date.now()}`
    const ahora = new Date().toISOString()
    setMensajes((prev) => [...prev, { id_mensaje: tempId, tipo_emisor: 'CONTACTO', contenido, creado_en: ahora }])
    setEnviando(true)
    try {
      await enviarMensajeAgente({
        empresa_id: Number(empresaId),
        conversacion_id: Number(conversacionId),
        tipo_emisor: 'CONTACTO',
        contacto_id: Number(contactoId),
        contenido,
      })
      // El mensaje se muestra ya en la lista; el servidor emite new_message y reemplazamos el temp por el real
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
      setMensajes((prev) => prev.filter((m) => m.id_mensaje !== tempId))
    } finally {
      setEnviando(false)
    }
  }

  const formatearHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  }

  if (!empresaId || !contactoId) {
    return (
      <div className="chat-agente">
        <button type="button" className="chat-agente-back" onClick={onBack} aria-label="Volver al menú">
          ← Volver
        </button>
        <div className="chat-agente-content">
          <div className="chat-agente-icon">👤</div>
          <h3 className="chat-agente-title">Chatear con un agente</h3>
          <p className="chat-agente-text">
            Hola {userData.funcionario}, un agente humano te atenderá en breve. Por favor espera mientras te
            conectamos.
          </p>
          <p className="chat-agente-hint">
            Horario de agentes: Lunes a viernes, 8:00 - 18:00.
          </p>
          <div className="chat-agente-status">
            <span className="chat-agente-status-dot" />
            En cola de atención
          </div>
        </div>
      </div>
    )
  }

  if (creando) {
    return (
      <div className="chat-agente">
        <button type="button" className="chat-agente-back" onClick={onBack} aria-label="Volver al menú">
          ← Volver
        </button>
        <div className="chat-agente-content">
          <div className="chat-agente-loading">Conectando con un agente...</div>
        </div>
      </div>
    )
  }

  if (error && !conversacionId) {
    return (
      <div className="chat-agente">
        <button type="button" className="chat-agente-back" onClick={onBack} aria-label="Volver al menú">
          ← Volver
        </button>
        <div className="chat-agente-content">
          <p className="chat-agente-error">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-agente chat-agente--conversacion">
      <button type="button" className="chat-agente-back" onClick={onBack} aria-label="Volver al menú">
        ← Volver
      </button>
      <div className="chat-agente-mensajes" ref={listRef}>
        <p className="chat-agente-registro-info">
          Estás registrado como <strong>{userData.funcionario}</strong>. Envía un mensaje y un agente de soporte recibirá tu conversación y te atenderá por este chat.
        </p>
        {mensajes.length === 0 ? (
          <p className="chat-agente-hint-inline">Escribe tu mensaje abajo y pulsa Enviar. Un agente te responderá en breve.</p>
        ) : (
          <>
            {mensajes.map((m, i) => (
              <div
                key={typeof m.id_mensaje !== 'undefined' ? String(m.id_mensaje) : `msg-${i}`}
                className={`chat-agente-msg chat-agente-msg--${m.tipo_emisor.toLowerCase()}`}
              >
                <span className="chat-agente-msg-text">{m.contenido}</span>
                <span className="chat-agente-msg-hora">{formatearHora(m.creado_en)}</span>
              </div>
            ))}
            {agenteEscribiendo && (
              <div className="chat-agente-msg chat-agente-msg--agente chat-agente-typing">
                <span className="chat-agente-msg-text">Agente está escribiendo...</span>
              </div>
            )}
          </>
        )}
      </div>
      <form className="chat-agente-input" onSubmit={handleEnviar}>
        <input
          type="text"
          placeholder="Escribe tu mensaje..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={enviando}
        />
        <button type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
      </form>
    </div>
  )
}

export default ChatAgente
