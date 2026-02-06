# Widget Chatbot - Isa

Widget de chatbot moderno desarrollado con React 18 y TypeScript, diseñado para funcionar en un iframe.

## 🚀 Características

- ✅ React 18.3 (última versión)
- ✅ TypeScript
- ✅ Diseño moderno y responsive
- ✅ Optimizado para iframe
- ✅ Agente virtual "Isa" con icono personalizado
- ✅ Interfaz de chat intuitiva
- ✅ Animaciones suaves
- ✅ Diseño mobile-first

## 📦 Instalación

```bash
cd apps/widget-chatbot
npm install
```

## 🛠️ Desarrollo

```bash
npm run dev
```

El widget estará disponible en `http://localhost:3001`

## 🏗️ Construcción

```bash
npm run build
```

Los archivos de producción se generarán en la carpeta `dist/`.

## 📝 Uso en iframe

Para usar el widget en un iframe, incluye el siguiente código HTML:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Página con Chatbot Isa</title>
</head>
<body>
    <h1>Mi Página Web</h1>
    <p>Contenido de la página...</p>
    
    <!-- Widget Chatbot Isa -->
    <iframe 
        src="http://localhost:3001" 
        width="100%" 
        height="700" 
        frameborder="0"
        style="border: none; position: fixed; bottom: 0; right: 0; width: 400px; height: 650px; z-index: 9999;"
        allow="microphone"
    ></iframe>
</body>
</html>
```

### Ejemplo completo de integración

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ejemplo - Chatbot Isa</title>
    <style>
        body {
            margin: 0;
            font-family: Arial, sans-serif;
        }
        .content {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .chatbot-iframe {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 400px;
            height: 650px;
            border: none;
            z-index: 9999;
            box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 480px) {
            .chatbot-iframe {
                width: 100%;
                height: 100vh;
            }
        }
    </style>
</head>
<body>
    <div class="content">
        <h1>Bienvenido a mi sitio web</h1>
        <p>Este es un ejemplo de integración del chatbot Isa.</p>
        <p>El chatbot aparece en la esquina inferior derecha.</p>
    </div>
    
    <iframe 
        src="http://localhost:3001" 
        class="chatbot-iframe"
        title="Chatbot Isa"
        allow="microphone"
    ></iframe>
</body>
</html>
```

## 🎨 Personalización

El agente se llama "Isa" y está configurado en el archivo `src/components/Chatbot.tsx`. Puedes personalizar:

- Nombre del agente
- Mensajes de bienvenida
- Respuestas automáticas
- Colores y estilos en los archivos CSS

## 📁 Estructura del Proyecto

```
widget-chatbot/
├── src/
│   ├── components/
│   │   ├── Chatbot.tsx      # Componente principal
│   │   ├── ChatIcon.tsx     # Icono del agente Isa
│   │   ├── MessageList.tsx  # Lista de mensajes
│   │   └── MessageInput.tsx # Input de mensajes
│   ├── types.ts             # Tipos TypeScript
│   ├── App.tsx              # Componente raíz
│   ├── main.tsx             # Punto de entrada
│   └── index.css            # Estilos globales
├── public/
│   └── isa-icon.svg         # Icono SVG
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 🔧 Tecnologías

- **React 18.3.1** - Framework UI
- **TypeScript 5.5.3** - Tipado estático
- **Vite 5.3.1** - Build tool y dev server
- **CSS3** - Estilos modernos con animaciones

## 🔗 Integración en CRM

Para integrar el widget en un sistema CRM, consulta la guía completa:

- **[Guía de Integración CRM](./INTEGRACION-CRM.md)** - Documentación detallada
- **[Ejemplos de Integración](./ejemplos-crm.html)** - Ejemplos prácticos por plataforma

### Integración Rápida

```html
<!-- Agrega esto en tu CRM -->
<iframe 
    src="https://tudominio.com/widget-chatbot/index.html"
    style="position: fixed; bottom: 0; right: 0; width: 400px; height: 650px; border: none; z-index: 9999;"
    title="Chatbot Isa"
></iframe>
```

O usa el script loader:

```html
<script src="https://tudominio.com/widget-chatbot/isa-widget-loader.js"></script>
```

## 📄 Licencia

Este proyecto es parte del sistema CRM ChatBot.

