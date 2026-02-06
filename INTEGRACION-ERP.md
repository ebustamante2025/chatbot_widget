# Integración del Widget Chatbot Isa en ERP Web

Esta guía explica cómo integrar el widget del chatbot Isa en un ERP web usando Docker.

## 🐳 Despliegue con Docker

### Opción 1: Docker Compose (Recomendado)

1. **Construir y ejecutar el contenedor:**

```bash
cd apps/widget-chatbot
docker-compose up -d --build
```

El widget estará disponible en `http://localhost:8080`

2. **Ver logs:**

```bash
docker-compose logs -f widget-chatbot
```

3. **Detener el contenedor:**

```bash
docker-compose down
```

### Opción 2: Docker Manual

1. **Construir la imagen:**

```bash
docker build -t widget-chatbot-isa .
```

2. **Ejecutar el contenedor:**

```bash
docker run -d \
  --name widget-chatbot \
  -p 8080:80 \
  --restart unless-stopped \
  widget-chatbot-isa
```

## 🌐 Integración en ERP Web

### Paso 1: Configurar el Widget en Producción

Una vez que el contenedor esté corriendo, el widget estará disponible en:
- `http://tu-servidor:8080` (si usas el puerto por defecto)
- `https://widget.tu-dominio.com` (si configuraste un dominio)

### Paso 2: Integrar en el ERP

#### Método 1: Iframe Directo (Más Simple)

Agrega este código en las páginas de tu ERP donde quieras mostrar el chatbot:

```html
<!-- Widget Chatbot Isa -->
<iframe 
    id="isa-chatbot-widget"
    src="http://tu-servidor:8080"
    style="
        position: fixed;
        bottom: 0;
        right: 0;
        width: 400px;
        height: 650px;
        border: none;
        z-index: 9999;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
        border-radius: 20px 20px 0 0;
    "
    title="Chatbot Isa"
    allow="microphone"
    frameborder="0"
></iframe>

<style>
    @media (max-width: 768px) {
        #isa-chatbot-widget {
            width: 100%;
            height: 100vh;
            border-radius: 0;
        }
    }
</style>
```

#### Método 2: Script Loader (Recomendado para ERP)

1. **Copia el script loader** desde `public/isa-widget-loader.js` a tu ERP o sirve desde el contenedor.

2. **Agrega el script en tu ERP:**

```html
<!-- Antes del cierre de </body> -->
<script>
    // Configuración del widget
    window.IsaWidgetConfig = {
        widgetUrl: 'http://tu-servidor:8080',
        position: 'bottom-right', // 'bottom-right' | 'bottom-left'
        zIndex: 9999,
        width: 400,
        height: 650
    };
</script>
<script src="http://tu-servidor:8080/isa-widget-loader.js"></script>
```

### Paso 3: Configuración para Producción

#### Usar Nginx como Reverse Proxy

Si quieres usar un dominio personalizado y HTTPS, configura Nginx como reverse proxy:

```nginx
server {
    listen 80;
    server_name widget.tu-dominio.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Configurar HTTPS con Let's Encrypt

```bash
# Instalar certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d widget.tu-dominio.com
```

## 🔧 Integración Específica por ERP

### Odoo

1. **Crear un módulo personalizado:**

```python
# models/widget_chatbot.py
from odoo import models, fields, api

class WidgetChatbot(models.Model):
    _name = 'widget.chatbot'
    _description = 'Widget Chatbot Isa'

    def get_widget_url(self):
        return 'http://tu-servidor:8080'
```

2. **Agregar en template XML:**

```xml
<!-- views/templates.xml -->
<template id="widget_chatbot" inherit_id="web.layout">
    <xpath expr="//body" position="inside">
        <iframe 
            t-attf-src="#{widget_chatbot.get_widget_url()}"
            style="position: fixed; bottom: 0; right: 0; width: 400px; height: 650px; border: none; z-index: 9999;"
            title="Chatbot Isa"
        />
    </xpath>
