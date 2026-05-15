/**
 * Mensajes de validación del registro (NIT, director, licencia).
 * Edita aquí para cambiar los textos que ve el usuario.
 */

export const MENSAJES_VALIDACION = {
  // --- NIT ---
  nitRequerido: 'El NIT es requerido',
  sinLicencia: 'Sin licencia',
  sinLicenciaMensaje:
    'Actualmente su empresa no cuenta con licencias activas para acceder al soporte en línea.\n\nPara validar el estado de la licencia o gestionar su activación, por favor comuníquese con el área de Servicio al Cliente.',
  errorVerificarNit: 'No se pudo verificar',
  errorVerificarNitFallback:
    'Actualmente su empresa no cuenta con licencias activas para acceder al soporte en línea.\n\nPara validar el estado de la licencia o gestionar su activación, por favor comuníquese con el área de Servicio al Cliente.',
  nitOk: (textoEmpresa: string, cantidad: number) =>
    `✓ ${textoEmpresa} — ${cantidad} licencia(s) vigente(s)`,

  // --- Director / cédula ---
  cedulaRequerida: 'La identificación es requerida',
  directorNoAutorizado: 'Identificación no autorizada',
  directorNoAutorizadoMensaje: 'La cédula ingresada no está registrada como Director de Proyecto para esta empresa. Verifique el número o contacte al administrador de su empresa para gestionar el acceso.',
  directorOk: (nombre: string) => `✓ Contacto verificado: ${nombre}`,

  // --- Licencia ---
  debeSeleccionarLicencia: 'Debe seleccionar una licencia',
  procesando: 'Procesando...',
  errorRegistrarEmpresa: 'Error al registrar la empresa',
  errorRegistrarContacto: 'Error al registrar el contacto',
} as const
