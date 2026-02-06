#!/bin/bash

# Script de despliegue para Widget Chatbot Isa
# Uso: ./deploy.sh [produccion|desarrollo]

ENVIRONMENT=${1:-desarrollo}
IMAGE_NAME="widget-chatbot-isa"
CONTAINER_NAME="widget-chatbot-isa"

echo "🚀 Desplegando Widget Chatbot Isa en modo: $ENVIRONMENT"

# Construir la imagen
echo "📦 Construyendo imagen Docker..."
docker build -t $IMAGE_NAME:latest .

if [ $? -ne 0 ]; then
    echo "❌ Error al construir la imagen"
    exit 1
fi

# Detener y eliminar contenedor existente si existe
echo "🛑 Deteniendo contenedor existente..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Ejecutar el contenedor
if [ "$ENVIRONMENT" = "produccion" ]; then
    echo "🏭 Iniciando contenedor en modo producción..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p 8080:80 \
        --restart unless-stopped \
        $IMAGE_NAME:latest
else
    echo "🔧 Iniciando contenedor en modo desarrollo..."
    docker run -d \
        --name $CONTAINER_NAME \
        -p 8080:80 \
        $IMAGE_NAME:latest
fi

if [ $? -eq 0 ]; then
    echo "✅ Widget desplegado correctamente!"
    echo "🌐 Accede al widget en: http://localhost:8080"
    echo ""
    echo "📊 Ver logs: docker logs -f $CONTAINER_NAME"
    echo "🛑 Detener: docker stop $CONTAINER_NAME"
else
    echo "❌ Error al iniciar el contenedor"
    exit 1
fi
