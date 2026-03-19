const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

/** URL base del backend en runtime (query ?apiBaseUrl= o window.IsaWidgetConfig.apiBaseUrl). Si se define, tiene prioridad sobre la de build. */
let runtimeApiBaseUrl: string | null = null;

export function setRuntimeApiBaseUrl(url: string | null): void {
  runtimeApiBaseUrl = url;
}

function getRuntimeApiBaseUrl(): string | null {
  if (runtimeApiBaseUrl !== null) return runtimeApiBaseUrl;
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('apiBaseUrl');
  if (fromQuery !== null) return fromQuery === '' ? '' : fromQuery;
  const fromConfig = (window as unknown as { IsaWidgetConfig?: { apiBaseUrl?: string } }).IsaWidgetConfig?.apiBaseUrl;
  if (fromConfig !== undefined) return fromConfig;
  return null;
}

// URL base del backend (sin /api) para health y WebSocket.
// Prioridad: 1) runtime (?apiBaseUrl= o IsaWidgetConfig.apiBaseUrl), 2) build (VITE_API_URL).
// Si es relativa o vacía, se usa mismo origen para que Socket.IO use /socket.io/.
export const getBackendBaseUrl = (): string => {
  const runtime = getRuntimeApiBaseUrl();
  if (runtime !== null) {
    const base = runtime.replace(/\/api\/?$/, '');
    return base;
  }
  const url = API_BASE_URL.replace(/\/api\/?$/, '');
  return url || '';
};

export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export interface Empresa {
  id_empresa: number;
  nit: string;
  nombre_empresa: string;
  estado: boolean;
}

export interface Contacto {
  id_contacto: number;
  empresa_id: number;
  tipo: string;
  nombre: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  documento?: string;
  creado_en: string;
}

export interface ContratoVigente {
  Codigo: string;
  Descripcion: string;
  FechaInicial?: string;
  FechaFinal?: string;
}

export interface ContactoCliente {
  Identificacion: string;
  Nombres: string;
  Apellidos: string;
  Email?: string;
  Celular?: string;
  Telefono?: string;
}

export interface VerificarEmpresaResponse {
  existe: boolean;
  licenciaValida?: boolean;
  nit?: string;
  nombre_empresa?: string;
  empresa?: Empresa;
  contratosVigentes?: ContratoVigente[];
  contactosClientes?: ContactoCliente[];
}

export interface CrearEmpresaRequest {
  nit: string;
  nombre_empresa: string;
}

export interface CrearContactoRequest {
  empresa_id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  tipo_documento?: string;
  documento?: string;
  cargo?: string;
}

/**
 * Verifica conexión con el backend y estado de la base de datos.
 * @returns HealthResponse si el backend responde; lanza error si no hay conexión.
 */
export async function checkBackendHealth(): Promise<HealthResponse> {
  const healthUrl = `${getBackendBaseUrl()}/health`;
  try {
    const response = await fetch(healthUrl, { method: 'GET' });
    const data = await response.json();
    if (!response.ok) {
      // 503 = backend ok pero BD desconectada
      throw new Error(
        response.status === 503
          ? 'database'
          : `server:${response.status}`
      );
    }
    return data as HealthResponse;
  } catch (err: unknown) {
    if (err instanceof Error && (err.message === 'database' || err.message.startsWith('server:'))) {
      throw err;
    }
    // Fallo de red: backend inalcanzable
    throw new Error('unreachable');
  }
}

// Verificar si una empresa existe por NIT
export async function verificarEmpresa(nit: string): Promise<VerificarEmpresaResponse> {
  const response = await fetch(`${API_BASE_URL}/empresas/verificar/${encodeURIComponent(nit)}`);
  
  if (!response.ok) {
    // Si es error 403, es licencia vencida
    if (response.status === 403) {
      const error = await response.json();
      throw new Error(error.message || 'Licencia vencida');
    }
    throw new Error('Error al verificar la empresa');
  }
  
  return response.json();
}

