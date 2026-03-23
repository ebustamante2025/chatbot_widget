import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './Ia360Markdown.css'
import { getBackendBaseUrl } from '../services/api'

/**
 * Notion/S3 a veces bloquean <img> directo (referrer, CORP, URL caducada).
 * Pasamos por GET /api/ia360-doc/proxy-image del CRM (mismo origen que el API).
 */
function buildProxySrc(src: string | undefined): string | undefined {
  if (!src?.trim()) return src
  const s = src.trim()
  if (!/^https:\/\//i.test(s)) return src
  try {
    const u = new URL(s)
    const h = u.hostname.toLowerCase()
    const allow =
      h.endsWith('.amazonaws.com') ||
      h.endsWith('notion.so') ||
      h.endsWith('notion.site') ||
      h === 'notionusercontent.com' ||
      h.endsWith('notionusercontent.com')
    if (!allow) return src
    const base = getBackendBaseUrl().replace(/\/$/, '')
    const proxy = base ? `${base}/api/ia360-doc/proxy-image` : '/api/ia360-doc/proxy-image'
    return `${proxy}?${new URLSearchParams({ url: s }).toString()}`
  } catch {
    return src
  }
}

interface Ia360MarkdownProps {
  text: string
}

/**
 * Respuestas IA360 en Markdown (incl. ![alt](url) desde Notion).
 * Sin rehype-sanitize en imágenes: URLs firmadas son largas; el proxy las sirve bien.
 */
function Ia360Markdown({ text }: Ia360MarkdownProps) {
  return (
    <div className="chat-ia360-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt, ...rest }) => {
            const proxied = buildProxySrc(src)
            return (
              <img
                {...rest}
                className="chat-ia360-md-img"
                alt={alt ?? ''}
                src={proxied}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (src && e.currentTarget.src !== src) {
                    e.currentTarget.src = src
                  }
                }}
              />
            )
          },
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default Ia360Markdown