</template>
```

### SAP Business One / SAP ERP

1. **Crear una página HTML personalizada** en el servidor web de SAP
2. **Agregar el iframe** en la página
3. **Integrar en el menú** de SAP

### Microsoft Dynamics 365

1. **Crear un Web Resource:**
   - Ve a **Configuración** > **Personalización** > **Recursos Web**
   - Crea un nuevo recurso HTML
   - Agrega el código del iframe

2. **Agregar a un formulario:**
   - Edita el formulario donde quieras el chatbot
   - Agrega un control de iFrame
   - Configura la URL: `http://tu-servidor:8080`

### ERPNext

1. **Crear un Custom Script:**

```javascript
// En Custom Script de ERPNext
frappe.ui.form.on('Formulario', {
    refresh: function(frm) {
        // Agregar widget chatbot
        if (!document.getElementById('isa-chatbot-widget')) {
            const iframe = document.createElement('iframe');
            iframe.id = 'isa-chatbot-widget';
            iframe.src = 'http://tu-servidor:8080';
            iframe.style.cssText = 'position: fixed; bottom: 0; right: 0; width: 400px; height: 650px; border: none; z-index: 9999;';
            document.body.appendChild(iframe);
        }
    }
});
```

## 🔒 Seguridad y Configuración

### Variables de Entorno

Puedes configurar variables de entorno en `docker-compose.yml`:

```yaml
services:
  widget-chatbot:
    environment:
      - NODE_ENV=production
      - WIDGET_URL=https://widget.tu-dominio.com
```

### Content Security Policy (CSP)

Si tu ERP usa CSP, asegúrate de permitir el iframe:

```
frame-src http://tu-servidor:8080 https://widget.tu-dominio.com;
```

### CORS Configuration

Si necesitas comunicación entre el ERP y el widget, configura CORS en `nginx.conf`:

```nginx
add_header Access-Control-Allow-Origin "https://tu-erp.com" always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
```

## 📊 Monitoreo y Logs

### Ver logs del contenedor:

```bash
docker-compose logs -f widget-chatbot
```

### Health Check:

El contenedor incluye un health check que verifica que el servicio esté funcionando:

```bash
docker ps
# Verás el estado "healthy" si todo está bien
```

## 🚀 Despliegue en Producción

### 1. Construir la imagen:

```bash
docker build -t widget-chatbot-isa:latest .
```

### 2. Tag para registro:

```bash
docker tag widget-chatbot-isa:latest tu-registro/widget-chatbot-isa:latest
```

### 3. Push al registro:

```bash
docker push tu-registro/widget-chatbot-isa:latest
```

### 4. Desplegar en servidor:

```bash
docker pull tu-registro/widget-chatbot-isa:latest
docker-compose up -d
```

## 🔄 Actualización

Para actualizar el widget:

```bash
# Detener el contenedor actual
docker-compose down

# Reconstruir con los últimos cambios
docker-compose up -d --build
```

## 📝 Notas Importantes

1. **Puerto**: Por defecto el contenedor expone el puerto 80 internamente y lo mapea al 8080 del host. Puedes cambiarlo en `docker-compose.yml`.

2. **Dominio**: Para producción, configura un dominio y HTTPS.

3. **Recursos**: El contenedor es ligero (nginx alpine) y consume pocos recursos.

4. **Escalabilidad**: Puedes escalar horizontalmente ejecutando múltiples instancias detrás de un load balancer.

## 🆘 Troubleshooting

### El widget no carga:

1. Verifica que el contenedor esté corriendo: `docker ps`
2. Verifica los logs: `docker-compose logs widget-chatbot`
3. Verifica que el puerto esté accesible: `curl http://localhost:8080`

### Problemas de CORS:

Ajusta los headers en `nginx.conf` para permitir el origen de tu ERP.

### El iframe está bloqueado:

Verifica la configuración de CSP en tu ERP y permite el dominio del widget.
