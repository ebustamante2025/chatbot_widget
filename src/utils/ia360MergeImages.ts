/**
 * Sustituye ![alt](IMG:0001) por data: o URL usando el mapa del JSON del API (flujo tipo Agente01).
 */
export function mergeIa360ImagePlaceholders(
  markdown: string,
  images?: Record<string, string> | null,
): string {
  if (!images || Object.keys(images).length === 0) return markdown
  let t = markdown
  for (const [key, dataUriOrUrl] of Object.entries(images)) {
    if (!/^IMG:\d{4}$/.test(key)) continue
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`!\\[([^\\]]*)\\]\\(${esc}\\)`, 'g')
    t = t.replace(re, (_m, alt: string) => `![${alt}](${dataUriOrUrl})`)
  }
  return t
}
