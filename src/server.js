/**
 * Search-in-Pi — Backend Node.js
 *
 * Calcula π con el algoritmo Chudnovsky + binary splitting (BigInt).
 * Fórmula: π = 426880·√10005·Q / T
 *
 * Sistema de caché: si existe /data/pi_cache.txt al arrancar,
 * carga los decimales desde disco (instantáneo) en vez de calcular.
 * Las expansiones también se persisten en el caché.
 */

'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3141;

// Ruta del caché — debe estar en un volumen persistente
const CACHE_PATH = process.env.PI_CACHE_PATH || '/data/pi_cache.txt';

// Límite inicial configurable
let currentMax = parseInt(process.env.MAX_DIGITS || '1000000', 10);
const EXPAND_STEP = 500_000;

// Límite dinámico basado en RAM
const os = require('os');
const RAM_TOTAL_GB  = os.totalmem() / (1024 ** 3);
const HARD_LIMIT    = Math.floor(RAM_TOTAL_GB * 1_000_000 / 20) * 1_000;
// Límite de string en V8: ~536M caracteres. Usamos 500M como tope seguro.
const V8_STRING_LIMIT = 500_000_000;
const HARD_LIMIT_SAFE = Math.max(1_000_000, Math.min(V8_STRING_LIMIT, HARD_LIMIT));

// ═══════════════════════════════════════════════════════════
//  ALGORITMO CHUDNOVSKY + BINARY SPLITTING (BigInt)
// ═══════════════════════════════════════════════════════════

function bs(a, b) {
  if (b - a === 1n) {
    let Pab, Qab, Tab;
    if (a === 0n) { Pab = 1n; Qab = 1n; }
    else {
      Pab = (6n*a - 5n) * (2n*a - 1n) * (6n*a - 1n);
      Qab = 10939058860032000n * a * a * a;
    }
    Tab = Pab * (13591409n + 545140134n * a);
    if (a % 2n === 1n) Tab = -Tab;
    return [Pab, Qab, Tab];
  }
  const m = (a + b) / 2n;
  const [Pam, Qam, Tam] = bs(a, m);
  const [Pmb, Qmb, Tmb] = bs(m, b);
  return [Pam * Pmb, Qam * Qmb, Tam * Qmb + Pam * Tmb];
}

function isqrt(n) {
  if (n === 0n) return 0n;
  const bits = n.toString(2).length;
  let x = 1n << BigInt(Math.ceil(bits / 2)), xp;
  do { xp = x; x = (x + n / x) / 2n; } while (x < xp);
  return xp;
}

function computePi(digits) {
  const terms = BigInt(Math.ceil((digits + 5) / 14) + 5);
  const PREC  = BigInt(digits) + 20n;
  const ONE   = 10n ** PREC;
  const [, Q, T] = bs(0n, terms);
  const sqrtScaled = isqrt(10005n * ONE * ONE);
  const piScaled   = 426880n * sqrtScaled * Q / T;
  let s = piScaled.toString();
  if (s.length < digits + 1) s = s.padStart(digits + 1, '0');
  return s.slice(0, digits + 1); // "3" + digits decimales
}

// ═══════════════════════════════════════════════════════════
//  CACHÉ EN DISCO
// ═══════════════════════════════════════════════════════════

function saveCache(piStr) {
  try {
    const dir = path.dirname(CACHE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_PATH, piStr, 'utf8');
    const digits = piStr.length - 1;
    console.log(`[π] Caché guardado: ${digits.toLocaleString('es')} decimales → ${CACHE_PATH}`);
  } catch (e) {
    console.warn(`[π] No se pudo guardar el caché: ${e.message}`);
  }
}

function loadCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    console.log(`[π] Leyendo caché desde ${CACHE_PATH}…`);
    let data = fs.readFileSync(CACHE_PATH, 'utf8');
    // Limpiar: quitar punto decimal, espacios, saltos de línea
    // Soporta formato "3.14159..." (pi-billion.txt) y "314159..." (sin punto)
    data = data.replace(/\s/g, '');          // quitar whitespace
    if (data.startsWith('3.')) {
      data = '3' + data.slice(2);            // "3.14159..." → "314159..."
    }
    if (!data.startsWith('3') || data.length < 2) {
      console.warn('[π] Caché inválido: no empieza por 3');
      return null;
    }
    // Verificar que son solo dígitos
    if (!/^\d+$/.test(data)) {
      console.warn('[π] Caché contiene caracteres no numéricos, limpiando…');
      data = data.replace(/\D/g, '');
      if (!data.startsWith('3')) data = '3' + data;
    }
    let digits = data.length - 1;
    // Truncar si excede el límite de string de V8 (~500M)
    if (data.length > V8_STRING_LIMIT) {
      console.log(`[π] Caché tiene ${digits.toLocaleString('es')} decimales, truncando a ${V8_STRING_LIMIT.toLocaleString('es')} (límite V8)…`);
      data = data.slice(0, V8_STRING_LIMIT);
      digits = data.length - 1;
    }
    console.log(`[π] Caché encontrado: ${digits.toLocaleString('es')} decimales`);
    return data;
  } catch (e) {
    console.warn(`[π] No se pudo leer el caché: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════

let PI_STR    = '';
let ready     = false;
let expanding = false;
let loadedFromCache = false;

// ── Arranque: caché → cálculo ──────────────────────────────
console.log(`[π] Search-in-Pi v1.3.0`);
console.log(`[π] RAM total: ${RAM_TOTAL_GB.toFixed(1)} GB → límite dinámico: ${HARD_LIMIT_SAFE.toLocaleString('es')} decimales`);
console.log(`[π] Caché: ${CACHE_PATH}`);

setImmediate(() => {
  const cached = loadCache();
  if (cached) {
    // Usar caché si tiene al menos los decimales pedidos
    PI_STR = cached;
    const cachedDigits = cached.length - 1;
    if (cachedDigits >= currentMax) {
      // El caché tiene suficientes → listo al instante
      currentMax = cachedDigits; // usar todos los que hay
      ready = true;
      loadedFromCache = true;
      const KNOWN = '31415926535897932384626433832795028841971693993751';
      const ok = PI_STR.startsWith(KNOWN.slice(0, Math.min(KNOWN.length, 51)));
      console.log(`[π] ✓ Cargado desde caché: ${currentMax.toLocaleString('es')} decimales — verificación: ${ok ? 'OK' : 'ERROR'}`);
      console.log(`[π] π = ${PI_STR[0]}.${PI_STR.slice(1, 21)}…`);
    } else {
      // El caché tiene menos de lo pedido → calcular hasta currentMax y guardar
      console.log(`[π] Caché tiene ${cachedDigits.toLocaleString('es')} decimales, calculando hasta ${currentMax.toLocaleString('es')}…`);
      const t0 = Date.now();
      try {
        PI_STR = computePi(currentMax);
        ready = true;
        const secs = ((Date.now() - t0) / 1000).toFixed(2);
        const KNOWN = '31415926535897932384626433832795028841971693993751';
        const ok = PI_STR.startsWith(KNOWN.slice(0, Math.min(KNOWN.length, 51)));
        console.log(`[π] ✓ ${currentMax.toLocaleString('es')} decimales en ${secs}s — verificación: ${ok ? 'OK' : 'ERROR'}`);
        saveCache(PI_STR);
      } catch (e) {
        console.error('[π] ERROR en cálculo inicial:', e);
      }
    }
  } else {
    // Sin caché → calcular desde cero
    console.log(`[π] Sin caché. Calculando ${currentMax.toLocaleString('es')} decimales con Chudnovsky…`);
    const t0 = Date.now();
    try {
      PI_STR = computePi(currentMax);
      ready  = true;
      const secs = ((Date.now() - t0) / 1000).toFixed(2);
      const KNOWN = '31415926535897932384626433832795028841971693993751';
      const ok = PI_STR.startsWith(KNOWN.slice(0, Math.min(KNOWN.length, 51)));
      console.log(`[π] ✓ ${currentMax.toLocaleString('es')} decimales en ${secs}s — verificación: ${ok ? 'OK' : 'ERROR'}`);
      console.log(`[π] π = ${PI_STR[0]}.${PI_STR.slice(1, 21)}…`);
      saveCache(PI_STR);
    } catch (e) {
      console.error('[π] ERROR en cálculo inicial:', e);
    }
  }
});

// ── Expansión dinámica ─────────────────────────────────────
function expandPi(newTarget) {
  return new Promise((resolve, reject) => {
    expanding = true;
    const t = Date.now();
    console.log(`[π] Expandiendo de ${currentMax.toLocaleString('es')} → ${newTarget.toLocaleString('es')} decimales…`);
    setImmediate(() => {
      try {
        const newStr = computePi(newTarget);
        PI_STR     = newStr;
        currentMax = newTarget;
        expanding  = false;
        const secs = ((Date.now() - t) / 1000).toFixed(2);
        console.log(`[π] ✓ Expandido a ${currentMax.toLocaleString('es')} decimales en ${secs}s`);
        // Guardar caché actualizado en background (no bloqueante)
        setImmediate(() => saveCache(PI_STR));
        resolve({ currentMax, secs });
      } catch(e) {
        expanding = false;
        console.error('[π] ERROR en expansión:', e);
        reject(e);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  next();
});

// ═══════════════════════════════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════════════════════════════

app.get('/api/status', (req, res) => {
  res.json({
    ready,
    expanding,
    totalDigits:      ready ? PI_STR.length - 1 : 0,
    currentMax,
    expandStep:       EXPAND_STEP,
    hardLimit:        HARD_LIMIT_SAFE,
    ramGB:            parseFloat(RAM_TOTAL_GB.toFixed(1)),
    loadedFromCache,
    cachePath:        CACHE_PATH,
    version:          '1.3.0',
  });
});

app.get('/api/pi', (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Calculando π…', ready: false });
  const start = Math.max(0, parseInt(req.query.start || '0', 10));
  const count = Math.min(1_000_000, Math.max(1, parseInt(req.query.count || '1000000', 10)));
  if (start >= currentMax)
    return res.status(400).json({ error: `start (${start}) >= currentMax (${currentMax})` });
  const decimals = PI_STR.slice(1);
  const chunk    = decimals.slice(start, start + count);
  res.json({ start, count: chunk.length, available: currentMax, decimals: chunk });
});

app.get('/api/search', (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Calculando π…', ready: false });
  const q = (req.query.q || '').replace(/\D/g, '');
  if (!q)            return res.status(400).json({ error: 'Parámetro q requerido' });
  if (q.length > 20) return res.status(400).json({ error: 'q: máx 20 dígitos' });
  const rStart = Math.max(0, parseInt(req.query.start || '0', 10));
  const rCount = Math.min(currentMax, Math.max(1, parseInt(req.query.count || String(currentMax), 10)));
  const rEnd   = Math.min(currentMax, rStart + rCount);
  const decimals  = PI_STR.slice(1);
  const positions = [];
  let idx = rStart;
  while (idx < rEnd) {
    idx = decimals.indexOf(q, idx);
    if (idx === -1 || idx >= rEnd) break;
    positions.push(idx + 1);
    idx++;
    if (positions.length >= 10_000) break;
  }
  res.json({
    query: q, start: rStart, end: rEnd,
    totalFound: positions.length, positions,
    truncated: positions.length >= 10_000,
  });
});

app.post('/api/expand', (req, res) => {
  if (!ready)    return res.status(503).json({ error: 'Aún calculando el bloque inicial…' });
  if (expanding) return res.status(409).json({ error: 'Ya hay una expansión en curso', currentMax });
  const newTarget = currentMax + EXPAND_STEP;
  if (newTarget > HARD_LIMIT_SAFE)
    return res.status(400).json({ error: `Límite según RAM: ${HARD_LIMIT_SAFE.toLocaleString('es')} decimales`, hardLimit: HARD_LIMIT_SAFE });
  res.json({ accepted: true, from: currentMax, newTarget, expandStep: EXPAND_STEP });
  expandPi(newTarget).catch(e => console.error('[π] Expansión fallida:', e));
});

// Endpoint para cargar un caché externo via POST (útil para subir decimales precalculados)
app.post('/api/cache/load', express.text({ limit: '50mb' }), (req, res) => {
  if (expanding) return res.status(409).json({ error: 'Expansión en curso' });
  let data = req.body.replace(/\s/g, '');
  if (data.startsWith('3.')) data = '3' + data.slice(2);
  data = data.replace(/[^\d]/g, '');
  if (!data.startsWith('3')) data = '3' + data;
  if (data.length < 2)
    return res.status(400).json({ error: 'Datos inválidos: deben empezar por 3' });
  const digits = data.length - 1;
  if (digits > HARD_LIMIT_SAFE)
    return res.status(400).json({ error: `Demasiados decimales: límite ${HARD_LIMIT_SAFE.toLocaleString('es')}` });
  PI_STR     = data;
  currentMax = digits;
  ready      = true;
  loadedFromCache = true;
  saveCache(PI_STR);
  res.json({ ok: true, digits, message: `Cargados ${digits.toLocaleString('es')} decimales` });
});

// ═══════════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[π] Servidor en http://0.0.0.0:${PORT}`);
});
