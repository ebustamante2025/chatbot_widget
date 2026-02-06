# 🤖 Cómo Funciona el Chatbot Isa

Esta guía explica la arquitectura y el funcionamiento interno del widget del chatbot.

## 📋 Tabla de Contenidos

0. [**Proceso del chat (resumen)**](#proceso-del-chat-resumen)
1. [Arquitectura General](#arquitectura-general)
2. [Flujo de Funcionamiento](#flujo-de-funcionamiento)
3. [Componentes Principales](#componentes-principales)
4. [Estados y Datos](#estados-y-datos)
5. [Flujo de Usuario](#flujo-de-usuario)

---

## 🔁 Proceso del chat (resumen)

Así funciona el chat de punta a punta:

### Paso 1: Abrir el widget

- El usuario ve un **botón flotante** (ej. “Isa”) en la página.
- Al hacer clic, se abre la **ventana del chat**.

### Paso 2: Registro (si no está registrado)

- Se muestra el **formulario de registro**:
  1. **NIT** de la empresa → el sistema verifica si la empresa existe en la base de datos (y si la licencia es válida cuando está activa).
  2. Si la empresa no existe: se pide **nombre de la empresa** y se crea.
  3. **Cédula** del contacto → al salir del campo se verifica si ya existe un contacto con esa cédula en esa empresa.
  4. Si el contacto existe: se muestran sus datos y puede **“Continuar con este contacto”**.
  5. Si no existe: se pide **nombre** y **cargo** y se **crea el contacto**.
- Al terminar, los datos se guardan en el estado del widget y se pasa al **panel de opciones**.

### Paso 3: Panel de opciones

- Tras el registro se muestra un **panel** con tres opciones:
  - **Preguntas frecuentes**: lista de preguntas y respuestas (solo lectura).
  - **Chatear con Isa**: abre el chat con el asistente virtual.
  - **Chatear con un agente**: pantalla de “en cola” para atención humana (placeholder).
- El usuario elige **“Chatear con Isa”** para hablar con el bot.

### Paso 4: Chat con Isa (flujo de cada mensaje)

1. **Usuario escribe** en el campo de texto y envía (Enter o botón).
2. El **widget**:
   - Añade el mensaje del usuario a la lista (burbuja “user”).
   - Deshabilita el input (“Esperando respuesta...”).
   - Usa un **sessionId** único por sesión (generado al cargar el chat, guardado en un `ref`).
3. **Llamada a la API de Isa** (desde el frontend):
   - **URL:** `https://agentehgi.hginet.com.co/webhook/prueba-api` (configurable con `VITE_ISA_AGENT_WEBHOOK_URL`).
   - **Método:** `POST`.
   - **Body:**
     ```json
     {
       "sessionId": "eda9e7fb0fce414891e24608e3ac4e07",
       "action": "sendMessage",
       "chatInput": "HOLA"
     }
     ```
4. **La API responde** con algo como:
   ```json
   {
     "sessionId": "eda9e7fb0fce414891e24608e3ac4e07",
     "answer": "Estoy aquí para atender cualquier pregunta que tengas sobre HGI..."
   }
   ```
5. El **widget**:
   - Toma el texto de **`answer`** y lo muestra como mensaje de Isa (burbuja “isa”).
   - Vuelve a habilitar el input y devuelve el foco al campo de texto.
6. Si la petición **falla** (red o error del servidor), se muestra un mensaje de error como si fuera respuesta de Isa (por ejemplo: “No pude conectar con el agente. Intenta de nuevo.”).

### Resumen técnico del chat de Isa

| Elemento        | Dónde / Cómo |
|-----------------|--------------|
| **sessionId**   | Se genera uno por sesión (UUID sin guiones) y se reutiliza en todas las peticiones a la API. |
| **Request**     | `POST` al webhook con `sessionId`, `action: "sendMessage"`, `chatInput: "<texto del usuario>"`. |
| **Response**    | JSON con `answer`; ese string es el texto que muestra Isa en el chat. |
| **Foco**        | El input tiene `autoFocus` y se vuelve a enfocar cuando deja de estar deshabilitado (tras la respuesta). |

Con esto, el **proceso** del chat es: **usuario escribe → widget envía a la API → API responde con `answer` → widget muestra esa respuesta como mensaje de Isa** y queda listo para el siguiente mensaje.

---

## 🏗️ Arquitectura General

El proyecto está construido con **React 18** y **TypeScript**, usando **Vite** como herramienta de construcción.

```
widget-chatbot/
├── src/
│   ├── main.tsx              # Punto de entrada - Renderiza la app
│   ├── App.tsx               # Componente raíz
│   ├── types.ts              # Definiciones de tipos TypeScript
│   └── components/
│       ├── Chatbot.tsx       # Componente principal (orquestador)
│       ├── RegistrationForm.tsx  # Formulario de registro
│       ├── MessageList.tsx   # Lista de mensajes
│       ├── MessageInput.tsx  # Input para escribir mensajes
│       └── ChatIcon.tsx      # Icono del agente Isa
```

---

## 🔄 Flujo de Funcionamiento

### 1. Inicialización

```
main.tsx → App.tsx → Chatbot.tsx
```

1. **`main.tsx`**: Punto de entrada que renderiza la aplicación React en el elemento `#root`
2. **`App.tsx`**: Componente raíz que contiene el contenedor principal
3. **`Chatbot.tsx`**: Componente principal que maneja toda la lógica del chatbot

### 2. Estados del Chatbot

El chatbot tiene **3 estados principales**:

```typescript
1. Cerrado (isOpen = false)
   └─> Muestra el botón flotante "Isa"

2. Abierto - Registro (isOpen = true, isRegistered = false)
   └─> Muestra el formulario de registro

3. Abierto - Chat Activo (isOpen = true, isRegistered = true)
   └─> Muestra la interfaz de chat completa
```

---

## 🧩 Componentes Principales

### 1. **Chatbot.tsx** - El Orquestador

Este es el componente principal que controla todo el flujo:

#### Estados que maneja:
- `isOpen`: Controla si el chat está abierto o cerrado
- `isRegistered`: Indica si el usuario completó el registro
- `userData`: Almacena los datos del usuario (NIT, empresa, funcionario, categoría)
- `messages`: Array con todos los mensajes del chat

#### Funciones principales:

```typescript
handleRegistration(data)
├─> Guarda los datos del usuario
├─> Marca como registrado
└─> Crea mensaje de bienvenida personalizado

handleSendMessage(text)
├─> Crea mensaje del usuario
├─> Lo agrega a la lista de mensajes
├─> Espera 1 segundo (simula delay)
└─> Genera y agrega respuesta de Isa

generateResponse(userMessage)
└─> Analiza el mensaje del usuario
    └─> Retorna respuesta personalizada según palabras clave
```

#### Lógica de renderizado:

```jsx
{isOpen ? (
  {!isRegistered ? (
    <RegistrationForm />  // Paso 1: Registro
  ) : (
    <ChatWindow />        // Paso 2: Chat activo
  )
) : (
  <FloatingButton />     // Botón flotante
)}
```

---

### 2. **RegistrationForm.tsx** - Formulario de Registro

Componente que recopila la información inicial del usuario.

#### Campos del formulario:
1. **NIT de la Empresa** (texto, requerido)
2. **Nombre de la Empresa** (texto, requerido)
3. **Nombre del Funcionario** (texto, requerido)
4. **Categoría de Soporte** (select, requerido)
   - Opciones: Administrativo, Contable, Nómina, POS

#### Flujo:
```
Usuario llena formulario
    ↓
Valida campos (validateForm)
    ↓
Si válido → onSubmit(data)
    ↓
Chatbot.tsx recibe datos
    ↓
Crea mensaje de bienvenida personalizado
```

#### Validación:
- Verifica que todos los campos estén completos
- Muestra mensajes de error específicos
- Previene envío si hay errores

---

### 3. **MessageList.tsx** - Lista de Mensajes

Componente que muestra todos los mensajes del chat.

#### Características:
- Scroll automático al final cuando hay nuevos mensajes
- Diferencia visual entre mensajes del usuario e Isa
- Muestra timestamp de cada mensaje
- Animación al agregar nuevos mensajes

#### Estructura de un mensaje:
```typescript
{
  id: string           // Identificador único
  text: string         // Contenido del mensaje
  sender: 'user' | 'isa'  // Quién envió el mensaje
  timestamp: Date      // Cuándo se envió
}
```

---

### 4. **MessageInput.tsx** - Input de Mensajes

Componente para escribir y enviar mensajes.

#### Funcionalidades:
- Input de texto con placeholder
- Botón de envío (deshabilitado si está vacío)
- Envío con Enter (sin Shift)
- Diseño responsive

#### Flujo:
```
Usuario escribe mensaje
    ↓
Presiona Enter o clic en enviar
    ↓
handleSendMessage(text)
    ↓
Se agrega a la lista de mensajes
```

---

### 5. **ChatIcon.tsx** - Icono del Agente

Componente SVG que muestra el icono personalizado de Isa.

#### Elementos visuales:
- Círculo de fondo azul (#001689)
- Cabeza del robot/avatar
- Auriculares con micrófono
- Sonrisa amigable

---

## 📊 Estados y Datos

### Tipos de Datos (types.ts)

```typescript
// Mensaje del chat
interface Message {
  id: string
  text: string
  sender: 'user' | 'isa'
  timestamp: Date
}

// Datos del usuario
interface UserData {
  nit: string
  empresa: string
  funcionario: string
  categoriaSoporte: 'Administrativo' | 'Contable' | 'Nómina' | 'POS'
}
```

### Estados en Chatbot.tsx

```typescript
const [isOpen, setIsOpen] = useState(false)
// Controla si el chat está visible

const [isRegistered, setIsRegistered] = useState(false)
// Indica si el usuario completó el registro

const [userData, setUserData] = useState<UserData | null>(null)
// Almacena: NIT, empresa, funcionario, categoría

const [messages, setMessages] = useState<Message[]>([])
// Array con todos los mensajes del chat
```

---

## 👤 Flujo de Usuario Completo

### Paso 1: Usuario ve el botón flotante
```
Página del CRM
    ↓
Botón flotante "Isa" (esquina inferior derecha)
    ↓
Usuario hace clic
```

### Paso 2: Formulario de Registro
```
Chat se abre
    ↓
Muestra RegistrationForm
    ↓
Usuario completa:
  - NIT
  - Empresa
  - Funcionario
  - Categoría de Soporte
    ↓
Clic en "Continuar"
    ↓
Validación
    ↓
Si válido → Registro completado
```

### Paso 3: Mensaje de Bienvenida
```
Sistema genera mensaje personalizado:
"¡Hola [Funcionario] de [Empresa]! Soy Isa, 
tu asistente virtual. Veo que necesitas soporte 
en el área de [Categoría]. ¿En qué puedo ayudarte hoy?"
    ↓
Se muestra en MessageList
```

### Paso 4: Conversación
```
Usuario escribe mensaje
    ↓
Se agrega a la lista (burbuja azul, lado derecho)
    ↓
Espera 1 segundo (simula procesamiento)
    ↓
Isa genera respuesta (burbuja blanca, lado izquierdo)
    ↓
Se muestra en la lista
    ↓
Scroll automático al final
```

### Paso 5: Generación de Respuestas

La función `generateResponse()` analiza el mensaje del usuario:

```typescript
Si contiene "hola" o "hi"
  → "¡Hola [Nombre]! Me alegra que estés aquí..."

Si contiene "ayuda" o "help"
  → "[Nombre], estoy aquí para ayudarte..."

Si contiene "gracias" o "thanks"
  → "¡De nada [Nombre]! Estoy aquí para ayudarte..."

Si contiene "adiós" o "bye"
  → "¡Hasta luego [Nombre]! Fue un placer..."

Si no coincide con nada
  → "[Nombre], entiendo que dices: [mensaje]. 
      Estoy aquí para ayudarte..."
```

**Nota**: Todas las respuestas personalizan el nombre del funcionario si está disponible.

---

## 🎨 Estilos y Diseño

### Sistema de Colores
- **Color principal**: `#001689` (azul oscuro)
- **Mensajes usuario**: Fondo azul con texto blanco
- **Mensajes Isa**: Fondo blanco con texto oscuro
- **Botones**: Gradiente azul con hover effects

### Responsive Design
- **Desktop**: Widget de 400x650px en esquina
- **Tablet**: Widget de 350x600px
- **Mobile**: Widget a pantalla completa

### Animaciones
- Slide up al abrir el chat
- Fade in para nuevos mensajes
- Hover effects en botones
- Scroll suave al final de mensajes

---

## 🔧 Funcionalidades Técnicas

### Auto-scroll
```typescript
useEffect(() => {
  scrollToBottom()
}, [messages])
```
Cada vez que se agrega un nuevo mensaje, el chat hace scroll automático al final.

### Validación de Formulario
- Validación en tiempo real
- Mensajes de error específicos
- Prevención de envío con errores

### Gestión de Estado
- React Hooks (useState, useEffect, useRef)
- Estado local en cada componente
- Props para comunicación entre componentes

---

## 🚀 Integración en CRM

### Como Iframe
El widget se puede integrar en cualquier CRM usando un iframe:

```html
<iframe src="https://tudominio.com/widget-chatbot/index.html"></iframe>
```

### Script Loader
También se puede cargar dinámicamente con un script:

```html
<script src="isa-widget-loader.js"></script>
```

---

## 📝 Resumen del Flujo Completo

```
1. Usuario ve botón flotante "Isa"
   ↓
2. Clic en botón → Se abre formulario de registro
   ↓
3. Usuario completa: NIT, Empresa, Funcionario, Categoría
   ↓
4. Validación → Si OK, se registra
   ↓
5. Mensaje de bienvenida personalizado aparece
   ↓
6. Usuario escribe mensaje
   ↓
7. Mensaje se muestra (lado derecho, azul)
   ↓
8. Isa analiza y responde (lado izquierdo, blanco)
   ↓
9. Conversación continúa...
```

---

## 🔄 Próximos Pasos de Desarrollo

Actualmente el chatbot tiene respuestas básicas. Para producción, podrías:

1. **Conectar con API backend** para respuestas reales
2. **Integrar con base de datos** para guardar conversaciones
3. **Agregar más lógica de negocio** según categoría de soporte
4. **Implementar autenticación** si es necesario
5. **Agregar historial de conversaciones**
6. **Integrar con sistema de tickets** del CRM

---

¿Tienes alguna pregunta específica sobre cómo funciona alguna parte del código?


