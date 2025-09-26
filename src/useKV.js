// src/useKV.js
// Cliente KV que habla con el proxy serverless (/api/kv) y hace boot inicial.
// Incluye "decode" para convertir strings JSON -> objetos (evita crashes).

const API_BASE = "/api/kv";
export const STATE_KEY = "coralclub:state";
export const REV_KEY   = "coralclub:rev";

// --- helpers ---
async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

// Convierte valores stringificados a objeto real
function decode(v) {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { /* se deja tal cual */ }
  }
  return v;
}

// --- boot: asegura STATE+REV en el servidor (/api/boot auto-seedea si falta) ---
export async function boot() {
  const r = await fetch("/api/boot");
  const data = await safeJson(r);
  return {
    ok: !!data?.ok,
    state: decode(data?.state) ?? null,
    rev: typeof data?.rev === "number" ? data.rev : 0,
  };
}

// --- operaciones KV vía proxy ---
export async function kvGet(key) {
  const r = await fetch(`${API_BASE}/get/${encodeURIComponent(key)}`);
  const j = await safeJson(r);
  return decode(j?.result ?? null);
}

export async function kvSet(key, value) {
  const r = await fetch(`${API_BASE}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  const j = await safeJson(r);
  return decode(j?.result ?? null);
}

export async function kvIncr(key) {
  const r = await fetch(`${API_BASE}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
  });
  const j = await safeJson(r);
  return Number(j?.result ?? 0);
}

// Merge superficial + INCR de REV_KEY
export async function kvMerge(stateKey, patch, revKey) {
  const cur = decode(await kvGet(stateKey));
  const next = cur ? { ...cur } : {};

  for (const [k, v] of Object.entries(patch || {})) {
    if (Array.isArray(v)) {
      next[k] = v;
    } else if (v && typeof v === "object") {
      next[k] = { ...(next[k] || {}), ...v };
    } else {
      next[k] = v;
    }
  }

  const newRev = await kvIncr(revKey);
  next.rev = newRev || 0;

  await kvSet(stateKey, next);
  return next;
}

export default { boot, kvGet, kvSet, kvIncr, kvMerge, STATE_KEY, REV_KEY };
