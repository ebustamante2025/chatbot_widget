/**
 * Comunicación con la página padre cuando el widget corre dentro de un iframe
 * (p. ej. isa-widget-loader.js). Permite reducir el iframe al cerrar el chat
 * para no tapar formularios y botones del sitio anfitrión.
 */
export const ISA_WIDGET_MESSAGE_SOURCE = 'isa-widget-chat' as const

export function isEmbeddedInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

export type WidgetEmbedView = 'panel' | 'isa' | 'faq' | 'agente' | 'ia360'

/**
 * Notifica al padre el tamaño deseado del iframe.
 * Cerrado: solo la burbuja (~260×88).
 * Abierto: ventana de chat/registro (limitado al viewport del iframe).
 */
function getHostViewport(): { w: number; h: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600
  try {
    if (window.top && window.top !== window.self) {
      return { w: window.top.innerWidth, h: window.top.innerHeight }
    }
  } catch {
    /* cross-origin: el iframe no puede leer el top */
  }
  const sw = typeof screen !== 'undefined' ? screen.availWidth : vw
  const sh = typeof screen !== 'undefined' ? screen.availHeight : vh
  return { w: Math.max(vw, sw), h: Math.max(vh, sh) }
}

export function postWidgetFrameResize(params: {
  open: boolean
  registered: boolean
  view: WidgetEmbedView
  expanded?: boolean
}): void {
  if (!isEmbeddedInIframe()) return

  const { open, registered, view, expanded } = params
  const vw = typeof window !== 'undefined' ? window.innerWidth : 400
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600
  const { w: refW, h: refH } = getHostViewport()

  let width: number
  let height: number

  if (!open) {
    width = 280
    height = 96
  } else if (expanded) {
    width = Math.min(560, Math.max(320, Math.round(refW * 0.4)))
    width = Math.min(width, refW - 24)
    height = Math.min(720, Math.max(440, Math.round(refH * 0.8)))
    height = Math.min(height, refH - 24)
  } else if (!registered) {
    width = Math.min(420, Math.max(320, vw - 16))
    height = Math.min(640, Math.max(480, Math.round(vh * 0.92)))
  } else {
    width = Math.min(400, Math.max(320, vw - 16))
    if (view === 'agente' || view === 'isa') {
      height = Math.min(580, Math.max(480, Math.round(vh * 0.9)))
    } else {
      height = Math.min(540, Math.max(440, Math.round(vh * 0.85)))
    }
  }

  window.parent.postMessage(
    {
      source: ISA_WIDGET_MESSAGE_SOURCE,
      type: 'resize',
      width,
      height,
      open,
    },
    '*'
  )
}
