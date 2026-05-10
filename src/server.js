/**
 * Search-in-Pi — Backend Node.js
 *
 * Calcula π con el algoritmo Chudnovsky + binary splitting (BigInt).
 * Fórmula: π = 426880·√10005·Q / T   (binary splitting)
 * Cada término aporta ~14.18 dígitos decimales.
 * Validado: π = 3.14159265358979323846…
 */

'use strict';

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3141;
const MAX_DIGITS = parseInt(process.env.MAX_DIGITS || '100000', 10);

// ═══════════════════════════════════════════════════════════
//  ALGORITMO CHUDNOVSKY + BINARY SPLITTING (BigInt)
// ═══════════════════════════════════════════════════════════

function bs(a, b) {
  if (b - a === 1n) {
    let Pab, Qab, Tab;
    if (a === 0n) {
      Pab = 1n; Qab = 1n;
    } else {
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
  // Estimación inicial via longitud de bits (evita Infinity en Math.sqrt)
  const bits = n.toString(2).length;
  let x = 1n << BigInt(Math.ceil(bits / 2)), xp;
  do { xp = x; x = (x + n / x) / 2n; } while (x < xp);
  return xp;
}

/**
 * Calcula π a `digits` decimales.
 * Devuelve string (digits+1) chars: "3" + decimales.
 */
function computePi(digits) {
  const terms = BigInt(Math.ceil((digits + 5) / 14) + 5);
  const PREC  = BigInt(digits) + 20n;
  const ONE   = 10n ** PREC;

  const [, Q, T] = bs(0n, terms);

  // π = 426880 · √10005 · Q / T
  const sqrtScaled = isqrt(10005n * ONE * ONE);
  const piScaled   = 426880n * sqrtScaled * Q / T;

  let s = piScaled.toString();
  if (s.length < digits + 1) s = s.padStart(digits + 1, '0');
  return s.slice(0, digits + 1);  // "3" + digits decimales
}

// ═══════════════════════════════════════════════════════════
//  PRE-CÁLCULO AL ARRANCAR
// ═══════════════════════════════════════════════════════════

let PI_STR = '';
let ready  = false;

console.log(`[π] Search-in-Pi v1.0.0`);
console.log(`[π] Calculando ${MAX_DIGITS.toLocaleString('es')} decimales con Chudnovsky…`);
const t0 = Date.now();

setImmediate(() => {
  try {
    PI_STR = computePi(MAX_DIGITS);
    ready  = true;
    const secs = ((Date.now() - t0) / 1000).toFixed(2);
    const KNOWN = '31415926535897932384626433832795028841971693993751';
    const ok = PI_STR.startsWith(KNOWN.slice(0, Math.min(KNOWN.length, MAX_DIGITS + 1)));
    console.log(`[π] ✓ Listo en ${secs}s — verificación: ${ok ? 'OK' : 'ERROR'}`);
    console.log(`[π] π = ${PI_STR[0]}.${PI_STR.slice(1, 21)}…`);
  } catch (e) {
    console.error('[π] ERROR:', e);
  }
});

// ═══════════════════════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// ═══════════════════════════════════════════════════════════
//  ENDPOINTS
// ═══════════════════════════════════════════════════════════

app.get('/api/status', (req, res) => {
  res.json({
    ready,
    totalDigits: ready ? PI_STR.length - 1 : 0,
    maxDigits:   MAX_DIGITS,
    version:     '1.0.0',
  });
});

app.get('/api/pi', (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Calculando π…', ready: false });

  const start = Math.max(0, parseInt(req.query.start || '0', 10));
  const count = Math.min(100_000, Math.max(1, parseInt(req.query.count || '10000', 10)));

  if (start >= MAX_DIGITS)
    return res.status(400).json({ error: `start (${start}) >= maxDigits (${MAX_DIGITS})` });

  const decimals = PI_STR.slice(1);
  const chunk    = decimals.slice(start, start + count);

  res.json({ start, count: chunk.length, available: MAX_DIGITS, decimals: chunk });
});

app.get('/api/search', (req, res) => {
  if (!ready) return res.status(503).json({ error: 'Calculando π…', ready: false });

  const q = (req.query.q || '').replace(/\D/g, '');
  if (!q)            return res.status(400).json({ error: 'Parámetro q requerido' });
  if (q.length > 20) return res.status(400).json({ error: 'q: máx 20 dígitos' });

  const rStart = Math.max(0, parseInt(req.query.start || '0', 10));
  const rCount = Math.min(MAX_DIGITS, Math.max(1, parseInt(req.query.count || String(MAX_DIGITS), 10)));
  const rEnd   = Math.min(MAX_DIGITS, rStart + rCount);

  const decimals  = PI_STR.slice(1);
  const positions = [];
  let idx = rStart;

  while (idx < rEnd) {
    idx = decimals.indexOf(q, idx);
    if (idx === -1 || idx >= rEnd) break;
    positions.push(idx + 1);  // 1-based
    idx++;
    if (positions.length >= 10_000) break;
  }

  res.json({
    query: q, start: rStart, end: rEnd,
    totalFound: positions.length, positions,
    truncated: positions.length >= 10_000,
  });
});

// ═══════════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[π] Servidor en http://0.0.0.0:${PORT}`);
});
