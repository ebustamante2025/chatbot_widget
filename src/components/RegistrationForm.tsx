import { useState, useEffect, FormEvent } from 'react'
import { UserData } from '../types'
import {
  verificarEmpresa,
  crearEmpresa,
  crearContacto,
  verificarContacto,
  checkBackendHealth,
  getWebhookProxyRegistroUrl,
  type ContratoVigente,
  type ContactoCliente,
} from '../services/api'
import { MENSAJES_VALIDACION } from '../data/mensajesValidacion'
import './RegistrationForm.css'

/** Reemplaza espacios por guion bajo y envía en mayúsculas. Ej: "HGI Nómina" → "HGI_NÓMINA" */
function formatearNombreLicencia(nombre: string): string {
  return nombre.trim().replace(/\s+/g, '_').toUpperCase()
}

type ConnectionStatus = 'checking' | 'ok' | 'unreachable' | 'database_error'

interface RegistrationFormProps {
  onSubmit: (data: UserData) => void
  onClose?: () => void
}

function RegistrationForm({ onSubmit, onClose }: RegistrationFormProps) {
  const [step, setStep] = useState<'nit' | 'director' | 'licencia'>('nit')
  const [nit, setNit] = useState('')
  const [directorNombre, setDirectorNombre] = useState('')
  const [directorCedula, setDirectorCedula] = useState('')
  const [licenciaSeleccionada, setLicenciaSeleccionada] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')
  const [razonSocial, setRazonSocial] = useState<string>('')
  const [contratosVigentes, setContratosVigentes] = useState<ContratoVigente[]>([])
  const [contactosClientes, setContactosClientes] = useState<ContactoCliente[]>([])

  // Validar conexión con backend y BD al montar el formulario
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const health = await checkBackendHealth()
        if (cancelled) return
        if (health.status === 'ok' && health.database === 'connected') {
          setConnectionStatus('ok')
        } else {
          setConnectionStatus('database_error')
        }
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : ''
        setConnectionStatus(
          msg === 'database' || msg.startsWith('server:') ? 'database_error' : 'unreachable'
        )
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const handleRetryConnection = async () => {
    setConnectionStatus('checking')
    try {
      const health = await checkBackendHealth()
      if (health.status === 'ok' && health.database === 'connected') {
        setConnectionStatus('ok')
      } else {
        setConnectionStatus('database_error')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setConnectionStatus(
        msg === 'database' || msg.startsWith('server:') ? 'database_error' : 'unreachable'
      )
    }
  }

  const handleVerificarNit = async () => {
    if (!nit.trim()) {
      setErrors({ nit: MENSAJES_VALIDACION.nitRequerido })
      return
    }

    setErrors({})
    setMessage('')
    setContratosVigentes([])
    setContactosClientes([])
    setLoading(true)

    try {
      const result = await verificarEmpresa(nit.trim())
      if (!result.licenciaValida || (result.contratosVigentes?.length ?? 0) === 0) {
        setErrors({ nit: MENSAJES_VALIDACION.sinLicencia })
        setMessage(`❌ ${MENSAJES_VALIDACION.sinLicenciaMensaje}`)
        setLoading(false)
        return
      }
      const nombreEmpresa = result.nombre_empresa ?? result.empresa?.nombre_empresa ?? `Empresa NIT ${nit.trim()}`
      const textoEmpresa = result.nit ? `NIT ${result.nit} — ${nombreEmpresa}` : nombreEmpresa
      setRazonSocial(textoEmpresa)
      setContratosVigentes(result.contratosVigentes ?? [])
      setContactosClientes(result.contactosClientes ?? [])
      setMessage(MENSAJES_VALIDACION.nitOk(textoEmpresa, result.contratosVigentes?.length ?? 0))
      setStep('director')
    } catch (err: any) {
      setErrors({ nit: MENSAJES_VALIDACION.errorVerificarNit })
      setMessage(err?.message ? `❌ ${err.message}` : `❌ ${MENSAJES_VALIDACION.errorVerificarNitFallback}`)
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarDirector = async () => {
    if (!directorCedula.trim()) {
      setErrors({ directorCedula: MENSAJES_VALIDACION.cedulaRequerida })
      return
    }
    if (contactosClientes.length === 0) return

    setErrors({})

    // Validar contra ContactosClientes de la API (Identificacion)
    const contactoValido = contactosClientes.find(
      (c) => String(c.Identificacion).trim() === directorCedula.trim()
    )

    if (!contactoValido) {
      setErrors({ directorCedula: MENSAJES_VALIDACION.directorNoAutorizado })
      setMessage(`❌ ${MENSAJES_VALIDACION.directorNoAutorizadoMensaje}`)
      return
    }

    const nombreCompleto = [contactoValido.Nombres, contactoValido.Apellidos].filter(Boolean).join(' ').trim() || contactoValido.Identificacion
    setDirectorNombre(nombreCompleto)
    setMessage(MENSAJES_VALIDACION.directorOk(nombreCompleto))
    setLicenciaSeleccionada(null)
    setStep('licencia')
  }

  const handleSeleccionarLicencia = async () => {
    if (!licenciaSeleccionada) {
      setErrors({ licencia: MENSAJES_VALIDACION.debeSeleccionarLicencia })
      return
    }

    setLoading(true)
    setErrors({})
    setMessage(MENSAJES_VALIDACION.procesando)

    const nombreEmpresa = razonSocial || `Empresa NIT ${nit.trim()}`

    // 1. Enviar la licencia seleccionada a la API webhook (vía proxy del backend para evitar CORS)
    try {
      await fetch(getWebhookProxyRegistroUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit: nit.trim(),
          razon_social: nombreEmpresa,
          director: directorNombre,
          director_cedula: directorCedula.trim(),
          licencia: formatearNombreLicencia(licenciaSeleccionada),
        }),
      })
    } catch (err) {
      console.warn('Error al enviar licencia al webhook:', err)
    }

    // 2. Verificar/crear empresa automáticamente en el backend
    let empresaId: number | undefined
    let empresaNombre = nombreEmpresa

    try {
      const result = await verificarEmpresa(nit.trim())

      if (result.existe && result.empresa) {
        empresaId = result.empresa.id_empresa
        empresaNombre = result.empresa.nombre_empresa
      } else {
        const nuevaEmpresa = await crearEmpresa({
          nit: nit.trim(),
          nombre_empresa: nombreEmpresa,
        })
        empresaId = nuevaEmpresa.id_empresa
      }
    } catch (error: any) {
      console.warn('Error al verificar/crear empresa:', error)
      setErrors({ licencia: error.message || MENSAJES_VALIDACION.errorRegistrarEmpresa })
      setLoading(false)
      return
    }

    // 3. Verificar/crear contacto automáticamente con datos del director
    let contactoId: number | undefined

    try {
      const resultContacto = await verificarContacto(empresaId, directorCedula.trim())

      if (resultContacto.existe && resultContacto.contacto) {
        contactoId = resultContacto.contacto.id_contacto
      } else {
        // Crear contacto automáticamente con datos del director
        const nuevoContacto = await crearContacto({
          empresa_id: empresaId,
          nombre: directorNombre,
          cargo: 'Director de Proyecto',
          tipo_documento: 'CC',
          documento: directorCedula.trim(),
        })
        contactoId = nuevoContacto.id_contacto
      }
    } catch (error: any) {
      console.warn('Error al verificar/crear contacto:', error)
      setErrors({ licencia: error.message || MENSAJES_VALIDACION.errorRegistrarContacto })
      setLoading(false)
      return
    }

    setLoading(false)

    // 4. Completar registro y pasar al chat
    onSubmit({
      nit: nit.trim(),
      empresa: empresaNombre,
      funcionario: directorNombre,
      empresaId,
      contactoId,
      licencia: licenciaSeleccionada ? formatearNombreLicencia(licenciaSeleccionada) : undefined,
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (step === 'nit') {
      await handleVerificarNit()
    } else if (step === 'director') {
      await handleVerificarDirector()
    } else if (step === 'licencia') {
      await handleSeleccionarLicencia()
    }
  }

  return (
    <div className="registration-form-container">
      <div className="registration-form-header">
        {onClose && (
          <button 
            className="close-button-header"
            onClick={onClose}
            aria-label="Cerrar chat"
          >
            ×
          </button>
        )}
        <h3>Registro</h3>
      </div>

      {/* Estado de conexión backend / BD */}
      {connectionStatus === 'checking' && (
        <div className="connection-status connection-checking">
          Verificando conexión con el servidor...
        </div>
      )}
      {connectionStatus === 'unreachable' && (
        <div className="connection-status connection-error">
          <span>No hay conexión con el servidor. Verifique su conexión e intente de nuevo.</span>
          <button type="button" className="retry-connection-button" onClick={handleRetryConnection}>
            Reintentar
          </button>
        </div>
      )}
      {connectionStatus === 'database_error' && (
        <div className="connection-status connection-error">
          <span>El servidor no puede conectar con la base de datos. Intente más tarde.</span>
          <button type="button" className="retry-connection-button" onClick={handleRetryConnection}>
            Reintentar
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="registration-form" style={connectionStatus !== 'ok' ? { opacity: 0.7, pointerEvents: 'none' as const } : undefined}>
        {message && (
          <div className={message.includes('❌') ? 'error-licencia' : 'success-message'}>
            {message}
          </div>
        )}

        {errors.general && (
          <div className="error-message-general">
            {errors.general}
          </div>
        )}

        {/* Paso 1: NIT */}
        {step === 'nit' && (
          <div className="form-group">
            <label htmlFor="nit">NIT de la Empresa *</label>
            <input
              id="nit"
              type="text"
              value={nit}
              onChange={(e) => {
                setNit(e.target.value)
                if (errors.nit) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.nit
                    return newErrors
                  })
                }
              }}
              placeholder="Ingresa el NIT"
              className={errors.nit ? 'error' : ''}
              disabled={loading}
            />
            {errors.nit && <span className="error-message">{errors.nit}</span>}
          </div>
        )}

        {/* Paso 2: Verificar director de proyecto */}
        {step === 'director' && (
          <>
            {razonSocial && (
              <div className="licencias-info">
                <p className="licencias-titulo">{razonSocial}</p>
              </div>
            )}
            <p className="director-instruccion">Ingrese por favor la cédula del director de proyecto</p>
            <div className="form-group">
              <label htmlFor="directorCedula">Cédula del Director *</label>
              <input
                id="directorCedula"
                type="text"
                value={directorCedula}
                onChange={(e) => {
                  setDirectorCedula(e.target.value)
                  if (errors.directorCedula) {
                    setErrors(prev => { const n = { ...prev }; delete n.directorCedula; return n })
                  }
                }}
                placeholder="Número de cédula"
                className={errors.directorCedula ? 'error' : ''}
                disabled={loading}
              />
              {errors.directorCedula && <span className="error-message">{errors.directorCedula}</span>}
            </div>
          </>
        )}

        {/* Paso 3: Seleccionar licencia activa */}
        {step === 'licencia' && contratosVigentes.length > 0 && (
          <>
            <div className="licencias-info">
              <p className="licencias-titulo">{razonSocial}</p>
              <p className="licencias-subtitulo">Seleccione la licencia</p>
              <ul className="licencias-lista">
                {contratosVigentes.map((c, idx) => (
                  <li
                    key={`${c.Codigo}-${idx}`}
                    className={`licencia-item licencia-seleccionable ${licenciaSeleccionada === c.Descripcion ? 'licencia-selected' : ''}`}
                    onClick={() => {
                      setLicenciaSeleccionada(c.Descripcion)
                      console.log('[Chatbot] Botón de servicio presionado:', {
                        codigo: c.Codigo,
                        descripcion: c.Descripcion,
                        fechaInicial: c.FechaInicial,
                        fechaFinal: c.FechaFinal
                      })
                      if (errors.licencia) {
                        setErrors(prev => { const n = { ...prev }; delete n.licencia; return n })
                      }
                    }}
                  >
                    <span className="licencia-dot dot-activa" />
                    <span className="licencia-nombre">{c.Descripcion}</span>
                    {licenciaSeleccionada === c.Descripcion && <span className="licencia-check">✓</span>}
                  </li>
                ))}
              </ul>
              {errors.licencia && <span className="error-message">{errors.licencia}</span>}
            </div>
          </>
        )}

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading
            ? 'Procesando...'
            : step === 'nit'
              ? 'Verificar NIT'
              : step === 'director'
                ? 'Verificar Director'
                : 'Continuar con licencia'}
        </button>
      </form>
    </div>
  )
}

export default RegistrationForm
