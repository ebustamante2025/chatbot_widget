/**
 * Seguimiento por consola (navegador) del flujo IA360 → imágenes.
 * Activa con VITE_IA360_LOG_IMAGES=true en build / .env
 */

export const IA360_LOG_IMAGES =
  import.meta.env.VITE_IA360_LOG_IMAGES === 'true' ||
  import.meta.env.VITE_IA360_LOG_IMAGES === '1'

export function logIa360ImageConsole(evento: string, detalle: Record<string, unknown>) {
  if (!IA360_LOG_IMAGES) return
  console.info(`[IA360 imagen] ${evento}`, detalle)
}

/** URLs https encontradas en markdown tipo ![alt](url) o ![alt](<url>) */
export function extractHttpsImageUrlsFromMarkdown(md: string): string[] {
  const urls = new Set<string>()
  const reA = /!\[[^\]]*\]\(<(https:\/\/[^>\s]+)>\)/g
  let m: RegExpExecArray | null
  while ((m = reA.exec(md)) !== null) urls.add(m[1])
  const reP = /!\[[^\]]*\]\((https:\/\/[^)\s\n]+)\)/g
  while ((m = reP.exec(md)) !== null) {
    if (!m[1].startsWith('data:')) urls.add(m[1])
  }
  return [...urls]
}

export function countDataImageBlocksInMarkdown(md: string): number {
  return (md.match(/!\[[^\]]*\]\(data:image\//g) || []).length
}

/** Texto seguro para consola: https completa; data: solo tipo y longitud. */
export function resumirRutaImagen(src: string): { tipo: string; ruta: string } {
  if (src.startsWith('data:image/')) {
    const m = /^data:(image\/[^;]+)/.exec(src)
    return {
      tipo: 'data-uri',
      ruta: `${m?.[1] ?? 'image/*'} · ${src.length} chars (inline)`,
    }
  }
  if (src.startsWith('blob:')) {
    return { tipo: 'blob', ruta: `${src.slice(0, 64)}…` }
  }
  return { tipo: 'https', ruta: src }
}
