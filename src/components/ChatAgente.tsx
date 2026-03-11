import { useState, useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  crearConversacion,
  enviarMensajeAgente,
  editarMensajeContacto,
  eliminarMensajeContacto,
  getBackendBaseUrl,
} from '../services/api'
import type { UserData } from '../types'
import MessageInput from './MessageInput'
import './ChatAgente.css'

const TYPING_DEBOUNCE_MS = 150
const EDICION_MENSAJE_MAX_MINUTOS = 3

/** Prefijo del mensaje automático "Solicito soporte para el servicio: X". Solo lo ve el asesor en el CRM, no en el widget. */
const PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR = 'Solicito soporte para el servicio:'

function esMensajeServicioSoloAsesor(contenido: string): boolean {
  return typeof contenido === 'string' && contenido.trim().startsWith(PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR)
}

type MensajeItem = { id_mensaje?: number | string; tipo_emisor: string; contenido: string; creado_en: string }

/** Mensaje del contacto con id real (número o string numérico del servidor), no temp-xxx */
function tieneIdRealParaEditar(m: MensajeItem): boolean {
  if (m.tipo_emisor !== 'CONTACTO') return false
  const id = m.id_mensaje
  if (id === undefined || id === null) return false
  const s = String(id)
  if (s.startsWith('temp')) return false
  return !Number.isNaN(Number(s))
}

function idMensajeNumerico(id: number | string | undefined): number | null {
  if (id === undefined || id === null) return null
  const n = Number(id)
  return Number.isNaN(n) ? null : n
}

function puedeEditarEliminar(creadoEn: string): boolean {
  const creado = new Date(creadoEn).getTime()
  const limite = Date.now() - EDICION_MENSAJE_MAX_MINUTOS * 60 * 1000
  return creado > limite
}

interface ChatAgenteProps {
  userData: UserData
  onBack: () => void
  /** Al salir de la pantalla "conversación cerrada": limpiar sesión para exigir de nuevo NIT y cédula del director */
  onBackFromClosed?: () => void
}