// Crear nueva empresa
export async function crearEmpresa(data: CrearEmpresaRequest): Promise<Empresa> {
  const response = await fetch(`${API_BASE_URL}/empresas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    // Si es error 403, es licencia vencida
    if (response.status === 403) {
      const error = await response.json();
      throw new Error(error.message || 'Licencia vencida');
    }
    const error = await response.json();
    throw new Error(error.message || 'Error al crear la empresa');
  }
  
  const result = await response.json();
  return result.empresa;
}

export interface VerificarContactoResponse {
  existe: boolean;
  contacto?: Contacto;
}

// Verificar si ya existe un contacto por empresa_id y documento (cédula)
export async function verificarContacto(empresaId: number, documento: string): Promise<VerificarContactoResponse> {
  const response = await fetch(
    `${API_BASE_URL}/contactos/verificar/${empresaId}/${encodeURIComponent(documento.trim())}`
  );
  if (!response.ok) {
    throw new Error('Error al verificar el contacto');
  }
  return response.json();
}

// --- Conversaciones y mensajes (chat con agente) ---

export interface Conversacion {
  id_conversacion: number;
  empresa_id: number;
  contacto_id: number;
  estado: string;
  mensajes?: Array<{
    id_mensaje: number;
    tipo_emisor: string;
    contenido: string;
    creado_en: string;
  }>;
}

export async function crearConversacion(empresaId: number, contactoId: number): Promise<Conversacion> {
  const response = await fetch(`${API_BASE_URL}/conversaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empresa_id: empresaId,
      contacto_id: contactoId,
      canal: 'WEB',
      tema: 'SOPORTE',
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || 'Error al crear conversación');
  }
  const result = await response.json();
  return result.conversacion;
}

export async function obtenerConversacion(id: number): Promise<Conversacion> {
  const response = await fetch(`${API_BASE_URL}/conversaciones/${id}`);
  if (!response.ok) throw new Error('Error al obtener conversación');
  return response.json();
}

export async function enviarMensajeAgente(data: {
  empresa_id: number;
  conversacion_id: number;
  tipo_emisor: 'CONTACTO';
  contacto_id: number;
  contenido: string;
}): Promise<{ mensaje: unknown }> {
  const response = await fetch(`${API_BASE_URL}/mensajes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al enviar mensaje');
  return response.json();
}

// Guardar mensaje en BD (genérico: CONTACTO, BOT, SISTEMA)
export async function guardarMensajeBD(data: {
  empresa_id: number;
  conversacion_id: number;
  tipo_emisor: 'CONTACTO' | 'BOT' | 'SISTEMA';
  contacto_id?: number;
  contenido: string;
}): Promise<{ mensaje: unknown }> {
  const response = await fetch(`${API_BASE_URL}/mensajes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Error al guardar mensaje');
  return response.json();
}

/** URL del proxy de registro (webhook Isa) en el backend. Evita CORS al llamar al webhook externo. */
export function getWebhookProxyRegistroUrl(): string {
  const base = getBackendBaseUrl();
  return (base ? base.replace(/\/$/, '') : '') + '/api/webhook-proxy/registro';
}

/** Editar un mensaje enviado por el contacto (widget, con empresa_id/conversacion_id/contacto_id). */
export async function editarMensajeContacto(params: {
  id_mensaje: number;
  empresa_id: number;
  conversacion_id: number;
  contacto_id: number;
  contenido: string;
}): Promise<{ mensaje: unknown }> {
  const { id_mensaje, empresa_id, conversacion_id, contacto_id, contenido } = params;
  const response = await fetch(`${API_BASE_URL}/mensajes/contacto/${id_mensaje}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa_id, conversacion_id, contacto_id, contenido }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Error al editar mensaje');
  }
  return response.json();
}

/** Eliminar un mensaje enviado por el contacto (widget). */
export async function eliminarMensajeContacto(params: {
  id_mensaje: number;
  empresa_id: number;
  conversacion_id: number;
  contacto_id: number;
}): Promise<void> {
  const { id_mensaje, empresa_id, conversacion_id, contacto_id } = params;
  const response = await fetch(`${API_BASE_URL}/mensajes/contacto/${id_mensaje}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresa_id, conversacion_id, contacto_id }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Error al eliminar mensaje');
  }
}

