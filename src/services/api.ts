import {
  countDataImageBlocksInMarkdown,
  extractHttpsImageUrlsFromMarkdown,
  logIa360ImageConsole,
} from '../utils/ia360ImageConsole';
import {
  compactImgPlaceholdersForHistory,
  stripDataUriImagesFromMarkdown,
} from '../utils/ia360HistorySanitize';

//const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3004/api';
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
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

/**
 * Si es true, no se llama GET /ia360-doc/historial al abrir IA360 (solo sesión actual).
 * Prioridad: 1) query ?ia360SkipHistorial= (el loader del iframe la añade desde IsaWidgetConfig), 2) IsaWidgetConfig en la misma ventana, 3) VITE_IA360_SKIP_HISTORIAL en build.
 */
export function getIa360SkipHistorial(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('ia360SkipHistorial');
    if (q === '1' || q === 'true' || q === 'yes') return true;
    if (q === '0' || q === 'false' || q === 'no') return false;

    const cfg = (window as unknown as { IsaWidgetConfig?: { ia360SkipHistorial?: boolean | string } })
      .IsaWidgetConfig?.ia360SkipHistorial;
    if (cfg === true || cfg === 'true' || cfg === '1') return true;
    if (cfg === false || cfg === 'false' || cfg === '0') return false;
  }
  return (
    import.meta.env.VITE_IA360_SKIP_HISTORIAL === 'true' ||
    import.meta.env.VITE_IA360_SKIP_HISTORIAL === '1'
  );
}

function shouldLogIa360ChatLatency(): boolean {
  return (
    Boolean(import.meta.env.DEV) ||
    import.meta.env.VITE_IA360_LOG_CHAT_MS === 'true' ||
    import.meta.env.VITE_IA360_LOG_CHAT_MS === '1'
  );
}

