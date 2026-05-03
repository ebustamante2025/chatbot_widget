import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { io, type Socket } from 'socket.io-client'
import {
  crearConversacion,
  CANAL_WIDGET_AGENTE,
  enviarMensajeAgente,
  editarMensajeContacto,
  eliminarMensajeContacto,
  getBackendBaseUrl,
  solicitarCierreSoporteDesdeWidget,
  heartbeatActividadClienteWidget,
  type Conversacion,
} from '../services/api'
import type { UserData } from '../types'
import MessageInput from './MessageInput'
import { VolverLink } from './VolverLink'
import hgi360Logo from '../assets/hgi360-logo.png'
import './ChatAgente.css'

/** Logo HGI360 en pantallas de conversación cerrada (sustituye el emoji anterior). */
function MarcaHgi360Cierre() {
  return (
    <div className="chat-agente-marca-logo-wrap">
      <img src={hgi360Logo} alt="HGI 360" className="chat-agente-marca-logo" />
    </div>
  )
}

const TYPING_DEBOUNCE_MS = 150
/** Mínimo entre heartbeats de inactividad al escribir (sin enviar), para no saturar el API. */
const HEARTBEAT_INACTIVIDAD_TYPING_MS = 8000
const EDICION_MENSAJE_MAX_MINUTOS = 3

/** Prefijo del mensaje automático de licencia/servicio (evitar duplicar el envío al pasar a ASIGNADA). */
const PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR = 'Solicito soporte para el servicio:'
/** Mensajes marcados con este prefijo son solo para el CRM; el widget los filtra y no los muestra al cliente. */
const PREFIJO_SOLO_ASESOR = '[solo-asesor]'

function esMensajeServicioSoloAsesor(contenido: string): boolean {
  return typeof contenido === 'string' && contenido.trim().startsWith(PREFIJO_MENSAJE_SERVICIO_SOLO_ASESOR)
}

type MensajeItem = { id_mensaje?: number | string; tipo_emisor: string; contenido: string; creado_en: string }

/** Mensaje del contacto con id real (número o string numérico del servidor), no temp-xxx, y que no sea automático */
function tieneIdRealParaEditar(m: MensajeItem): boolean {
  if (m.tipo_emisor !== 'CONTACTO') return false
  const id = m.id_mensaje
  if (id === undefined || id === null) return false
  const s = String(id)
  if (s.startsWith('temp')) return false
  if (esMensajeServicioSoloAsesor(m.contenido)) return false
  return !Number.isNaN(Number(s))
}

function idMensajeNumerico(id: number | string | undefined): number | null {
  if (id === undefined || id === null) return null
  const n = Number(id)
  return Number.isNaN(n) ? null : n
}

const TEXTO_CONFIRMACION_CIERRE_CON_WIDGET =
  'Si cierras esta conversación, se notificará al asesor de soporte y tu sesión finalizará. Para comunicarte nuevamente con soporte, deberás iniciar una nueva validación ingresando el NIT y la cédula del director.'

const TEXTO_CONFIRMACION_CIERRE_SIN_CALLBACK =
  'Se avisará al equipo; un asesor cerrará el caso cuando corresponda.'

function puedeEditarEliminar(creadoEn: string): boolean {
  const creado = new Date(creadoEn).getTime()
  const limite = Date.now() - EDICION_MENSAJE_MAX_MINUTOS * 60 * 1000
  return creado > limite
}

export type ChatAgenteHandle = {
  /** Misma acción que antes tenía el botón «Finalizar soporte» (confirm + API). */
  solicitarCierreConversacion: () => void
}

interface ChatAgenteProps {
  userData: UserData
  onBack: () => void
  /** Al salir de la pantalla "conversación cerrada": limpiar sesión para exigir de nuevo NIT y cédula del director */
  onBackFromClosed?: () => void
  /** Cuando ya existe conversación con el CRM (lista para menú «Cerrar conversación» en el padre). */
  onConversacionReady?: (id: number) => void
  /**
   * Cuando el contacto pulse «Volver y validar de nuevo» tras cerrar desde el menú (la solicitud ya se registró en el API).
   * El padre suele limpiar sesión; el historial en pantalla se conserva hasta entonces.
   */
  onSolicitudCierreRegistrada?: () => void
}