/** Verifica si el servicio (licencia) existe en temas FAQ y tiene preguntas. */
export async function verificarServicioFAQ(servicio: string): Promise<{ existe: boolean; tienePreguntas?: boolean }> {
  const apiBase = getRuntimeApiBaseUrl() !== null && getRuntimeApiBaseUrl() !== ''
    ? getBackendBaseUrl() + '/api'
    : API_BASE_URL;
  const url = `${apiBase.replace(/\/$/, '')}/faq-acceso/verificar-servicio?servicio=${encodeURIComponent(servicio.trim())}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Error al verificar servicio FAQ');
  return res.json();
}

// Crear nuevo contacto
export async function crearContacto(data: CrearContactoRequest): Promise<Contacto> {
  const response = await fetch(`${API_BASE_URL}/contactos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al crear el contacto');
  }
  
  const result = await response.json();
  return result.contacto;
}

/** Obtiene un token de acceso a la página de preguntas frecuentes (validación NIT + usuario). */
export async function obtenerTokenAccesoFAQ(empresaId: number, contactoId: number): Promise<string | null> {
  const apiBase = getRuntimeApiBaseUrl() !== null && getRuntimeApiBaseUrl() !== ''
    ? getBackendBaseUrl() + '/api'
    : API_BASE_URL;
  const url = apiBase.replace(/\/$/, '') + '/faq-acceso';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empresaId, contactoId }),
  });
  const data = (await res.json()) as { success?: boolean; token?: string };
  if (data?.success && typeof data?.token === 'string') return data.token;
  return null;
}

// --- Agente Isa (webhooks) ---
// Al seleccionar el servicio en el registro → esta URL
export const ISA_REGISTRO_WEBHOOK_URL =
  import.meta.env.VITE_ISA_REGISTRO_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/1986379d-e2f5-4eb3-b925-146875342724';
// Al escribir y enviar mensajes en el chat → esta URL
export const ISA_AGENT_WEBHOOK_URL =
  import.meta.env.VITE_ISA_AGENT_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/72919732-5851-4c49-966f-36f638298c88';

/**
 * Decodifica el body de la respuesta como UTF-8 (o ISO-8859-1 si hay caracteres corruptos)
 * para evitar ?? en tildes y ñ cuando la API no envía charset correcto.
 */
async function parseJsonWithUtf8(response: Response): Promise<unknown> {
  const buffer = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (utf8.includes('\uFFFD')) {
    const latin1 = new TextDecoder('iso-8859-1').decode(buffer);
    try {
      return JSON.parse(latin1);
    } catch {
      return JSON.parse(utf8);
    }
  }
  return JSON.parse(utf8);
}

/**
 * Envía un mensaje al agente Isa y devuelve la respuesta.
 * Body: { sessionId, action: "sendMessage", chatInput }
 * Decodifica la respuesta como UTF-8 para mostrar bien tildes y ñ.
 */
export async function sendMessageToIsaAgent(
  sessionId: string,
  chatInput: string
): Promise<string> {
  const response = await fetch(ISA_AGENT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      sessionId,
      action: 'sendMessage',
      chatInput: chatInput.trim(),
    }),
  });

  if (!response.ok) {
    const buffer = await response.arrayBuffer();
    const utf8 = new TextDecoder('utf-8').decode(buffer);
    let message = `Error ${response.status}`;
    try {
      const json = JSON.parse(utf8);
      message = json.message || json.error || message;
    } catch {
      if (utf8) message = utf8.slice(0, 100);
    }
    throw new Error(message);
  }

  const data = await parseJsonWithUtf8(response);
  const item = Array.isArray(data) ? data[0] : data;
  const text =
    (item && typeof item === 'object' && (item as any)?.answer) ??
    (item && typeof item === 'object' && (item as any)?.message) ??
    (item && typeof item === 'object' && (item as any)?.response) ??
    (item && typeof item === 'object' && (item as any)?.output) ??
    (item && typeof item === 'object' && (item as any)?.text) ??
    (item && typeof item === 'object' && (item as any)?.reply) ??
    (typeof data === 'string' ? data : null);
  if (text != null && typeof text === 'string') return text;
  if (import.meta.env?.DEV) {
    console.warn('[Isa API] Respuesta sin texto reconocido:', data);
  }
  return 'No pude procesar la respuesta. Intenta de nuevo.';
}
