import { useState, useEffect, FormEvent } from 'react'
import { UserData } from '../types'
import { verificarEmpresa, crearEmpresa, crearContacto, verificarContacto, checkBackendHealth } from '../services/api'
import type { Contacto } from '../services/api'
import './RegistrationForm.css'

type ConnectionStatus = 'checking' | 'ok' | 'unreachable' | 'database_error'

interface RegistrationFormProps {
  onSubmit: (data: UserData) => void
  onClose?: () => void
}

function RegistrationForm({ onSubmit, onClose }: RegistrationFormProps) {
  const [step, setStep] = useState<'nit' | 'empresa' | 'contacto'>('nit')
  const [nit, setNit] = useState('')
  const [empresaNombre, setEmpresaNombre] = useState('')
  const [funcionario, setFuncionario] = useState('')
  const [cargo, setCargo] = useState('')
  const [cedula, setCedula] = useState('')
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const [empresaRegistrada, setEmpresaRegistrada] = useState(false)
  const [contactoExistente, setContactoExistente] = useState<Contacto | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')

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
      setErrors({ nit: 'El NIT es requerido' })
      return
    }

    setLoading(true)
    setErrors({})
    setMessage('')

    try {
      const result = await verificarEmpresa(nit.trim())
      
      if (result.existe && result.empresa) {
        setEmpresaRegistrada(true)
        setEmpresaId(result.empresa.id_empresa)
        setEmpresaNombre(result.empresa.nombre_empresa)
        setStep('contacto')
        setMessage(`✓ Empresa registrada: ${result.empresa.nombre_empresa}`)
      } else {
        setEmpresaRegistrada(false)
        setStep('empresa')
        setMessage('')
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Error al verificar el NIT'
      // Si el error contiene "licencia" o "vencida", mostrar mensaje especial
      if (errorMessage.toLowerCase().includes('licencia') || errorMessage.toLowerCase().includes('vencida')) {
        setErrors({ nit: 'Licencia vencida' })
        setMessage('❌ La licencia de esta empresa está vencida o no es válida. Por favor, contacte al administrador.')
      } else {
        setErrors({ nit: errorMessage })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCrearEmpresa = async () => {
    if (!empresaNombre.trim()) {
      setErrors({ empresa: 'El nombre de la empresa es requerido' })
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const nuevaEmpresa = await crearEmpresa({
        nit: nit.trim(),
        nombre_empresa: empresaNombre.trim(),
      })
      
      setEmpresaId(nuevaEmpresa.id_empresa)
      setStep('contacto')
      setMessage('✓ Empresa creada exitosamente')
    } catch (error: any) {
      const errorMessage = error.message || 'Error al crear la empresa'
      // Si el error contiene "licencia" o "vencida", mostrar mensaje especial
      if (errorMessage.toLowerCase().includes('licencia') || errorMessage.toLowerCase().includes('vencida')) {
        setErrors({ empresa: 'Licencia vencida' })
        setMessage('❌ La licencia de esta empresa está vencida o no es válida. Por favor, contacte al administrador.')
      } else {
        setErrors({ empresa: errorMessage })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerificarCedula = async () => {
    if (!cedula.trim()) {
      setErrors({ cedula: 'La cédula es requerida' })
      return
    }
    if (!empresaId) {
      setErrors({ general: 'Error: No se encontró la empresa' })
      return
    }
    setLoading(true)
    setErrors({})
    setMessage('')
    setContactoExistente(null)
    try {
      const result = await verificarContacto(empresaId, cedula.trim())
      if (result.existe && result.contacto) {
        setContactoExistente(result.contacto)
        setMessage('✓ Este contacto ya está registrado.')
      } else {
        setContactoExistente(null)
        setMessage('')
      }
    } catch (error: any) {
      setErrors({ cedula: error.message || 'Error al verificar la cédula' })
    } finally {
      setLoading(false)
    }
  }

  const handleContinuarConContactoExistente = () => {
    if (contactoExistente && empresaId) {
      onSubmit({
        nit,
        empresa: empresaNombre,
        funcionario: contactoExistente.nombre,
        empresaId,
        contactoId: contactoExistente.id_contacto,
      })
    }
  }

  const handleCrearContacto = async () => {
    if (!funcionario.trim()) {
      setErrors({ funcionario: 'El nombre del funcionario es requerido' })
      return
    }
    if (!cedula.trim()) {
      setErrors({ cedula: 'La cédula es requerida' })
      return
    }
    if (!empresaId) {
      setErrors({ general: 'Error: No se encontró la empresa' })
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const result = await crearContacto({
        empresa_id: empresaId,
        nombre: funcionario.trim(),
        cargo: cargo.trim() || undefined,
        tipo_documento: 'CC',
        documento: cedula.trim(),
      })
      onSubmit({
        nit,
        empresa: empresaNombre,
        funcionario: funcionario.trim(),
        empresaId,
        contactoId: result.id_contacto,
      })
    } catch (error: any) {
      const errMsg = error.message || 'Error al crear el contacto'
      if (errMsg.includes('ya existe') || errMsg.includes('documento')) {
        setErrors({ cedula: 'Ya existe un contacto con esta cédula en esta empresa.' })
      } else {
        setErrors({ funcionario: errMsg })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (step === 'nit') {
      await handleVerificarNit()
    } else if (step === 'empresa') {
      await handleCrearEmpresa()
    } else if (step === 'contacto') {
      if (contactoExistente) {
        handleContinuarConContactoExistente()
      } else {
        await handleCrearContacto()
      }
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

        {/* Paso 2: Datos de empresa (solo si no existe) */}
        {step === 'empresa' && (
          <div className="form-group">
            <label htmlFor="empresa">Nombre de la Empresa *</label>
            <input
              id="empresa"
              type="text"
              value={empresaNombre}
              onChange={(e) => {
                setEmpresaNombre(e.target.value)
                if (errors.empresa) {
                  setErrors(prev => {
                    const newErrors = { ...prev }
                    delete newErrors.empresa
                    return newErrors
                  })
                }
              }}
              placeholder="Ingresa el nombre de la empresa"
              className={errors.empresa ? 'error' : ''}
              disabled={loading}
            />
            {errors.empresa && <span className="error-message">{errors.empresa}</span>}
          </div>
        )}

        {/* Paso 3: Cédula y datos del contacto */}
        {step === 'contacto' && (
          <>
            {empresaRegistrada && (
              <div className="empresa-info">
                <strong>Empresa:</strong> {empresaNombre}
              </div>
            )}
            <div className="form-group">
              <label htmlFor="cedula">Cédula *</label>
              <input
                id="cedula"
                type="text"
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value)
                  setContactoExistente(null)
                  if (errors.cedula) {
                    setErrors(prev => {
                      const newErrors = { ...prev }
                      delete newErrors.cedula
                      return newErrors
                    })
                  }
                }}
                onBlur={() => {
                  if (cedula.trim() && empresaId && !loading) {
                    handleVerificarCedula()
                  }
                }}
                placeholder="Número de documento"
                className={errors.cedula ? 'error' : ''}
                disabled={loading}
              />
              {errors.cedula && <span className="error-message">{errors.cedula}</span>}
            </div>
            {contactoExistente ? (
              <div className="contacto-existente-info">
                <p className="contacto-existente-title">Contacto registrado:</p>
                <p><strong>Nombre:</strong> {contactoExistente.nombre}</p>
                {contactoExistente.cargo && <p><strong>Cargo:</strong> {contactoExistente.cargo}</p>}
                <p className="contacto-existente-hint">Haz clic en &quot;Continuar&quot;</p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="funcionario">Nombre del Contacto *</label>
                  <input
                    id="funcionario"
                    type="text"
                    value={funcionario}
                    onChange={(e) => {
                      setFuncionario(e.target.value)
                      if (errors.funcionario) {
                        setErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.funcionario
                          return newErrors
                        })
                      }
                    }}
                    placeholder="Ingresa tu nombre"
                    className={errors.funcionario ? 'error' : ''}
                    disabled={loading}
                  />
                  {errors.funcionario && <span className="error-message">{errors.funcionario}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="cargo">Cargo o Rol</label>
                  <input
                    id="cargo"
                    type="text"
                    value={cargo}
                    onChange={(e) => {
                      setCargo(e.target.value)
                      if (errors.cargo) {
                        setErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.cargo
                          return newErrors
                        })
                      }
                    }}
                    placeholder="Ej: Gerente, Analista, Director, etc."
                    className={errors.cargo ? 'error' : ''}
                    disabled={loading}
                  />
                  {errors.cargo && <span className="error-message">{errors.cargo}</span>}
                </div>
              </>
            )}
          </>
        )}

        <button 
          type="submit" 
          className="submit-button"
          disabled={loading}
        >
          {loading
            ? 'Procesando...'
            : step === 'contacto' && contactoExistente
              ? 'Continuar'
              : step === 'contacto'
                ? 'Continuar'
                : 'Siguiente'}
        </button>
      </form>
    </div>
  )
}

export default RegistrationForm