/** Consola: ms desde el POST hasta tener la respuesta (incluye renovación JWT si aplica). */
function logIa360ChatResponseMs(t0: number, detail: Record<string, unknown>): void {
  if (!shouldLogIa360ChatLatency()) return;
  const ms = Math.round(performance.now() - t0);
  console.info(`[IA360] tiempo hasta respuesta: ${ms} ms`, detail);
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

/** Chat con Isa (bot) — consultable en CRM por `conversaciones.canal = 'WEB_ISA'`. */
export const CANAL_WIDGET_ISA = 'WEB_ISA';

/** Cola “chatear con agente” — canal distinto de Isa y de IA360_DOC. */
export const CANAL_WIDGET_AGENTE = 'WEB_AGENTE';

export async function crearConversacion(
  empresaId: number,
  contactoId: number,
  opts?: { canal?: string },
): Promise<Conversacion> {
  const canal = opts?.canal ?? 'WEB';
  const response = await fetch(`${API_BASE_URL}/conversaciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      empresa_id: empresaId,
      contacto_id: contactoId,
      canal,
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
  tipo_emisor: 'CONTACTO' | 'BOT' | 'IA360' | 'SISTEMA';
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
export async function obtenerTokenAccesoFAQ(
  empresaId: number,
  contactoId: number,
  /** Si se envía, queda firmado en el JWT (asistente documentación / servicio en ese momento). */
  servicio?: string
): Promise<string | null> {
  const apiBase = getRuntimeApiBaseUrl() !== null && getRuntimeApiBaseUrl() !== ''
    ? getBackendBaseUrl() + '/api'
    : API_BASE_URL;
  const url = apiBase.replace(/\/$/, '') + '/faq-acceso';
  const body: { empresaId: number; contactoId: number; servicio?: string } = { empresaId, contactoId };
  if (servicio != null && String(servicio).trim() !== '') {
    body.servicio = String(servicio).trim();
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { success?: boolean; token?: string };
  if (data?.success && typeof data?.token === 'string') return data.token;
  return null;
}

/**
 * Registra el JWT en el API y devuelve un id de un solo uso para abrir FAQ/asistente sin el token en la URL (?otk=...).
 */
export async function crearHandoffDesdeToken(token: string): Promise<string | null> {
  const apiBase = getRuntimeApiBaseUrl() !== null && getRuntimeApiBaseUrl() !== ''
    ? getBackendBaseUrl() + '/api'
    : API_BASE_URL;
  const url = apiBase.replace(/\/$/, '') + '/faq-acceso/handoff';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = (await res.json()) as { success?: boolean; handoffId?: string };
  if (data?.success && typeof data?.handoffId === 'string') return data.handoffId;
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

// --- IA360 (documentación) vía API: mismo backend que FAQ; chat en widget (POST /ia360-doc/chat) ---

function getApiBaseForIa360(): string {
  return getRuntimeApiBaseUrl() !== null && getRuntimeApiBaseUrl() !== ''
    ? `${getBackendBaseUrl()}/api`
    : API_BASE_URL;
}

export type Ia360TokenRenewalOptions = {
  /** Mismo servicio firmado en el JWT (Prueba / IA360) para incluir en la renovación. */
  servicio?: string;
  /** Si el API responde 401, se llama a /faq-acceso/renovar y, si hay token nuevo, se ejecuta este callback y se reintenta una vez. */
  onTokenRenewed?: (newToken: string) => void;
};

/**
 * Renueva el JWT FAQ/IA360 (firma válida aunque haya expirado). POST /api/faq-acceso/renovar
 */
export async function renewFaqAccessToken(
  currentToken: string,
  servicio?: string
): Promise<string | null> {
  const base = getApiBaseForIa360().replace(/\/$/, '');
  const url = `${base}/faq-acceso/renovar`;
  const body: { token: string; servicio?: string } = { token: currentToken.trim() };
  const s = servicio?.trim();
  if (s) body.servicio = s;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { success?: boolean; token?: string };
  if (res.ok && data?.success && typeof data.token === 'string') return data.token;
  return null;
}

export interface Ia360ContextoResponse {
  success?: boolean;
  empresa_nombre?: string;
  empresa_nit?: string | null;
  contacto_nombre?: string;
  contacto_documento?: string | null;
  contacto_cargo?: string | null;
  message?: string;
}

/** GET /ia360-doc/contexto — contexto empresa/contacto para cabecera del chat IA360 */
export async function getIa360Contexto(
  token: string,
  renewal?: Ia360TokenRenewalOptions
): Promise<Ia360ContextoResponse | null> {
  const base = getApiBaseForIa360().replace(/\/$/, '');
  const fetchCtx = async (tok: string) => {
    const url = `${base}/ia360-doc/contexto?token=${encodeURIComponent(tok)}`;
    return fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  };
  let res = await fetchCtx(token);
  if (res.status === 401 && renewal?.onTokenRenewed) {
    const nt = await renewFaqAccessToken(token, renewal.servicio);
    if (nt) {
      renewal.onTokenRenewed(nt);
      res = await fetchCtx(nt);
    }
  }
  const data = (await res.json()) as Ia360ContextoResponse;
  if (!res.ok || !data?.success) return null;
  return data;
}

export interface Ia360HistorialMensaje {
  id?: number;
  rol: 'usuario' | 'asistente';
  contenido: string;
  creado_en?: string | null;
}

/** GET /ia360-doc/historial */
export async function getIa360Historial(
  token: string,
  limite = 500,
  renewal?: Ia360TokenRenewalOptions
): Promise<Ia360HistorialMensaje[]> {
  const base = getApiBaseForIa360().replace(/\/$/, '');
  const fetchHist = async (tok: string) => {
    const url = `${base}/ia360-doc/historial?token=${encodeURIComponent(tok)}&limite=${limite}`;
    return fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  };
  let res = await fetchHist(token);
  if (res.status === 401 && renewal?.onTokenRenewed) {
    const nt = await renewFaqAccessToken(token, renewal.servicio);
    if (nt) {
      renewal.onTokenRenewed(nt);
      res = await fetchHist(nt);
    }
  }
  const data = (await res.json()) as {
    success?: boolean;
    mensajes?: Array<{ rol?: string; contenido?: string; creado_en?: string | null }>;
  };
  if (!res.ok || !data?.success || !Array.isArray(data.mensajes)) return [];
  const out: Ia360HistorialMensaje[] = [];
  for (const m of data.mensajes) {
    const rol = m.rol === 'usuario' ? 'usuario' : m.rol === 'asistente' ? 'asistente' : null;
    if (!rol || typeof m.contenido !== 'string') continue;
    out.push({ rol, contenido: m.contenido, creado_en: m.creado_en ?? null });
  }
  return out;
}

/** POST /ia360-doc/mensaje — guarda un mensaje en CRM sin invocar al modelo (saludo inicial, etc.) */
export async function guardarIa360MensajeDoc(params: {
  token: string;
  rol: 'usuario' | 'asistente';
  contenido: string;
  servicio?: string;
  onTokenRenewed?: (newToken: string) => void;
}): Promise<void> {
  const base = getApiBaseForIa360().replace(/\/$/, '');
  const url = `${base}/ia360-doc/mensaje`;
  const post = async (tok: string) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        token: tok,
        rol: params.rol,
        contenido: params.contenido.trim(),
      }),
    });
  let res = await post(params.token);
  if (res.status === 401 && params.onTokenRenewed) {
    const nt = await renewFaqAccessToken(params.token, params.servicio);
    if (nt) {
      params.onTokenRenewed(nt);
      res = await post(nt);
    }
  }
  const data = (await res.json()) as { success?: boolean; message?: string };
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || `Error ${res.status}`);
  }
}

/** POST /ia360-doc/chat — una pregunta; el API guarda usuario + asistente en CRM */
export async function enviarIa360DocChat(params: {
  token: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  servicio?: string;
  onTokenRenewed?: (newToken: string) => void;
}): Promise<{ reply: string; warning?: string; ia360Images?: Record<string, string> }> {
  const t0 = performance.now();
  const base = getApiBaseForIa360().replace(/\/$/, '');
  const url = `${base}/ia360-doc/chat`;

  logIa360ImageConsole('chat: consulta iniciada', {
    endpoint: url,
    mensaje: params.message.trim().slice(0, 200),
    historialMensajes: params.history.length,
  });
  try {
    const historyForApi = params.history.map((h) => ({
      role: h.role,
      content:
        h.role === 'assistant'
          ? compactImgPlaceholdersForHistory(stripDataUriImagesFromMarkdown(h.content))
          : stripDataUriImagesFromMarkdown(h.content),
    }));
    const buildBody = (tok: string) => {
      const body: Record<string, unknown> = {
        token: tok,
        message: params.message.trim(),
        history: historyForApi,
      };
      if (params.servicio?.trim()) body.servicio = params.servicio.trim();
      return body;
    };
    const post = async (tok: string) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(buildBody(tok)),
      });
    let res = await post(params.token);
    if (res.status === 401 && params.onTokenRenewed) {
      const nt = await renewFaqAccessToken(params.token, params.servicio);
      if (nt) {
        params.onTokenRenewed(nt);
        res = await post(nt);
      }
    }
    const data = (await res.json()) as {
      success?: boolean;
      reply?: string;
      message?: string;
      warning?: string;
      ia360Images?: Record<string, string>;
    };
    if (!res.ok || !data?.success) {
      throw new Error(data?.message || `Error ${res.status}`);
    }
    const reply = typeof data.reply === 'string' ? data.reply : '';
    const ia360Images =
      data.ia360Images && typeof data.ia360Images === 'object' ? data.ia360Images : undefined;
    const linksHttps = extractHttpsImageUrlsFromMarkdown(reply);
    const nData = countDataImageBlocksInMarkdown(reply);
    const nImgKeys = ia360Images ? Object.keys(ia360Images).length : 0;
    logIa360ImageConsole('chat: respuesta recibida', {
      ok: true,
      warning: data.warning ?? null,
      imagenesHttpsEnReply: linksHttps.length,
      imagenesDataUriEnReply: nData,
      clavesIa360Images: nImgKeys,
    });
    linksHttps.forEach((link, i) => {
      logIa360ImageConsole(`chat: link imagen [${i + 1}/${linksHttps.length}]`, { link });
    });
    if (nData > 0) {
      logIa360ImageConsole('chat: imágenes inline (data:) en reply', {
        cantidad: nData,
        nota: 'El enlace original era https; el API ya devolvió base64 en el markdown.',
      });
    }
    if (nImgKeys > 0) {
      logIa360ImageConsole('chat: mapa ia360Images (Agente01-style)', {
        cantidad: nImgKeys,
        nota: 'El markdown usa IMG:XXXX; el mapa trae data: o URL por clave.',
      });
    }
    logIa360ChatResponseMs(t0, {
      exito: true,
      caracteresReply: reply.length,
      imagenesHttps: linksHttps.length,
      imagenesDataUri: nData,
      ia360ImageKeys: nImgKeys,
    });
    return { reply, warning: data.warning, ia360Images };
  } catch (e) {
    logIa360ChatResponseMs(t0, {
      exito: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

