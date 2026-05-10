# 🔍 Search in π

<p align="center">
  <img src="public/icon.svg" width="120" alt="Search in Pi logo">
</p>

<p align="center">
  <strong>Buscador de secuencias numéricas en los decimales de π</strong><br>
  Calcula hasta 1.000.000 de decimales con el algoritmo <strong>Chudnovsky</strong> y los sirve por bloques bajo demanda.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Docker-compatible-2496ED?logo=docker&logoColor=white">
  <img src="https://img.shields.io/badge/CasaOS-compatible-6C5CE7?logo=homeassistant&logoColor=white">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## ✨ Características

- **Algoritmo Chudnovsky** con *binary splitting* — el más eficiente implementado en JS puro
- **API REST** para servir los dígitos por bloques (`/api/pi`, `/api/search`)
- **Búsqueda server-side**: busca en todos los decimales disponibles en el servidor de una sola vez
- **Carga lazy**: el frontend carga solo los decimales necesarios para mostrar
- **Modo standalone**: si se abre sin servidor, calcula localmente con Web Worker + Machin BigInt
- **Responsive**: funciona en móvil, tablet y escritorio
- **CasaOS ready**: etiquetas y `docker-compose.yml` listo para importar

---

## 🚀 Despliegue rápido

### Docker (una línea)

```bash
docker run -d \
  --name search-in-pi \
  --restart unless-stopped \
  -p 3141:3141 \
  -e MAX_DIGITS=100000 \
  ghcr.io/luisjsolsona/search-in-pi:latest
```

Abre `http://TU_IP:3141` en el navegador.

### Docker Compose

```bash
git clone https://github.com/luisjsolsona/Search-in-Pi.git
cd Search-in-Pi
docker compose up -d
```

---

## 🏠 CasaOS

### Opción A — Importar docker-compose (recomendado)

1. En CasaOS, ve a **App Store → Custom Install → Import**
2. Pega el contenido de [`docker-compose.yml`](docker-compose.yml) o la URL del repositorio
3. Ajusta `MAX_DIGITS` según tu RAM y pulsa **Install**

### Opción B — Desde la tienda de apps (cuando esté publicado)

Busca **"Search in Pi"** en el App Store de CasaOS.

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3141` | Puerto del servidor HTTP |
| `MAX_DIGITS` | `1000000` | Decimales de π a calcular al arrancar |
| `NODE_ENV` | `production` | Modo de Node.js |

### Recursos recomendados según `MAX_DIGITS`

| MAX_DIGITS | RAM mínima | Tiempo de cálculo |
|---|---|---|
| 100.000 | 256 MB | ~5 segundos |
| 500.000 | 1 GB | ~60 segundos |
| 1.000.000 | 2 GB | ~4 minutos |

---

## 🔌 API REST

### `GET /api/status`

Estado del servidor.

```json
{
  "ready": true,
  "totalDigits": 100000,
  "maxDigits": 100000,
  "version": "1.0.0"
}
```

### `GET /api/pi?start=0&count=10000`

Devuelve un bloque de decimales.

| Parámetro | Descripción | Máximo |
|---|---|---|
| `start` | Índice 0-based del primer decimal | — |
| `count` | Cuántos decimales devolver | 100.000 |

```json
{
  "start": 0,
  "count": 10000,
  "available": 100000,
  "decimals": "14159265358979..."
}
```

### `GET /api/search?q=314159`

Búsqueda de una secuencia en todos los decimales disponibles.

| Parámetro | Descripción |
|---|---|
| `q` | Secuencia de dígitos a buscar (máx. 20) |
| `start` | Desde qué decimal buscar (opcional, 0) |
| `count` | Cuántos decimales buscar (opcional, todos) |

```json
{
  "query": "314159",
  "start": 0,
  "end": 100000,
  "totalFound": 3,
  "positions": [1, 51234, 87456],
  "truncated": false
}
```

> Las posiciones son **1-based**: `1` significa el primer decimal de π (el `1` de `3.14159…`).

---

## 🏗️ Desarrollo local

```bash
git clone https://github.com/luisjsolsona/Search-in-Pi.git
cd Search-in-Pi
npm install
MAX_DIGITS=10000 npm start
```

Abre `http://localhost:3141`.

### Construir imagen Docker localmente

```bash
docker build -t search-in-pi .
docker run -p 3141:3141 -e MAX_DIGITS=50000 search-in-pi
```

---

## 🧮 Algoritmo Chudnovsky

El servidor usa la **serie de Chudnovsky** con *binary splitting*, el algoritmo más eficiente para calcular π en software:

```
1/π = (12/C³) · Σ (6k)!(13591409 + 545140134k) / ((3k)!(k!)³ · (-262537412640768000)^k)
```

Cada término aporta ~**14,18 dígitos** decimales. La implementación usa `BigInt` nativo de Node.js para precisión arbitraria.

El modo standalone (sin servidor) usa la fórmula de **Machin**:
```
π/4 = 4·arctan(1/5) − arctan(1/239)
```

---

## 📁 Estructura del proyecto

```
Search-in-Pi/
├── src/
│   └── server.js          # Servidor Express + algoritmo Chudnovsky
├── public/
│   ├── index.html         # Frontend responsive (PWA-ready)
│   └── icon.svg           # Icono: lupa con π
├── .github/
│   └── workflows/
│       └── docker.yml     # CI/CD → GHCR
├── Dockerfile             # Multi-stage, imagen Alpine mínima
├── docker-compose.yml     # Compatible CasaOS
├── package.json
└── README.md
```

---

## 📜 Licencia

MIT © [luisjsolsona](https://github.com/luisjsolsona)

---

<p align="center">π = 3.14159265358979323846264338327950288…</p>
