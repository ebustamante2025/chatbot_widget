import { useState, useEffect, FormEvent } from 'react'
import { UserData } from '../types'
import { verificarEmpresa, crearEmpresa, crearContacto, verificarContacto, checkBackendHealth } from '../services/api'
import { buscarEmpresaPorNit, tieneAlgunaLicenciaActiva, licenciasActivas } from '../data/empresas-licencias'
import type { EmpresaLicencia } from '../data/empresas-licencias'
import './RegistrationForm.css'

/** Reemplaza espacios por guion bajo. Ej: "HGI NÓMINA" → "HGI_NÓMINA" */
function formatearNombreLicencia(nombre: string): string {
  return nombre.trim().replace(/\s+/g, '_')
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
  const [empresaLicencia, setEmpresaLicencia] = useState<EmpresaLicencia | null>(null)

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

  const handleVerificarNit = () => {
    if (!nit.trim()) {
      setErrors({ nit: 'El NIT es requerido' })
      return
    }

    setErrors({})
    setMessage('')
    setEmpresaLicencia(null)

    // Verificar licencia localmente contra datos de empresas
    const empresaLocal = buscarEmpresaPorNit(nit.trim())
    if (empresaLocal) {
      setEmpresaLicencia(empresaLocal)
      if (!tieneAlgunaLicenciaActiva(empresaLocal)) {
        setErrors({ nit: 'Sin licencia activa' })
        setMessage(`❌ Señor usuario, en el momento usted no tiene licencia activa. Por favor verificar con atención al cliente.`)
        return
      }
      // Tiene licencia activa → pedir datos del director
      const lics = licenciasActivas(empresaLocal)
      setMessage(`✓ ${empresaLocal.razon_social} — ${lics.length} licencia(s) activa(s)`)
      setStep('director')
    } else {
      setErrors({ nit: 'Empresa no encontrada' })
      setMessage('❌ El NIT ingresado no se encuentra registrado en el sistema de licencias. Verifique el NIT o contacte al administrador.')
    }
  }

  const handleVerificarDirector = async () => {
    if (!directorCedula.trim()) {
      setErrors({ directorCedula: 'La cédula es requerida' })
      return
    }
    if (!empresaLicencia) return

    setErrors({})

    // Validar contra la lista de directores del JSON
    const directorValido = empresaLicencia.directores.find(
      (d) => d.cedula === directorCedula.trim()
    )

    if (!directorValido) {
      setErrors({ directorCedula: 'Cédula no autorizada' })
      setMessage('❌ La cédula ingresada no corresponde a un director autorizado de esta empresa.')
      return
    }

    // Director válido → guardar nombre y pasar a seleccionar licencia
    setDirectorNombre(directorValido.nombre)
    setMessage(`✓ Director verificado: ${directorValido.nombre}`)
    setLicenciaSeleccionada(null)
    setStep('licencia')
  }

  const handleSeleccionarLicencia = async () => {
    if (!licenciaSeleccionada) {
      setErrors({ licencia: 'Debe seleccionar una licencia' })
      return
    }
    if (!empresaLicencia) return

    setLoading(true)
    setErrors({})
    setMessage('Procesando...')

    // 1. Enviar la licencia seleccionada a la API webhook
    try {
      await fetch('https://agentehgi.hginet.com.co/webhook/72919732-5851-4c49-966f-36f638298c88', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nit: nit.trim(),
          razon_social: empresaLicencia.razon_social,
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
    let empresaNombre = empresaLicencia.razon_social

    try {
      const result = await verificarEmpresa(nit.trim())

      if (result.existe && result.empresa) {
        empresaId = result.empresa.id_empresa
        empresaNombre = result.empresa.nombre_empresa
      } else {
        // Crear empresa automáticamente con la razón social del JSON
        const nuevaEmpresa = await crearEmpresa({
          nit: nit.trim(),
          nombre_empresa: empresaLicencia.razon_social,
        })
        empresaId = nuevaEmpresa.id_empresa
      }
    } catch (error: any) {
      console.warn('Error al verificar/crear empresa:', error)
      setErrors({ licencia: error.message || 'Error al registrar la empresa' })
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
      setErrors({ licencia: error.message || 'Error al registrar el contacto' })
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
      handleVerificarNit()
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
            {empresaLicencia && (
              <div className="licencias-info">
                <p className="licencias-titulo">{empresaLicencia.razon_social}</p>
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
        {step === 'licencia' && empresaLicencia && (
          <>
            <div className="licencias-info">
              <p className="licencias-titulo">{empresaLicencia.razon_social}</p>
              <p className="licencias-subtitulo">Seleccione la licencia</p>
              <ul className="licencias-lista">
                {[...empresaLicencia.licencias]
                  .filter((l) => l.codigo !== '01' && l.codigo !== '0' && l.activa)
                  .map((l) => (
                    <li
                      key={l.id}
                      className={`licencia-item licencia-seleccionable ${licenciaSeleccionada === l.nombre ? 'licencia-selected' : ''}`}
                      onClick={() => {
                        setLicenciaSeleccionada(l.nombre)
                        if (errors.licencia) {
                          setErrors(prev => { const n = { ...prev }; delete n.licencia; return n })
                        }
                      }}
                    >
                      <span className={`licencia-dot dot-activa`} />
                      <span className="licencia-nombre">{l.nombre}</span>
                      {licenciaSeleccionada === l.nombre && <span className="licencia-check">✓</span>}
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
