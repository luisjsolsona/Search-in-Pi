# 🔍 Search in π

<p align="center">
  <img src="public/icon.svg" width="120" alt="Search in Pi logo">
</p>

<p align="center">
  <strong>Buscador de secuencias numéricas en los decimales de π</strong><br>
  Calcula con el algoritmo <strong>Chudnovsky</strong> y soporta caché persistente en disco.<br>
  Arranca instantáneamente si hay decimales pregenerados disponibles.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## ✨ Características

- **Algoritmo Chudnovsky** con *binary splitting* — el más eficiente implementado en JS puro
- **Caché persistente en disco**: carga `pi_cache.txt` al arrancar en <1 segundo
- **Expansión dinámica**: añade 500K decimales en caliente sin reiniciar el contenedor
- **API REST** para servir los dígitos por bloques (`/api/pi`, `/api/search`)
- **Búsqueda server-side**: busca en todos los decimales disponibles de una sola vez
- **Modo standalone**: si se abre sin servidor, calcula localmente con Web Worker + Machin BigInt
- **Límite dinámico según RAM**: calcula automáticamente cuántos decimales puede manejar el sistema
- **Responsive**: funciona en móvil, tablet y escritorio

---

## 🚀 Despliegue rápido

```bash
git clone https://github.com/luisjsolsona/Search-in-Pi.git
cd Search-in-Pi
docker compose up -d
```

Abre `http://TU_IP:3141` en el navegador.

---

## 💾 Caché de decimales pregenerados

El sistema puede arrancar instantáneamente si dispones de un fichero de decimales de π en disco.

### Formato del fichero

Un fichero de texto plano que empiece por `3` seguido de todos los decimales **sin punto ni espacios**:

```
314159265358979323846264338327950288...
```

### Usando pi-billion.txt (MIT)

```bash
# Descargar ~1GB de decimales de π
wget -O /tmp/pi-billion.txt https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt

# Crear directorio del caché
mkdir -p /DATA/AppData/search-in-pi/data

# Limpiar formato (quitar el punto decimal) y guardar
tr -d '.\n\r ' < /tmp/pi-billion.txt > /DATA/AppData/search-in-pi/data/pi_cache.txt

# Verificar que empieza bien
head -c 30 /DATA/AppData/search-in-pi/data/pi_cache.txt
# → 314159265358979323846264338327...
```

### Cargar en caliente (sin reiniciar)

```bash
curl -X POST http://TU_IP:3141/api/cache/load \
  -H "Content-Type: text/plain" \
  --data-binary @/ruta/al/pi_cache.txt
```

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3141` | Puerto del servidor HTTP |
| `MAX_DIGITS` | `1000000` | Decimales a calcular si no hay caché |
| `PI_CACHE_PATH` | `/data/pi_cache.txt` | Ruta del fichero de caché |
| `NODE_ENV` | `production` | Modo de Node.js |

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
│   └── server.js          # Servidor Express + Chudnovsky + sistema de caché
├── public/
│   ├── index.html         # Frontend responsive
│   └── icon.svg           # Icono: lupa con π
├── Dockerfile             # Multi-stage, imagen Alpine mínima
├── docker-compose.yml     # Con volumen persistente para caché
├── package.json
└── README.md
```

---

## 📜 Licencia

MIT © [luisjsolsona](https://github.com/luisjsolsona)

---

<p align="center">π = 3.14159265358979323846264338327950288…</p>