function ChatAgente({ userData, onBack, onBackFromClosed }: ChatAgenteProps) {
  const [conversacionId, setConversacionId] = useState<number | null>(null)
  const [mensajes, setMensajes] = useState<Array<MensajeItem>>([])
  const [enviando, setEnviando] = useState(false)
  const [conversacionCerrada, setConversacionCerrada] = useState(false)
  const [mensajeCierre, setMensajeCierre] = useState<string | null>(null)
  const [modalMensaje, setModalMensaje] = useState<MensajeItem | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; left: number } | null>(null)
  const [editandoMensaje, setEditandoMensaje] = useState<MensajeItem | null>(null)
  const [editandoContenido, setEditandoContenido] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [creando, setCreando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [messageInputKey, setMessageInputKey] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  // Una sola petición por apertura: reutilizar la misma promesa si el efecto se ejecuta dos veces (p. ej. Strict Mode)
  const initPromiseRef = useRef<Promise<{ id_conversacion: number; mensajes?: Array<{ id_mensaje?: number | string; tipo_emisor: string; contenido: string; creado_en: string }> }> | null>(null)
  const initKeyRef = useRef<string | null>(null)
  const servicioEnviadoParaConvRef = useRef<number | null>(null)

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
        // Ocultar en el widget el mensaje de servicio; solo lo ve el asesor en el CRM
        const lista = (conv.mensajes || []).filter(
          (m) => !(m.tipo_emisor === 'CONTACTO' && esMensajeServicioSoloAsesor(m.contenido))
        )
        setMensajes(lista)
        setConversacionCerrada((conv as { estado?: string }).estado === 'CERRADA')
        // Si la conversación está vacía y el usuario eligió un servicio, enviar como primer mensaje para que el agente sepa por qué solicita soporte
        const yaEnviado = servicioEnviadoParaConvRef.current === conv.id_conversacion
        if (!yaEnviado && (conv.mensajes?.length ?? 0) === 0 && userData.licencia?.trim()) {
          servicioEnviadoParaConvRef.current = conv.id_conversacion
          const texto = `Solicito soporte para el servicio: ${userData.licencia.trim()}`
          enviarMensajeAgente({
            empresa_id: eid,
            conversacion_id: conv.id_conversacion,
            tipo_emisor: 'CONTACTO',
            contacto_id: cid,
            contenido: texto,
          })
            .then(() => {
              // No añadimos el mensaje aquí: el backend emite new_message y el listener lo añade. Si lo añadiéramos, se duplicaría.
            })
            .catch(() => {})
        }
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
        // Polling primero, luego upgrade a WebSocket (igual que el CRM). Evita 400 cuando hay proxy nginx.
    const socket = io(getBackendBaseUrl(), { path: '/socket.io', transports: ['polling', 'websocket'] })
    socketRef.current = socket
    const joinRoom = () => socket.emit('join_conversation', Number(conversacionId))
    socket.on('connect', joinRoom)
    if (socket.connected) joinRoom()
    socket.on('new_message', (mensaje: { id_mensaje?: number; tipo_emisor: string; contenido: string; creado_en: string }) => {
      // No mostrar en el widget el mensaje automático de servicio; solo lo ve el asesor en el CRM
      if (mensaje.tipo_emisor === 'CONTACTO' && esMensajeServicioSoloAsesor(mensaje.contenido)) {
        return
      }
      setMensajes((prev) => {
        if (mensaje.id_mensaje && prev.some((m) => m.id_mensaje === mensaje.id_mensaje)) return prev
        const ultimo = prev[prev.length - 1]
        const esNuestroTemp = ultimo && typeof ultimo.id_mensaje === 'string' && ultimo.contenido === mensaje.contenido && mensaje.tipo_emisor === 'CONTACTO'
        if (esNuestroTemp) return [...prev.slice(0, -1), { ...mensaje, id_mensaje: mensaje.id_mensaje }]
        return [...prev, mensaje]
      })
    })
    socket.on('conversation_updated', (data: { id_conversacion?: number; estado?: string }) => {
      if (data.id_conversacion !== Number(conversacionId)) return
      if (data.estado === 'CERRADA') {
        setConversacionCerrada(true)
        setMensajes([])
      }
    })
    socket.on('conversation_closed', (data: { id_conversacion?: number; estado?: string; mensaje_cierre?: string }) => {
      if (data.id_conversacion !== Number(conversacionId)) return
      if (data.estado === 'CERRADA') {
        if (data.mensaje_cierre) setMensajeCierre(data.mensaje_cierre)
        setConversacionCerrada(true)
        setMensajes([])
      }
    })
    socket.on('message_updated', (mensaje: { id_mensaje?: number; tipo_emisor: string; contenido: string; creado_en: string }) => {
      const idNum = idMensajeNumerico(mensaje.id_mensaje)
      if (idNum === null) return
      setMensajes((prev) =>
        prev.map((m) => (idMensajeNumerico(m.id_mensaje) === idNum ? { ...m, ...mensaje } : m))
      )
      setModalMensaje(null)
      setMenuAnchor(null)
      setEditandoMensaje(null)
    })
    socket.on('message_deleted', (data: { id_mensaje: number; conversacion_id?: number }) => {
      const idNum = idMensajeNumerico(data.id_mensaje)
      if (idNum === null) return
      setMensajes((prev) => prev.filter((m) => idMensajeNumerico(m.id_mensaje) !== idNum))
      setModalMensaje(null)
      setMenuAnchor(null)
      setEditandoMensaje(null)
    })
    // El indicador "está escribiendo" se muestra solo en el CRM de soporte (no en el widget)
    return () => {
      socketRef.current = null
      socket.emit('leave_conversation', Number(conversacionId))
      socket.emit('typing_stop', { conversacionId: Number(conversacionId) })
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

  // Enviar al CRM lo que el contacto está escribiendo (debounce) para que el agente lo vea en tiempo real
  const handleTyping = useCallback(
    (texto: string) => {
      if (!conversacionId) return
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      const trim = texto.trim()
      if (!trim) {
        socketRef.current?.emit('typing_stop', { conversacionId: Number(conversacionId) })
        return
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', { conversacionId: Number(conversacionId), quien: 'contacto', texto: trim })
      }, TYPING_DEBOUNCE_MS)
    },
    [conversacionId]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  const handleEnviar = async (contenido: string) => {
    if (!contenido.trim() || !conversacionId || !empresaId || !contactoId || enviando) return
    if (editandoMensaje) {
      await handleGuardarEdicion(contenido)
      return
    }

    socketRef.current?.emit('typing_stop', { conversacionId: Number(conversacionId) })

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

  const abrirModalMensaje = (m: MensajeItem, e: React.MouseEvent) => {
    if (m.tipo_emisor !== 'CONTACTO') return
    if (!tieneIdRealParaEditar(m)) return
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuAnchor({ top: rect.bottom + 4, left: Math.max(8, rect.right - 180) })
    setModalMensaje(m)
    setEditandoMensaje(null)
    setEditandoContenido('')
  }

  const cerrarModal = () => {
    setModalMensaje(null)
    setMenuAnchor(null)
    setEditandoMensaje(null)
    setEditandoContenido('')
  }

  const handleEditarClick = () => {
    if (!modalMensaje) return
    setEditandoMensaje(modalMensaje)
    setEditandoContenido(modalMensaje.contenido)
    setModalMensaje(null)
  }

  const handleGuardarEdicion = async (contenidoActual?: string) => {
    const contenido = (contenidoActual ?? editandoContenido).trim()
    const idNum = editandoMensaje ? idMensajeNumerico(editandoMensaje.id_mensaje) : null
    if (!editandoMensaje || !conversacionId || !empresaId || !contactoId || idNum === null || !contenido) return
    setGuardandoEdicion(true)
    try {
      await editarMensajeContacto({
        id_mensaje: idNum,
        empresa_id: Number(empresaId),
        conversacion_id: Number(conversacionId),
        contacto_id: Number(contactoId),
        contenido,
      })
      setMensajes((prev) =>
        prev.map((m) => (idMensajeNumerico(m.id_mensaje) === idNum ? { ...m, contenido } : m))
      )
      cerrarModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al editar')
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const handleEliminarClick = async () => {
    const idNum = modalMensaje ? idMensajeNumerico(modalMensaje.id_mensaje) : null
    if (!modalMensaje || idNum === null || !empresaId || !contactoId || !conversacionId) return
    setEliminando(true)
    try {
      await eliminarMensajeContacto({
        id_mensaje: idNum,
        empresa_id: Number(empresaId),
        conversacion_id: Number(conversacionId),
        contacto_id: Number(contactoId),
      })
      setMensajes((prev) => prev.filter((m) => idMensajeNumerico(m.id_mensaje) !== idNum))
      cerrarModal()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setEliminando(false)
    }
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

  const mensajeDespedida =
    mensajeCierre ||
    'Muchas gracias por haberse comunicado con el área de soporte de HGI. Fue un gusto atenderle. Hasta una próxima oportunidad.'

  if (conversacionCerrada) {
    const handleVolverCerrada = () => {
      if (onBackFromClosed) onBackFromClosed()
      else onBack()
    }
    return (
      <div className="chat-agente chat-agente--cerrada">
        <button type="button" className="chat-agente-back" onClick={handleVolverCerrada} aria-label="Volver y validar de nuevo">
          ← Volver
        </button>
        <div className="chat-agente-content">
          <div className="chat-agente-icon">🙏</div>
          <h3 className="chat-agente-title">Conversación cerrada</h3>
          <p className="chat-agente-text chat-agente-text--despedida">
            {mensajeDespedida}
          </p>
          <p className="chat-agente-hint">
            Si necesitas más ayuda, deberás ingresar de nuevo tu NIT y cédula del director para iniciar una nueva conversación.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-agente chat-agente--conversacion">
      <button
        type="button"
        className="chat-agente-back"
        onClick={() => {
          setMessageInputKey((k) => k + 1)
          onBack()
        }}
        aria-label="Volver al menú"
      >
        ← Volver
      </button>
      <div className="chat-agente-mensajes" ref={listRef}>
        <p className="chat-agente-registro-info">
          ¡Hola, <strong>{userData.funcionario}</strong>! De la empresa <strong>"{userData.empresa}"</strong>. En el momento se encuentra en cola de atención. Un agente de soporte recibirá tu conversación y te atenderá lo más pronto posible por este chat.
        </p>
        {mensajes.length === 0 ? (
          <p className="chat-agente-hint-inline">Escribe tu mensaje abajo y pulsa Enviar. Un agente te responderá en breve.</p>
        ) : (
          <>
            {mensajes.map((m, i) => (
              <div
                key={typeof m.id_mensaje !== 'undefined' ? String(m.id_mensaje) : `msg-${i}`}
                className={`chat-agente-msg chat-agente-msg--${m.tipo_emisor.toLowerCase()} ${tieneIdRealParaEditar(m) ? 'chat-agente-msg--acciones' : ''}`}
                onClick={tieneIdRealParaEditar(m) ? (e) => abrirModalMensaje(m, e) : undefined}
                role={tieneIdRealParaEditar(m) ? 'button' : undefined}
                aria-label={tieneIdRealParaEditar(m) ? 'Opciones del mensaje' : undefined}
              >
                <span className="chat-agente-msg-text">{m.contenido}</span>
                <span className="chat-agente-msg-meta">
                  {tieneIdRealParaEditar(m) && (
                    <span className="chat-agente-msg-flecha" aria-hidden>▼</span>
                  )}
                  <span className="chat-agente-msg-hora">{formatearHora(m.creado_en)}</span>
                </span>
              </div>
            ))}
          </>
        )}
      </div>
      <div className="chat-agente-input">
        <MessageInput
          key={messageInputKey}
          onSendMessage={handleEnviar}
          onSaveEdit={handleGuardarEdicion}
          disabled={enviando || guardandoEdicion}
          onTextChange={editandoMensaje ? undefined : handleTyping}
          editMode={!!editandoMensaje}
          value={editandoMensaje ? editandoContenido : undefined}
          onChange={editandoMensaje ? setEditandoContenido : undefined}
          onCancelEdit={editandoMensaje ? () => { setEditandoMensaje(null); setEditandoContenido('') } : undefined}
        />
      </div>

      {modalMensaje && menuAnchor && (
        <>
          <div className="chat-agente-menu-backdrop" onClick={cerrarModal} aria-hidden="true" />
          <div
            className="chat-agente-menu"
            role="menu"
            aria-label="Opciones del mensaje"
            style={{ top: menuAnchor.top, left: menuAnchor.left }}
          >
            <button
              type="button"
              role="menuitem"
              className="chat-agente-menu-item chat-agente-menu-item--editar"
              onClick={() => { handleEditarClick(); }}
              disabled={!puedeEditarEliminar(modalMensaje.creado_en)}
              title={!puedeEditarEliminar(modalMensaje.creado_en) ? 'Solo puedes editar durante 3 minutos después de enviar' : 'Editar mensaje'}
            >
              <svg className="chat-agente-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
            <button
              type="button"
              role="menuitem"
              className="chat-agente-menu-item chat-agente-menu-item--eliminar"
              onClick={() => handleEliminarClick()}
              disabled={!puedeEditarEliminar(modalMensaje.creado_en) || eliminando}
              title={!puedeEditarEliminar(modalMensaje.creado_en) ? 'Solo puedes eliminar durante 3 minutos después de enviar' : 'Eliminar mensaje'}
            >
              <svg className="chat-agente-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              {eliminando ? 'Eliminando...' : 'Eliminar'}
            </button>
            {!puedeEditarEliminar(modalMensaje.creado_en) && (
              <p className="chat-agente-menu-hint">Solo durante 3 min después de enviar</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ChatAgente