const ChatAgente = forwardRef<ChatAgenteHandle, ChatAgenteProps>(function ChatAgente(
  { userData, onBack, onBackFromClosed, onConversacionReady, onSolicitudCierreRegistrada },
  ref,
) {
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
  const [solicitudCierreLoading, setSolicitudCierreLoading] = useState(false)
  const [solicitudCierreAviso, setSolicitudCierreAviso] = useState<string | null>(null)
  /** Tras solicitar cierre por menú: mostrar panel sin desmontar el hilo de mensajes. */
  const [cierrePorSolicitudCliente, setCierrePorSolicitudCliente] = useState(false)
  /** Confirmación dentro del chat (sustituye window.confirm al cerrar desde el menú). */
  const [confirmarCierreModalAbierto, setConfirmarCierreModalAbierto] = useState(false)
  /** EN_COLA hasta que un asesor tome el caso (ASIGNADA / ACTIVA); el contacto no escribe antes. */
  const [estadoConv, setEstadoConv] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  // Una sola petición por apertura: reutilizar la misma promesa si el efecto se ejecuta dos veces (p. ej. Strict Mode)
  const initPromiseRef = useRef<Promise<Conversacion> | null>(null)
  const initKeyRef = useRef<string | null>(null)
  const servicioEnviadoParaConvRef = useRef<number | null>(null)
  const ultimoHeartbeatEscrituraRef = useRef(0)

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
      servicioEnviadoParaConvRef.current = null
      ultimoHeartbeatEscrituraRef.current = 0
      setEstadoConv(null)
      initPromiseRef.current = crearConversacion(eid, cid, { canal: CANAL_WIDGET_AGENTE })
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
        onConversacionReady?.(conv.id_conversacion)
        setEstadoConv(conv.estado ?? 'EN_COLA')
        // Misma lista que el CRM (incluye mensaje de servicio) para que coincidan los hilos.
        setMensajes((conv.mensajes || []).filter((m) => !String(m.contenido ?? '').startsWith(PREFIJO_SOLO_ASESOR)))
        setConversacionCerrada(conv.estado === 'CERRADA')
        const raw = conv.mensajes || []
        if (raw.some((m) => m.tipo_emisor === 'CONTACTO' && esMensajeServicioSoloAsesor(String(m.contenido ?? '')))) {
          servicioEnviadoParaConvRef.current = conv.id_conversacion
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
  // onConversacionReady se omite intencionalmente de las deps: es un callback de notificación al padre
  // y su referencia cambia en cada render del padre, lo que re-ejecutaría esta inicialización incorrectamente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, contactoId])

  // Tras ASIGNADA/ACTIVA: un solo aviso al CRM con la licencia (antes no se envía en EN_COLA).
  useEffect(() => {
    if (!conversacionId || !empresaId || !contactoId) return
    if (estadoConv !== 'ASIGNADA' && estadoConv !== 'ACTIVA') return
    if (!userData.licencia?.trim()) return
    if (servicioEnviadoParaConvRef.current === conversacionId) return
    servicioEnviadoParaConvRef.current = conversacionId
    const texto = `Solicito soporte para el servicio: ${userData.licencia.trim()}`
    void enviarMensajeAgente({
      empresa_id: empresaId,
      conversacion_id: conversacionId,
      tipo_emisor: 'CONTACTO',
      contacto_id: contactoId,
      contenido: texto,
    }).catch(() => {
      servicioEnviadoParaConvRef.current = null
    })
  }, [estadoConv, conversacionId, empresaId, contactoId, userData.licencia])

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
      // Mensajes marcados [solo-asesor] son internos del CRM; el widget los ignora.
      if (String(mensaje.contenido ?? '').startsWith(PREFIJO_SOLO_ASESOR)) return
      setMensajes((prev) => {
        const idNuevo = idMensajeNumerico(mensaje.id_mensaje)
        if (idNuevo !== null && prev.some((m) => idMensajeNumerico(m.id_mensaje) === idNuevo)) return prev
        const ultimo = prev[prev.length - 1]
        const esNuestroTemp = ultimo && typeof ultimo.id_mensaje === 'string' && ultimo.contenido === mensaje.contenido && mensaje.tipo_emisor === 'CONTACTO'
        if (esNuestroTemp) return [...prev.slice(0, -1), { ...mensaje, id_mensaje: mensaje.id_mensaje }]
        return [...prev, mensaje]
      })
    })
    socket.on('conversation_updated', (data: { id_conversacion?: number; estado?: string }) => {
      if (data.id_conversacion !== Number(conversacionId)) return
      if (data.estado) setEstadoConv(data.estado)
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
  const puedeEscribirCliente = estadoConv === 'ASIGNADA' || estadoConv === 'ACTIVA'

  const handleTyping = useCallback(
    (texto: string) => {
      if (!conversacionId || !empresaId || !contactoId || !puedeEscribirCliente) return
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      const trim = texto.trim()
      if (!trim) {
        socketRef.current?.emit('typing_stop', { conversacionId: Number(conversacionId) })
        return
      }
      const now = Date.now()
      if (now - ultimoHeartbeatEscrituraRef.current >= HEARTBEAT_INACTIVIDAD_TYPING_MS) {
        ultimoHeartbeatEscrituraRef.current = now
        void heartbeatActividadClienteWidget(conversacionId, empresaId, contactoId).catch(() => {})
      }
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', { conversacionId: Number(conversacionId), quien: 'contacto', texto: trim })
      }, TYPING_DEBOUNCE_MS)
    },
    [conversacionId, empresaId, contactoId, puedeEscribirCliente]
  )

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
  }, [])

  const handleEnviar = async (contenido: string) => {
    if (!contenido.trim() || !conversacionId || !empresaId || !contactoId || enviando || !puedeEscribirCliente) return
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
      ultimoHeartbeatEscrituraRef.current = Date.now()
      // El mensaje se muestra ya en la lista; el servidor emite new_message y reemplazamos el temp por el real
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar')
      setMensajes((prev) => prev.filter((m) => m.id_mensaje !== tempId))
    } finally {
      setEnviando(false)
    }
  }

  const ejecutarSolicitudCierreTrasConfirmacion = useCallback(async () => {
    if (!empresaId || !contactoId || !conversacionId) return
    setConfirmarCierreModalAbierto(false)
    setSolicitudCierreLoading(true)
    setSolicitudCierreAviso(null)
    try {
      const r = await solicitarCierreSoporteDesdeWidget(conversacionId, empresaId, contactoId)
      if (onSolicitudCierreRegistrada) {
        setCierrePorSolicitudCliente(true)
      } else {
        setSolicitudCierreAviso(
          r.duplicado
            ? 'Ya habíamos registrado tu solicitud hace unos instantes.'
            : 'Listo. El equipo de soporte fue notificado. Cuando cierren el caso, verás aquí el mensaje de despedida.',
        )
      }
    } catch (e) {
      setSolicitudCierreAviso(e instanceof Error ? e.message : 'No se pudo enviar la solicitud')
    } finally {
      setSolicitudCierreLoading(false)
    }
  }, [empresaId, contactoId, conversacionId, onSolicitudCierreRegistrada])

  const abrirConfirmacionCierreDesdePadre = useCallback(() => {
    if (!empresaId || !contactoId || !conversacionId) return
    if (cierrePorSolicitudCliente || solicitudCierreLoading) return
    setConfirmarCierreModalAbierto(true)
  }, [empresaId, contactoId, conversacionId, cierrePorSolicitudCliente, solicitudCierreLoading])

  useEffect(() => {
    if (!confirmarCierreModalAbierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmarCierreModalAbierto(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmarCierreModalAbierto])

  useImperativeHandle(
    ref,
    () => ({
      solicitarCierreConversacion: () => {
        abrirConfirmacionCierreDesdePadre()
      },
    }),
    [abrirConfirmacionCierreDesdePadre],
  )

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
        <VolverLink onClick={onBack} ariaLabel="Volver al menú" title="Volver al menú" />
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
        <VolverLink onClick={onBack} ariaLabel="Volver al menú" title="Volver al menú" />
        <div className="chat-agente-content">
          <div className="chat-agente-loading">Conectando con un agente...</div>
        </div>
      </div>
    )
  }

  if (error && !conversacionId) {
    return (
      <div className="chat-agente">
        <VolverLink onClick={onBack} ariaLabel="Volver al menú" title="Volver al menú" />
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
      <div
        className="chat-agente chat-agente--cerrada chat-agente--cerrada-clickeable"
        onClick={handleVolverCerrada}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleVolverCerrada() }}
        aria-label="Toca para volver y validar de nuevo"
      >
        <div className="chat-agente-content">
          <MarcaHgi360Cierre />
          <h3 className="chat-agente-title">Conversación cerrada</h3>
          <p className="chat-agente-text chat-agente-text--despedida">
            {mensajeDespedida}
          </p>
          <p className="chat-agente-hint">
            Si necesitas más ayuda, deberás ingresar de nuevo tu NIT y cédula del director para iniciar una nueva conversación.
          </p>
          <p
            className="chat-agente-hint chat-agente-hint--tap"
            onClick={handleVolverCerrada}
            style={{ cursor: 'pointer' }}
          >
            Toca aquí para continuar
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-agente chat-agente--conversacion">
      <div className="chat-agente-body">
        {!cierrePorSolicitudCliente && (
          <div className="chat-agente-topbar">
            <VolverLink
              onClick={() => {
                setConfirmarCierreModalAbierto(false)
                setMessageInputKey((k) => k + 1)
                onBack()
              }}
              ariaLabel="Volver al menú"
              title="Volver al menú"
            />
          </div>
        )}
        <div className="chat-agente-main">
          {confirmarCierreModalAbierto && (
            <div
              className="chat-agente-dialog-cierre-overlay"
              role="presentation"
              onClick={() => setConfirmarCierreModalAbierto(false)}
            >
              <div
                className="chat-agente-dialog-cierre"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="chat-agente-dialog-cierre-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="chat-agente-dialog-cierre-title" className="chat-agente-dialog-cierre-title">
                  ¿Cerrar la conversación?
                </h2>
                <p className="chat-agente-dialog-cierre-text">
                  {onSolicitudCierreRegistrada
                    ? TEXTO_CONFIRMACION_CIERRE_CON_WIDGET
                    : TEXTO_CONFIRMACION_CIERRE_SIN_CALLBACK}
                </p>
                <div className="chat-agente-dialog-cierre-actions">
                  <button
                    type="button"
                    className="chat-agente-dialog-cierre-btn-cancelar"
                    onClick={() => setConfirmarCierreModalAbierto(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="chat-agente-dialog-cierre-btn-aceptar"
                    onClick={() => {
                      void ejecutarSolicitudCierreTrasConfirmacion()
                    }}
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="chat-agente-mensajes-wrap">
          <div className="chat-agente-mensajes" ref={listRef}>
            <p className="chat-agente-registro-info">
              ¡Hola, <strong>{userData.funcionario}</strong>! De la empresa <strong>&quot;{userData.empresa}&quot;</strong>.{' '}
              {puedeEscribirCliente
                ? 'Ya puedes escribir abajo; un agente de soporte te atenderá por este chat.'
                : 'Estás en cola: cuando un asesor tome tu conversación podrás enviar mensajes.'}
            </p>
            {mensajes.length === 0 ? (
              <p className="chat-agente-hint-inline">
                {puedeEscribirCliente
                  ? 'Escribe tu mensaje abajo y pulsa Enviar. Un agente te responderá en breve.'
                  : 'Espera a que un asesor tome el chat; entonces se habilitará el campo de mensaje.'}
              </p>
            ) : (
              <>
                {mensajes.filter((m) => !String(m.contenido ?? '').startsWith(PREFIJO_SOLO_ASESOR)).map((m, i) => (
                  <div
                    key={typeof m.id_mensaje !== 'undefined' ? String(m.id_mensaje) : `msg-${i}`}
                    className={`chat-agente-msg chat-agente-msg--${m.tipo_emisor.toLowerCase()} ${!cierrePorSolicitudCliente && tieneIdRealParaEditar(m) ? 'chat-agente-msg--acciones' : ''}`}
                    onClick={
                      !cierrePorSolicitudCliente && tieneIdRealParaEditar(m) ? (e) => abrirModalMensaje(m, e) : undefined
                    }
                    role={
                      m.tipo_emisor === 'SISTEMA'
                        ? 'status'
                        : !cierrePorSolicitudCliente && tieneIdRealParaEditar(m)
                          ? 'button'
                          : undefined
                    }
                    aria-live={m.tipo_emisor === 'SISTEMA' ? 'polite' : undefined}
                    aria-label={!cierrePorSolicitudCliente && tieneIdRealParaEditar(m) ? 'Opciones del mensaje' : undefined}
                  >
                    <span className="chat-agente-msg-text">{m.contenido}</span>
                    <span className="chat-agente-msg-meta">
                      {!cierrePorSolicitudCliente && tieneIdRealParaEditar(m) && (
                        <span className="chat-agente-msg-flecha" aria-hidden>▼</span>
                      )}
                      <span className="chat-agente-msg-hora">{formatearHora(m.creado_en)}</span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        {!cierrePorSolicitudCliente && (
          <div className="chat-agente-solicitud-cierre">
            {solicitudCierreAviso && (
              <p className="chat-agente-solicitud-cierre-aviso" role="status">
                {solicitudCierreAviso}
              </p>
            )}
            {solicitudCierreLoading && (
              <p className="chat-agente-solicitud-cierre-aviso" role="status">
                Enviando solicitud de cierre…
              </p>
            )}
          </div>
        )}
        {!cierrePorSolicitudCliente && (
          <div className="chat-agente-input">
            {!puedeEscribirCliente && (
              <p className="chat-agente-input-bloqueado" role="status">
                El envío de mensajes se habilita cuando un asesor tome tu conversación en el sistema de soporte.
              </p>
            )}
            <MessageInput
              key={messageInputKey}
              onSendMessage={handleEnviar}
              onSaveEdit={handleGuardarEdicion}
              disabled={enviando || guardandoEdicion || !puedeEscribirCliente}
              onTextChange={editandoMensaje ? undefined : handleTyping}
              editMode={!!editandoMensaje}
              value={editandoMensaje ? editandoContenido : undefined}
              onChange={editandoMensaje ? setEditandoContenido : undefined}
              onCancelEdit={editandoMensaje ? () => { setEditandoMensaje(null); setEditandoContenido('') } : undefined}
            />
          </div>
        )}
        {cierrePorSolicitudCliente && (
          <div
            className="chat-agente-cierre-cliente-fullscreen chat-agente--cerrada-clickeable"
            role="button"
            tabIndex={0}
            aria-label="Toca para volver y validar de nuevo"
            onClick={() => onSolicitudCierreRegistrada?.()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSolicitudCierreRegistrada?.() }}
          >
            <div className="chat-agente-cierre-cliente-fullscreen-inner">
              <MarcaHgi360Cierre />
              <h3 className="chat-agente-title">Conversación cerrada</h3>
              <p className="chat-agente-text chat-agente-text--despedida">
                Señor director o usuario, has cerrado la conversación.
              </p>
              <p className="chat-agente-hint">
                Si necesitas más ayuda, deberás ingresar de nuevo tu NIT y cédula del director para iniciar una nueva
                conversación.
              </p>
              <p
                className="chat-agente-hint chat-agente-hint--tap"
                onClick={() => onSolicitudCierreRegistrada?.()}
                style={{ cursor: 'pointer' }}
              >
                Toca aquí para continuar
              </p>
            </div>
          </div>
        )}
        </div>
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
})

export default ChatAgente
