import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './Ia360Markdown.css'
import { getBackendBaseUrl } from '../services/api'
import {
  logIa360ImageConsole,
  resumirRutaImagen,
} from '../utils/ia360ImageConsole'

/**
 * URLs largas o con paréntesis rompen `![alt](url)` en el parser; `![alt](<url>)` es válido en CommonMark.
 * También normaliza variantes ya entre <> por si el modelo copia mal el cierre.
 */
function normalizeMarkdownImages(text: string): string {
  let t = text.replace(/!\[([^\]]*)\]\(<(https:\/\/[^>\n]+)>\)/g, '![$1](<$2>)')
  t = t.replace(/!\[([^\]]*)\]\((https:\/\/[^)\s\n]+)\)/g, '![$1](<$2>)')
  return t
}

type LightboxPayload = { src: string; alt: string }

function Ia360ImageLightbox({ src, alt, onClose }: LightboxPayload & { onClose: () => void }) {
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtnRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  return createPortal(
    <div
      className="chat-ia360-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Imagen ampliada: ${alt}` : 'Imagen ampliada'}
      onClick={onClose}
    >
      <button
        ref={closeBtnRef}
        type="button"
        className="chat-ia360-lightbox-close"
        onClick={onClose}
        aria-label="Cerrar vista ampliada"
      >
        ×
      </button>
      <div className="chat-ia360-lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <img className="chat-ia360-lightbox-img" src={src} alt={alt} />
      </div>
    </div>,
    document.body
  )
}

function isProxyableImageHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h.endsWith('.amazonaws.com') ||
    h.endsWith('notion.so') ||
    h.endsWith('notion.site') ||
    h === 'notionusercontent.com' ||
    h.endsWith('notionusercontent.com') ||
    h.endsWith('.notion-static.com') ||
    h === 'notion-static.com' ||
    h.endsWith('.cloudfront.net')
  )
}

/**
 * Carga la imagen vía POST /api/ia360-doc/proxy-image con { url } en el cuerpo.
 * Evita límites de longitud de la query en Nginx (URLs firmadas Notion/S3 → 502 con GET largo).
 */
