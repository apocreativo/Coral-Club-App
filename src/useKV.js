// src/useKV.js
// Helpers para Vercel KV (REST) con merge seguro para Coral Club

const BASE = import.meta.env.VITE_KV_REST_API_URL?.replace(/\/+$/, "");
const TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NS    = import.meta.env.VITE_KV_REST_NAMESPACE?.replace(/\/+$/, "") || "";

function urlFor(key) {
  const k = encodeURIComponent(key);
  // Compat: soporta namespace opcional
  return NS ? `${BASE}/${NS}/get/${k}` : `${BASE}/get/${k}`;
}
function urlSetFor(key) {
  const k = encodeURIComponent(key);
  return NS ? `${BASE}/${NS}/set/${k}` : `${BASE}/set/${k}`;
}
function urlIncrFor(key) {
  const k = encodeURIComponent(key);
  return NS ? `${BASE}/${NS}/incr/${k}` : `${BASE}/incr/${k}`;
}

async function doFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=> "");
    throw new Error(`KV ${opts.method || "GET"} ${url} -> ${res.status} ${res.statusText} ${txt}`);
  }
  // algunos endpoints devuelven JSON, otros valores primitivos
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export async function kvGet(key) {
  const r = await doFetch(urlFor(key));
  // formatos posibles:
  // { result: { value: <json|primitive> } }  o  { result: "<string>" }
  const val = r?.result?.value ?? r?.result ?? null;
  // si es un string que parece JSON, intenta parsear
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

export async function kvSet(key, value) {
  const body = JSON.stringify({ value });
  const r = await doFetch(urlSetFor(key), { method: "POST", body });
  return r?.result ?? true;
}

export async function kvIncr(key) {
  const r = await doFetch(urlIncrFor(key), { method: "POST" });
  // { result: 123 }
  return r?.result ?? null;
}

// ---- MERGE SEGURO PARA coralclub:state ----
// Reglas:
// - Objetos de nivel 1: brand, background, layout, payments -> merge profundo superficial (shallow en cada rama)
// - Arrays: categories, tents, reservations, logs -> si vienen en patch, REEMPLAZAN; si no, se preservan
// - rev: si viene en patch, se respeta; normalmente lo manejamos con REV_KEY aparte
// - Nunca perdemos claves no incluidas en el patch
function shallowMerge(obj = {}, patch = {}) {
  return { ...obj, ...patch };
}
function mergeBranch(current, patch, keysToShallowMerge, arrayKeys) {
  const next = { ...current };

  // ramas objeto con merge superficial
  for (const k of keysToShallowMerge) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, k)) {
      const cur = current?.[k] ?? {};
      const inc = patch[k] ?? {};
      next[k] = shallowMerge(cur, inc);
    } else {
      next[k] = current?.[k];
    }
  }

  // ramas array: reemplazo si vienen en patch; si no, preservo
  for (const k of arrayKeys) {
    if (patch && Object.prototype.hasOwnProperty.call(patch, k)) {
      const v = patch[k];
      next[k] = Array.isArray(v) ? v.slice() : (Array.isArray(current?.[k]) ? current[k] : []);
    } else {
      next[k] = Array.isArray(current?.[k]) ? current[k] : [];
    }
  }

  // Cualquier otra clave del patch que no esté listada arriba → copiar tal cual (ej. campos futuros)
  for (const k of Object.keys(patch || {})) {
    if (![...keysToShallowMerge, ...arrayKeys].includes(k)) {
      next[k] = patch[k];
    }
  }

  return next;
}

export async function kvMerge(stateKey, patch, revKey) {
  // 1) Lee estado actual (si no hay, parte de objeto vacío)
  const current = (await kvGet(stateKey)) || {};

  // 2) Merge controlado por ramas
  const keysObj  = ["brand", "background", "layout", "payments"];
  const keysArr  = ["categories", "tents", "reservations", "logs"];
  let merged = mergeBranch(current, patch || {}, keysObj, keysArr);

  // Mantén 'rev' si existe (no lo incrementamos aquí; eso va por REV_KEY)
  if (typeof current.rev === "number" && !("rev" in (patch || {}))) {
    merged.rev = current.rev;
  }

  // 3) Guarda nuevo estado
  await kvSet(stateKey, merged);

  // 4) INCR en revKey
  if (revKey) await kvIncr(revKey);

  // 5) Devuelve el estado completo (ya persistido)
  return merged;
}
