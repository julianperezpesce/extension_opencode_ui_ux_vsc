#!/bin/bash

# Script para ejecutar las pruebas del proyecto OpenCode DragonFu
# Usage: ./run-tests.sh [opciones]
#   --all          Ejecutar todas las pruebas
#   --slash        Ejecutar solo pruebas de slash commands
#   --watch        Ejecutar en modo watch
#   --coverage     Generar reporte de cobertura

set -e

echo "🧪 OpenCode DragonFu Test Runner"
echo "================================"

# Compilar primero
echo "📦 Compilando TypeScript..."
npm run compile

# Verificar si hay backend corriendo
echo "🔍 Verificando backend..."
if curl -s http://127.0.0.1:60189/session > /dev/null 2>&1; then
    echo "✅ Backend encontrado en puerto 60189"
else
    echo "⚠️  No se detectó backend en puerto 60189"
    echo "   Las pruebas de integración pueden fallar"
fi

echo ""
echo "🏃 Ejecutando pruebas..."

# Parsear argumentos
if [ "$1" == "--slash" ] || [ "$1" == "-s" ]; then
    echo "📝 Ejecutando pruebas de Slash Commands..."
    npx vscode-test --grep "Slash Commands"
elif [ "$1" == "--watch" ] || [ "$1" == "-w" ]; then
    echo "👁️  Modo watch activado..."
    npm run watch &
    npx vscode-test --watch
elif [ "$1" == "--coverage" ] || [ "$1" == "-c" ]; then
    echo "📊 Generando reporte de cobertura..."
    npx vscode-test --coverage
else
    echo "🎯 Ejecutando todas las pruebas..."
    npm test
fi

echo ""
echo "✅ Pruebas completadas!"
