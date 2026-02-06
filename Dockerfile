# Dockerfile para Widget Chatbot Isa
# Multi-stage build para optimizar el tamaño de la imagen

# Etapa 1: Construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production=false

# Copiar código fuente
COPY . .

# En producción usa /api (proxy nginx), no localhost
ENV VITE_API_URL=/api

# Construir la aplicación
RUN npm run build

# Etapa 2: Producción con Nginx
FROM nginx:alpine

# Copiar archivos construidos desde la etapa de construcción
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

# Comando para iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
