import { useState, useEffect, useRef, useCallback } from 'react'
import { getIa360Historial, enviarIa360DocChat, guardarIa360MensajeDoc } from '../services/api'
import type { UserData } from '../types'
import type { Message } from '../types'
import MessageInput from './MessageInput'
import Ia360Markdown from './Ia360Markdown'
import './MessageList.css'
import './ChatIA360.css'

/**
 * Si la razón social vino como "NIT xxxx — Nombre" o "Empresa NIT xxxx", deja solo el nombre comercial legible.
 * No devuelve "NIT …" ni "Empresa NIT …" sin nombre real (evita repetir el NIT en la barra).
 */
function formatNombreEmpresa(razonSocial: string, _nit: string): string {
  const t = razonSocial.trim()
  if (!t) return ''
  const sepIdx = t.search(/\s[—–-]\s/)
  if (sepIdx >= 0) {
    const after = t.slice(sepIdx + 1).replace(/^[—–-]\s*/, '').trim()
    if (after) return after
  }
  const nitDash = new RegExp(`^NIT\\s*[\\d.\\-\\s]+\\s*[—–-]\\s*(.+)$`, 'i')
  const m1 = nitDash.exec(t)
  if (m1?.[1]) return m1[1].trim()
  if (/^Empresa\s+NIT/i.test(t)) {
    const rest = t.replace(/^Empresa\s+NIT\s*[\d.\-\s]*/i, '').trim()
    return rest || ''
  }
  return t
}

/** Evita mostrar en la barra un "nombre" que solo repite el NIT (p. ej. "Empresa NIT 8787"). */
function nombreEmpresaMostrable(razonSocial: string, nit: string): string {
  const n = formatNombreEmpresa(razonSocial, nit).trim()
  if (!n) return ''
  const nd = nit.replace(/\D/g, '')
  if (/^Empresa\s+NIT\s*[\d.\-\s]+$/i.test(n)) return ''
  if (new RegExp(`^NIT\\s*[\\d.\\-\\s]*${nd}\\s*$`, 'i').test(n.replace(/\s/g, ' '))) return ''
  if (n.replace(/\D/g, '') === nd && nd.length >= 6 && n.length < 24) return ''
  return n
}

/** Barra azul: NIT, nombre de empresa (si no es placeholder) y director — sin repetir NIT. */
function buildInfoLine(userData: UserData): string {
  const nit = userData.nit.trim()
  const emp = nombreEmpresaMostrable(userData.empresa, nit)
  const dir = userData.funcionario.trim()
  if (emp) return `NIT ${nit} · ${emp} · ${dir}`
  return `NIT ${nit} · ${dir}`
}

interface ChatIA360Props {
  userData: UserData
  token: string
  servicio: string
}

function ChatIA360({ userData, token, servicio }: ChatIA360Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [enviando, setEnviando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [infoLine, setInfoLine] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight
      }
    }, 80)
  }, [])

  /** Mantener el scroll abajo al cargar historial, nuevos mensajes o errores */
  useEffect(() => {
    scrollToBottom()
  }, [messages, cargando, error, enviando, infoLine, scrollToBottom])

  /** Historial en formato API (sin el mensaje que aún no se envía) */
  const buildHistoryForApi = useCallback(
    (msgs: Message[]): Array<{ role: 'user' | 'assistant'; content: string }> => {
      const h: Array<{ role: 'user' | 'assistant'; content: string }> = []
      for (const m of msgs) {
        if (m.sender === 'user') {
          h.push({ role: 'user', content: m.text })
        } else {
          h.push({ role: 'assistant', content: m.text })
        }
      }
      return h
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCargando(true)
      setError(null)
      if (!cancelled) {
        setInfoLine(buildInfoLine(userData))
      }
      try {
        const hist = await getIa360Historial(token, 500)
        if (cancelled) return
        if (hist.length > 0) {
          const mapped: Message[] = hist.map((m, i) => ({
            id: `h-${i}-${m.creado_en ?? ''}`,
            text: m.contenido,
            sender: m.rol === 'usuario' ? 'user' : 'isa',
            timestamp: m.creado_en ? new Date(m.creado_en) : new Date(),
          }))
          setMessages(mapped)
        } else {
          const msgServicio = servicio.trim()
          if (msgServicio) {
            const t = Date.now()
            setMessages([
              {
                id: `u-svc-${t}`,
                text: msgServicio,
                sender: 'user',
                timestamp: new Date(),
              },
            ])
            try {
              await guardarIa360MensajeDoc({ token, rol: 'usuario', contenido: msgServicio })
            } catch (err) {
              if (!cancelled) {
                setError(
                  err instanceof Error
                    ? `${err.message} (El mensaje se muestra en pantalla; revise conexión o CRM.)`
                    : 'No se pudo guardar el servicio en el CRM'
                )
              }
            }
          } else {
            setMessages([])
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo cargar el contexto')
        }
      } finally {
        if (!cancelled) setCargando(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, userData, servicio])

  const handleSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || enviando) return
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      text: trimmed,
      sender: 'user',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setEnviando(true)
    setError(null)
    try {
      const historyBefore = buildHistoryForApi([...messages, userMsg])
      const { reply } = await enviarIa360DocChat({
        token,
        message: trimmed,
        history: historyBefore,
        servicio: servicio.trim() || undefined,
      })
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          text: reply,
          sender: 'isa',
          timestamp: new Date(),
        },
      ])
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
      setError(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="chat-ia360">
      <div className="chat-ia360-context" role="status">
        {infoLine && <span className="chat-ia360-context-text">{infoLine}</span>}
      </div>
      {error && (
        <div className="chat-ia360-error" role="alert">
          {error}
        </div>
      )}
      <div ref={listRef} className="message-list chat-ia360-list">
        {cargando && <p className="chat-ia360-loading">Cargando…</p>}
        {!cargando &&
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.sender === 'user' ? 'message-user' : 'message-isa'}`}
            >
              <div className="message-content">
                <div className="message-text">
                  {message.sender === 'isa' ? (
                    <Ia360Markdown text={message.text} />
                  ) : (
                    <span style={{ whiteSpace: 'pre-wrap' }}>{message.text}</span>
                  )}
                </div>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        <div style={{ clear: 'both' }} />
        <div ref={messagesEndRef} className="chat-ia360-scroll-anchor" aria-hidden />
      </div>
      <MessageInput onSendMessage={handleSend} disabled={enviando || cargando} />
    </div>
  )
}

export default ChatIA360
