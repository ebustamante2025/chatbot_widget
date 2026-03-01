# 🐳 Guía Rápida de Docker para Widget Chatbot Isa

## Inicio Rápido

### 1. Construir y ejecutar:

```bash
docker-compose up -d --build
```

### 2. Acceder al widget:

Abre tu navegador en: `http://localhost:8080`

### 3. Ver logs:

```bash
docker-compose logs -f
```

### 4. Detener:

```bash
docker-compose down
```

## Comandos Útiles

```bash
# Reconstruir sin caché
docker-compose build --no-cache

# Reiniciar el contenedor
docker-compose restart

# Ver estado
docker-compose ps

# Ejecutar comandos dentro del contenedor
docker-compose exec widget-chatbot sh
```

## Integración en ERP

Una vez que el contenedor esté corriendo, integra el widget en tu ERP usando:

```html
<iframe 
    src="http://tu-servidor:8080"
    style="position: fixed; bottom: 0; right: 0; width: 400px; height: 650px; border: none; z-index: 9999;"
    title="Chatbot Isa"
></iframe>
```

Para más detalles, consulta `INTEGRACION-ERP.md`

## Si Socket.IO da 400 (polling/WebSocket)

Si en la consola del navegador ves `GET .../socket.io/?EIO=4&transport=polling 400 (Bad Request)`:

1. **Reconstruir el widget** (nginx y backend se actualizaron):
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. **Alternativa: conectar el widget directo al backend** (sin pasar por el proxy del widget). Abre:
   ```
   http://localhost:8080?apiBaseUrl=http://localhost:3001
   ```
   Así el navegador habla con el backend (puerto 3001) para API y WebSocket. El backend debe estar accesible en `localhost:3001` (p. ej. con el `docker-compose` raíz que expone 3001).
