/**
 * Las respuestas IA360 pueden llevar ![alt](data:image/...;base64,...) (cientos de KB).
 * Al reenviar el historial en POST /ia360-doc/chat, eso duplica el payload y supera límites (p. ej. 100kb de express).
 * El modelo solo necesita saber que hubo imágenes, no el binario.
 */
export function stripDataUriImagesFromMarkdown(md: string): string {
  return md.replace(/!\[([^\]]*)\]\(data:image\/[^)]+\)/gi, '*(Imagen en mensaje anterior: $1)*')
}

/** Evita reenviar IMG: del turno anterior en POST /chat (mismo criterio que el API). */
export function compactImgPlaceholdersForHistory(md: string): string {
  return md.replace(/!\[([^\]]*)\]\(IMG:\d{4}\)/gi, '*(Imagen en mensaje anterior: $1)*')
}
