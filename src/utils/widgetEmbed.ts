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
 * Cerrado: botón (icono + «Hablar con Isa» al hover; ~200×56).
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
  const { w: refW, h: refH } = getHostViewport()

  let width: number
  let height: number

  if (!open) {
    /* Botón cerrado: cabe el texto al pasar el ratón (Hablar con Isa) */
    width = 200
    height = 56
  } else if (expanded) {
    width = Math.min(660, Math.max(350, Math.round(refW * 0.5)))
    width = Math.min(width, refW - 24)
    height = Math.min(800, Math.max(480, Math.round(refH * 0.88)))
    height = Math.min(height, refH - 24)
  } else if (!registered) {
    const preferredW = 350
    const preferredH = 520
    width = Math.min(440, Math.max(330, preferredW), refW - 24)
    height = Math.min(680, Math.max(400, preferredH), refH - 24)
  } else {
    width = Math.min(440, Math.max(330, 350), refW - 24)
    if (view === 'agente' || view === 'isa') {
      height = Math.min(620, Math.max(500, 560), refH - 24)
    } else {
      height = Math.min(580, Math.max(480, 540), refH - 24)
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
