/**
 * Search-in-Pi — Backend Node.js
 *
 * Calcula π con el algoritmo Chudnovsky + binary splitting (BigInt).
 * Fórmula: π = 426880·√10005·Q / T
 * Cada término aporta ~14.18 dígitos decimales.
 *
 * Soporta expansión dinámica vía POST /api/expand sin reiniciar.
 */

'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3141;

// Límite inicial configurable; puede crecer en caliente
let currentMax = parseInt(process.env.MAX_DIGITS || '1000000', 10);
const EXPAND_STEP = 500_000;   // decimales que añade cada llamada a /api/expand
const HARD_LIMIT  = 50_000_000; // límite absoluto de seguridad (RAM)

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
//  ESTADO GLOBAL — mutable en caliente
// ═══════════════════════════════════════════════════════════

let PI_STR   = '';    // "3" + decimales
let ready    = false;
let expanding = false; // mutex: evita dos expansiones simultáneas

// ── Cálculo inicial ────────────────────────────────────────
console.log(`[π] Search-in-Pi v1.1.0`);
console.log(`[π] Calculando ${currentMax.toLocaleString('es')} decimales con Chudnovsky…`);
const t0 = Date.now();

setImmediate(() => {
  try {
    PI_STR = computePi(currentMax);
    ready  = true;
    const secs = ((Date.now() - t0) / 1000).toFixed(2);
    const KNOWN = '31415926535897932384626433832795028841971693993751';
    const ok = PI_STR.startsWith(KNOWN.slice(0, Math.min(KNOWN.length, currentMax + 1)));
    console.log(`[π] ✓ ${currentMax.toLocaleString('es')} decimales en ${secs}s — verificación: ${ok ? 'OK' : 'ERROR'}`);
    console.log(`[π] π = ${PI_STR[0]}.${PI_STR.slice(1, 21)}…`);
  } catch (e) {
    console.error('[π] ERROR en cálculo inicial:', e);
  }
});

// ── Expansión dinámica ─────────────────────────────────────
/**
 * Recalcula π hasta newTarget decimales.
 * Chudnovsky recalcula desde 0 (no es incremental), pero en
 * la práctica a 2M tarda ~15 min, a 1.5M ~6 min, etc.
 * Se ejecuta en segundo plano; el estado `expanding` evita colisiones.
 */
function expandPi(newTarget) {
  return new Promise((resolve, reject) => {
    expanding = true;
    const t = Date.now();
    console.log(`[π] Expandiendo de ${currentMax.toLocaleString('es')} → ${newTarget.toLocaleString('es')} decimales…`);
    // setImmediate para liberar el event loop antes del cálculo pesado
    setImmediate(() => {
      try {
        const newStr = computePi(newTarget);
        PI_STR     = newStr;
        currentMax = newTarget;
        expanding  = false;
        const secs = ((Date.now() - t) / 1000).toFixed(2);
        console.log(`[π] ✓ Expandido a ${currentMax.toLocaleString('es')} decimales en ${secs}s`);
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

/** GET /api/status */
app.get('/api/status', (req, res) => {
  res.json({
    ready,
    expanding,
    totalDigits:  ready ? PI_STR.length - 1 : 0,
    currentMax,
    expandStep:   EXPAND_STEP,
    hardLimit:    HARD_LIMIT,
    version:      '1.1.0',
  });
});

/** GET /api/pi?start=0&count=1000000 */
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

/** GET /api/search?q=314159 */
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

/**
 * POST /api/expand
 * Amplía π en EXPAND_STEP decimales más.
 * Devuelve inmediatamente con { accepted, newTarget } y calcula en background.
 * El cliente puede hacer polling a /api/status para saber cuándo termina.
 */
app.post('/api/expand', (req, res) => {
  if (!ready)    return res.status(503).json({ error: 'Aún calculando el bloque inicial…' });
  if (expanding) return res.status(409).json({ error: 'Ya hay una expansión en curso', currentMax });

  const newTarget = currentMax + EXPAND_STEP;
  if (newTarget > HARD_LIMIT)
    return res.status(400).json({ error: `Límite absoluto: ${HARD_LIMIT.toLocaleString('es')} decimales`, hardLimit: HARD_LIMIT });

  // Responder inmediatamente — el cálculo corre en background
  res.json({ accepted: true, from: currentMax, newTarget, expandStep: EXPAND_STEP });

  // Lanzar expansión sin await (background)
  expandPi(newTarget).catch(e => console.error('[π] Expansión fallida:', e));
});

// ═══════════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[π] Servidor en http://0.0.0.0:${PORT}`);
});
