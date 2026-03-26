import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './Ia360Markdown.css'
import { getBackendBaseUrl } from '../services/api'

/**
 * URLs largas o con paréntesis rompen `![alt](url)` en el parser; `![alt](<url>)` es válido en CommonMark.
 * También normaliza variantes ya entre <> por si el modelo copia mal el cierre.
 */
function normalizeMarkdownImages(text: string): string {
  let t = text.replace(/!\[([^\]]*)\]\(<(https:\/\/[^>\n]+)>\)/g, '![$1](<$2>)')
  t = t.replace(/!\[([^\]]*)\]\((https:\/\/[^)\s\n]+)\)/g, '![$1](<$2>)')
  return t
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
}: {
  originalSrc: string
  alt?: string
  className?: string
  title?: string
  width?: string | number
  height?: string | number
}) {
  const [displaySrc, setDisplaySrc] = useState<string>('')
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setDisplaySrc('')

    const base = getBackendBaseUrl().replace(/\/$/, '')
    const proxyPost = `${base}/api/ia360-doc/proxy-image`

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
          return
        }
      } catch {
        /* fallback abajo */
      }
      if (!cancelled) setDisplaySrc(originalSrc)
    })()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [originalSrc])

  if (!displaySrc) {
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

  return (
    <div className="chat-ia360-md-img-frame">
      <div className="chat-ia360-md-img-scroll">
        <img
          className={className}
          alt={alt ?? ''}
          title={title}
          width={width}
          height={height}
          src={displaySrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            if (displaySrc !== originalSrc && e.currentTarget.src !== originalSrc) {
              e.currentTarget.src = originalSrc
            }
          }}
        />
      </div>
      <a
        href={originalSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-ia360-md-img-full-link"
      >
        Abrir imagen completa
      </a>
    </div>
  )
}

interface Ia360MarkdownProps {
  text: string
}

/**
 * Respuestas IA360 en Markdown (incl. ![alt](url) desde Notion).
 * Imágenes allowlisted: POST al proxy + blob (no GET con query kilométrica).
 */
function Ia360Markdown({ text }: Ia360MarkdownProps) {
  const normalized = normalizeMarkdownImages(text)
  return (
    <div className="chat-ia360-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt, title, width, height, ...rest }) => {
            const raw = src?.trim()
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
                    />
                  )
                }
              } catch {
                /* seguir con img normal */
              }
            }
            const href = raw && /^https:\/\//i.test(raw) ? raw : undefined
            return (
              <div className="chat-ia360-md-img-frame">
                <div className="chat-ia360-md-img-scroll">
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
                </div>
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
