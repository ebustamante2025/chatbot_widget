# Script para reconstruir y levantar el widget (ejecutar en PowerShell).
# Uso: .\actualizar-widget.ps1

$ErrorActionPreference = "Stop"
Write-Host "Reconstruyendo widget sin cache..." -ForegroundColor Cyan
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Levantando contenedor..." -ForegroundColor Cyan
docker-compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Listo. Widget en http://localhost:8080" -ForegroundColor Green
Write-Host "Si Socket.IO sigue con 400, prueba: http://localhost:8080?apiBaseUrl=http://localhost:3001" -ForegroundColor Yellow
