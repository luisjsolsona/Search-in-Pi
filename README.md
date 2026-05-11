# 🔍 Search in π

<p align="center">
  <img src="public/icon.svg" width="120" alt="Search in Pi logo">
</p>

<p align="center">
  <strong>Buscador de secuencias numéricas en los decimales de π</strong><br>
  Calcula con el algoritmo <strong>Chudnovsky</strong> y soporta caché persistente en disco.<br>
  Arranca instantáneamente con hasta 1.000.000.000 decimales pregenerados.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white">
  <img src="https://img.shields.io/badge/License-MIT-green">
</p>

---

## 🚀 Instalación en un comando

```bash
git clone https://github.com/luisjsolsona/Search-in-Pi.git
cd Search-in-Pi
bash install.sh
```

El script hace todo automáticamente:

1. Descarga **1.000.000.000 decimales de π** desde el MIT (`pi-billion.txt`)
2. Genera el caché en `/DATA/AppData/search-in-pi/data/pi_cache.txt`
3. Construye y arranca el contenedor Docker
4. Verifica que el servidor esté listo

Si ya tienes el fichero descargado en `/tmp/pi-billion.txt`, el script lo detecta y se salta la descarga.

---

## ✨ Características

- **Caché persistente en disco**: carga 1.000.000.000 decimales al arrancar en <1 segundo
- **Algoritmo Chudnovsky** con *binary splitting* — el más eficiente implementado en JS puro
- **Expansión dinámica**: añade 500K decimales en caliente sin reiniciar el contenedor
- **Límite dinámico según RAM**: calcula automáticamente cuántos decimales puede manejar
- **Búsqueda server-side**: busca en todos los decimales disponibles de una sola vez
- **Modo standalone**: si se abre sin servidor, calcula localmente con Web Worker + Machin BigInt
- **Responsive**: funciona en móvil, tablet y escritorio

---

## 💾 Caché manual

Si prefieres gestionar el caché manualmente:

```bash
# Crear directorio
mkdir -p /DATA/AppData/search-in-pi/data

# Limpiar formato (quitar el punto decimal) y guardar
tr -d '.\n\r ' < /tmp/pi-billion.txt > /DATA/AppData/search-in-pi/data/pi_cache.txt

# Arrancar
docker compose up -d --build
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
│   └── server.js          # Servidor Express + Chudnovsky + caché
├── public/
│   ├── index.html         # Frontend responsive
│   └── icon.svg           # Icono: lupa con π
├── Dockerfile             # Multi-stage, imagen Alpine mínima
├── docker-compose.yml     # Con volumen persistente para caché
├── install.sh             # Script de instalación automática
├── package.json
└── README.md
```

---

## 📜 Licencia

MIT © [luisjsolsona](https://github.com/luisjsolsona)

---

<p align="center">π = 3.14159265358979323846264338327950288…</p>
