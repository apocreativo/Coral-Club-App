// src/useKV.js
// Helpers para Vercel KV (REST) con merge seguro y best-effort INCR

const BASE = import.meta.env.VITE_KV_REST_API_URL?.replace(/\/+$/, "");
const TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NS    = import.meta.env.VITE_KV_REST_NAMESPACE?.replace(/\/+$/, "") || "";

function urlGet(key) {
  const k = encodeURIComponent(key);
  return NS ? `${BASE}/${NS}/get/${k}` : `${BASE}/get/${k}`;
}
function urlSet(key) {
  const k = encodeURIComponent(key);
  return NS ? `${BASE}/${NS}/set/${k}` : `${BASE}/set/${k}`;
}
function urlIncr(key) {
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
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export async function kvGet(key) {
  const r = await doFetch(urlGet(key));
  const val = r?.result?.value ?? r?.result ?? null;
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch { return val; }
  }
  return val;
}

export async function kvSet(key, value) {
  const body = JSON.stringify({ value });
  const r = await doFetch(urlSet(key), { method: "POST", body });
  return r?.result ?? true;
}

export async function kvIncr(key) {
  const r = await doFetch(urlIncr(key), { method: "POST" });
  return r?.result ?? null;
}

// ---- MERGE SEGURO PARA coralclub:state ----
function shallow(obj = {}, patch = {}) {
  return { ...obj, ...patch };
}

export async function kvMerge(stateKey, patch, revKey) {
  // 1) Estado actual
  const current = (await kvGet(stateKey)) || {};

  // 2) Merge por ramas
  const keysObj  = ["brand", "background", "layout", "payments"];
  const keysArr  = ["categories", "tents", "reservations", "logs"];

  const next = { ...current };

  // Objetos nivel 1 (merge superficial)
  for (const k of keysObj) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, k)) {
      next[k] = shallow(current?.[k] || {}, patch[k] || {});
    } else if (current?.[k] !== undefined) {
      next[k] = current[k];
    }
  }

  // Arrays (reemplazo si vienen en el patch)
  for (const k of keysArr) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, k)) {
      const v = patch[k];
      next[k] = Array.isArray(v) ? v.slice() : (Array.isArray(current?.[k]) ? current[k] : []);
    } else {
      next[k] = Array.isArray(current?.[k]) ? current[k] : [];
    }
  }

  // Otras claves del patch (ej. rev interno)
  for (const k of Object.keys(patch || {})) {
    if (![...keysObj, ...keysArr].includes(k)) next[k] = patch[k];
  }

  // Preservar rev si no vino en patch
  if (typeof current.rev === "number" && !("rev" in (patch || {}))) {
    next.rev = current.rev;
  }

  // 3) Guardar
  await kvSet(stateKey, next);

  // 4) Best-effort INCR (si falla, el plan B sincroniza)
  if (revKey) {
    try {
      const r = await kvIncr(revKey);
      if (typeof r !== "number") {
        await kvSet(revKey, 1);
      }
    } catch {
      // ignorar
    }
  }

  // 5) Devolver merged completo
  return next;
}
