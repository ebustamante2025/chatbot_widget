import './VolverLink.css'

export type VolverLinkVariant = 'link' | 'onDark'

export interface VolverLinkProps {
  onClick: () => void
  ariaLabel: string
  title?: string
  disabled?: boolean
  /** Estilo: enlace sobre fondo claro (por defecto) o botón legible sobre cabecera oscura */
  variant?: VolverLinkVariant
  className?: string
}

/**
 * «← Volver» reutilizable: un solo estilo de enlace en paneles claros y variante para header azul.
 */
export function VolverLink({
  onClick,
  ariaLabel,
  title,
  disabled,
  variant = 'link',
  className,
}: VolverLinkProps) {
  const cls = ['volver-link', variant === 'onDark' && 'volver-link--on-dark', className].filter(Boolean).join(' ')

  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}>
      ← Volver
    </button>
  )
}
