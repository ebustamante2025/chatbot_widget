const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';

// URL base del backend (sin /api) para health y WebSocket
export const getBackendBaseUrl = (): string => {
  const url = API_BASE_URL.replace(/\/api\/?$/, '');
  return url || API_BASE_URL;
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

export interface VerificarEmpresaResponse {
  existe: boolean;
  licenciaValida?: boolean;
  empresa?: Empresa;
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

// --- Agente Isa (webhook) ---
const ISA_AGENT_WEBHOOK_URL =
  import.meta.env.VITE_ISA_AGENT_WEBHOOK_URL ||
  'https://agentehgi.hginet.com.co/webhook/72919732-5851-4c49-966f-36f638298c88';

/**
 * Envía un mensaje al agente Isa y devuelve la respuesta.
 * Body: { sessionId, action: "sendMessage", chatInput } 
 */
export async function sendMessageToIsaAgent(
  sessionId: string,
  chatInput: string
): Promise<string> {
  const response = await fetch(ISA_AGENT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      action: 'sendMessage',
      chatInput: chatInput.trim(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Error ${response.status}`;
    try {
      const json = JSON.parse(text);
      message = json.message || json.error || message;
    } catch {
      if (text) message = text.slice(0, 100);
    }
    throw new Error(message);
  }

  const data = await response.json();
  // La API devuelve { sessionId, answer } — usamos answer como texto de Isa
  const text =
    data.answer ??
    data.message ??
    data.response ??
    data.output ??
    data.text ??
    (typeof data === 'string' ? data : null);
  if (text != null && typeof text === 'string') return text;
  return 'No pude procesar la respuesta. Intenta de nuevo.';
}
