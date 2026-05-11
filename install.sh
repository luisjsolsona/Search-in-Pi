#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Search-in-Pi — Script de instalación
#  Uso: bash install.sh
# ═══════════════════════════════════════════════════════════

set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR="/DATA/AppData/search-in-pi/data"
CACHE_FILE="$CACHE_DIR/pi_cache.txt"
PI_SOURCE="https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt"
PI_TMP="/tmp/pi-billion.txt"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Search-in-Pi — Instalador        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Crear directorio del caché ─────────────────────────
echo "→ Creando directorio de caché: $CACHE_DIR"
sudo mkdir -p "$CACHE_DIR"
sudo chown -R "$(whoami):$(id -gn)" "$CACHE_DIR"

# ── 2. Descargar decimales de π si no existen ─────────────
if [ -f "$CACHE_FILE" ] && [ "$(wc -c < "$CACHE_FILE")" -gt 1000 ]; then
  DIGITS=$(( $(wc -c < "$CACHE_FILE") - 1 ))
  echo "→ Caché ya existe con $DIGITS decimales. Saltando descarga."
else
  if [ -f "$PI_TMP" ] && [ "$(wc -c < "$PI_TMP")" -gt 1000000 ]; then
    echo "→ Usando fichero ya descargado: $PI_TMP"
  else
    echo "→ Descargando $PI_SOURCE"
    echo "  (esto puede tardar varios minutos según tu conexión...)"
    wget -O "$PI_TMP" "$PI_SOURCE"
  fi

  echo "→ Procesando decimales (quitando punto decimal)..."
  tr -d '.\n\r ' < "$PI_TMP" > "$CACHE_FILE"

  DIGITS=$(( $(wc -c < "$CACHE_FILE") - 1 ))
  echo "→ Caché generado: $DIGITS decimales → $CACHE_FILE"

  FIRST=$(head -c 15 "$CACHE_FILE")
  if [[ "$FIRST" == 314159265358979* ]]; then
    echo "→ Verificación OK: $FIRST..."
  else
    echo "⚠️  Verificación fallida. Primeros caracteres: $FIRST"
    exit 1
  fi
fi

# ── 3. Arrancar con docker compose ────────────────────────
echo ""
echo "→ Arrancando Search-in-Pi con Docker Compose..."
cd "$REPO_DIR"
docker compose up -d --build

echo ""
echo "→ Esperando a que el servidor esté listo..."
sleep 3

for i in $(seq 1 30); do
  STATUS=$(curl -s http://localhost:3141/api/status 2>/dev/null || echo "{}")
  READY=$(echo "$STATUS" | grep -o '"ready":true' || true)
  CACHED=$(echo "$STATUS" | grep -o '"loadedFromCache":true' || true)
  DIGITS=$(echo "$STATUS" | grep -o '"totalDigits":[0-9]*' | grep -o '[0-9]*' || echo "0")

  if [ -n "$READY" ]; then
    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║            ✓ Listo!                      ║"
    echo "╠══════════════════════════════════════════╣"
    printf  "║  Decimales cargados: %-20s║\n" "$DIGITS"
    if [ -n "$CACHED" ]; then
    echo "║  Fuente: caché en disco (instantáneo)    ║"
    else
    echo "║  Fuente: cálculo Chudnovsky              ║"
    fi
    echo "║  URL: http://$(hostname -I | awk '{print $1}'):3141         ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""
    exit 0
  fi

  echo "  Esperando... ($i/30)"
  sleep 5
done

echo ""
echo "⚠️  El servidor tardó más de lo esperado. Comprueba los logs:"
echo "   docker logs -f search-in-pi"