function Ia360ProxiedImg({
  originalSrc,
  alt,
  className,
  title,
  width,
  height,
  onOpenLightbox,
}: {
  originalSrc: string
  alt?: string
  className?: string
  title?: string
  width?: string | number
  height?: string | number
  onOpenLightbox?: (p: LightboxPayload) => void
}) {
  const [displaySrc, setDisplaySrc] = useState<string>('')
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'failed'>('loading')
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setDisplaySrc('')
    setLoadState('loading')

    const base = getBackendBaseUrl().replace(/\/$/, '')
    const proxyPost = `${base}/api/ia360-doc/proxy-image`

    logIa360ImageConsole('proxy: solicitud', {
      alt: alt ?? '',
      ...resumirRutaImagen(originalSrc),
      link: originalSrc,
      proxy: proxyPost,
    })

    ;(async () => {
      try {
        const r = await fetch(proxyPost, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'image/*,*/*' },
          body: JSON.stringify({ url: originalSrc }),
        })
        if (cancelled) return
        if (r.ok) {
          const blob = await r.blob()
          if (cancelled) return
          const u = URL.createObjectURL(blob)
          objectUrlRef.current = u
          setDisplaySrc(u)
          setLoadState('ok')
          logIa360ImageConsole('proxy: ok', {
            alt: alt ?? '',
            link: originalSrc,
            bytes: blob.size,
            blobPreview: resumirRutaImagen(u).ruta,
          })
          return
        }
        logIa360ImageConsole('proxy: error HTTP', {
          alt: alt ?? '',
          link: originalSrc,
          status: r.status,
          statusText: r.statusText,
        })
      } catch (err) {
        logIa360ImageConsole('proxy: excepción', {
          alt: alt ?? '',
          link: originalSrc,
          error: err instanceof Error ? err.message : String(err),
        })
      }
      if (!cancelled) setLoadState('failed')
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [originalSrc])

  if (loadState === 'loading') {
    return (
      <div className="chat-ia360-md-img-frame">
        <div className="chat-ia360-md-img-scroll">
          <span
            className={`${className ?? ''} chat-ia360-img-placeholder`.trim()}
            aria-busy="true"
            aria-label={alt ? `Cargando ${alt}` : 'Cargando imagen'}
          />
        </div>
      </div>
    )
  }

  if (loadState === 'failed' || !displaySrc) {
    return (
      <div className="chat-ia360-md-img-frame">
        <div className="chat-ia360-md-img-broken" role="img" aria-label={alt ?? 'Imagen no disponible'}>
          <span className="chat-ia360-md-img-broken-alt">{alt || 'Imagen'}</span>
          <span className="chat-ia360-md-img-broken-hint">
            No se pudo cargar (enlace caducado o error del servidor). Actualice el backend con inlining de
            imágenes o vuelva a preguntar al asistente.
          </span>
          <a
            href={originalSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-ia360-md-img-full-link"
          >
            Intentar abrir enlace original
          </a>
        </div>
      </div>
    )
  }

  const openLb = () => onOpenLightbox?.({ src: displaySrc, alt: alt ?? '' })

  return (
    <div className="chat-ia360-md-img-frame">
      <div className="chat-ia360-md-img-scroll">
        <button
          type="button"
          className="chat-ia360-md-img-tap"
          onClick={openLb}
          aria-label={alt ? `Ampliar imagen: ${alt}` : 'Ampliar imagen'}
          title="Clic para ampliar"
        >
          <img
            className={className}
            alt={alt ?? ''}
            title={title}
            width={width}
            height={height}
            src={displaySrc}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </button>
      </div>
      <div className="chat-ia360-md-img-actions">
        <button type="button" className="chat-ia360-md-img-action-btn" onClick={openLb}>
          Ampliar
        </button>
        <a
          href={originalSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-ia360-md-img-full-link"
        >
          Abrir imagen completa
        </a>
      </div>
    </div>
  )
}

interface Ia360MarkdownProps {
  text: string
}

/** react-markdown solo permite http(s)/mailto por defecto; borra `data:image/...` del src. */
function ia360UrlTransform(url: string, key: string): string {
  if (key === 'src' && url.startsWith('data:image/')) return url
  return defaultUrlTransform(url)
}

/**
 * Respuestas IA360 en Markdown (incl. ![alt](url) desde Notion).
 * Imágenes allowlisted: POST al proxy + blob (no GET con query kilométrica).
 * data:... (base64 del backend) requiere urlTransform explícito.
 */
function Ia360Markdown({ text }: Ia360MarkdownProps) {
  const normalized = normalizeMarkdownImages(text)
  const [lightbox, setLightbox] = useState<LightboxPayload | null>(null)
  const openLightbox = (p: LightboxPayload) => setLightbox(p)

  return (
    <div className="chat-ia360-markdown">
      {lightbox ? (
        <Ia360ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      ) : null}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={ia360UrlTransform}
        components={{
          /* Evita <div> dentro de <p> (p. ej. listas GFM): los bloques de imagen son div; el parser mete img en <p>. */
          p: ({ children }) => <div className="chat-ia360-md-p">{children}</div>,
          img: ({ src, alt, title, width, height, ...rest }) => {
            const raw = src?.trim()
            if (raw) {
              const { tipo, ruta } = resumirRutaImagen(raw)
              logIa360ImageConsole('markdown: img detectada', {
                alt: alt ?? '',
                tipo,
                ruta,
                ...(tipo === 'https' ? { link: raw } : {}),
              })
            }
            if (raw && /^https:\/\//i.test(raw)) {
              try {
                const u = new URL(raw)
                if (isProxyableImageHost(u.hostname)) {
                  return (
                    <Ia360ProxiedImg
                      originalSrc={raw}
                      alt={alt}
                      title={title}
                      width={width}
                      height={height}
                      className="chat-ia360-md-img"
                      onOpenLightbox={openLightbox}
                    />
                  )
                }
              } catch {
                /* seguir con img normal */
              }
            }
            const href = raw && /^https:\/\//i.test(raw) ? raw : undefined
            const lbSrc = src?.trim() ?? ''
            const openLb = () => {
              if (lbSrc) openLightbox({ src: lbSrc, alt: alt ?? '' })
            }
            return (
              <div className="chat-ia360-md-img-frame">
                <div className="chat-ia360-md-img-scroll">
                  <button
                    type="button"
                    className="chat-ia360-md-img-tap"
                    onClick={openLb}
                    disabled={!lbSrc}
                    aria-label={alt ? `Ampliar imagen: ${alt}` : 'Ampliar imagen'}
                    title="Clic para ampliar"
                  >
                    <img
                      {...rest}
                      className="chat-ia360-md-img"
                      alt={alt ?? ''}
                      title={title}
                      width={width}
                      height={height}
                      src={src}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                </div>
                <div className="chat-ia360-md-img-actions">
                  <button
                    type="button"
                    className="chat-ia360-md-img-action-btn"
                    onClick={openLb}
                    disabled={!lbSrc}
                  >
                    Ampliar
                  </button>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chat-ia360-md-img-full-link"
                    >
                      Abrir imagen completa
                    </a>
                  ) : null}
                </div>
              </div>
            )
          },
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  )
}

export default Ia360Markdown
