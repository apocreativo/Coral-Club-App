// src/useKV.js
// Helpers para Vercel KV (REST) con merge por ID y best-effort INCR

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

// ===== Merge helpers =====
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const shallow = (a = {}, b = {}) => ({ ...(a || {}), ...(b || {}) });

// Merge por ID para arrays: upsert por id con merge superficial del objeto
function mergeArrayById(current = [], patch = []) {
  const byId = new Map();
  (current || []).forEach(it => byId.set(it.id, isObj(it) ? { ...it } : it));
  (patch || []).forEach(it => {
    if (!it || it.id == null) return;
    const prev = byId.get(it.id);
    if (isObj(prev) && isObj(it)) {
      byId.set(it.id, { ...prev, ...it });
    } else {
      byId.set(it.id, it);
    }
  });
  return Array.from(byId.values());
}

// Merge de categorías con items por id (sin romper tu UI)
function mergeCategories(curCats = [], patchCats = []) {
  const byId = new Map();
  (curCats || []).forEach(c => byId.set(c.id, { ...c, items: Array.isArray(c.items) ? c.items.slice() : [] }));
  (patchCats || []).forEach(pc => {
    if (!pc || pc.id == null) return;
    const cur = byId.get(pc.id);
    if (!cur) {
      byId.set(pc.id, { id: pc.id, name: pc.name, items: Array.isArray(pc.items) ? pc.items.slice() : [] });
    } else {
      const merged = { ...cur, ...pc };
      if (Array.isArray(cur.items) || Array.isArray(pc.items)) {
        merged.items = mergeArrayById(cur.items || [], pc.items || []);
      }
      byId.set(pc.id, merged);
    }
  });
  return Array.from(byId.values());
}

/**
 * kvMerge: lee estado actual, aplica patch con merge por ramas/ID y guarda.
 * - Objetos nivel 1: brand, background, layout, payments → merge superficial.
 * - Arrays: tents, reservations, logs → merge por id (upsert / merge superficial).
 * - categories → merge por id y por id dentro de items.
 * - Otras claves (e.g., rev) se copian directamente.
 * - Best-effort INCR del revKey (si falla, no rompemos).
 */
export async function kvMerge(stateKey, patch, revKey) {
  // 1) Estado más reciente
  const current = (await kvGet(stateKey)) || {};

  // 2) Merge por ramas
  const next = { ...current };

  // Objetos de primer nivel
  const objKeys = ["brand", "background", "layout", "payments"];
  for (const k of objKeys) {
    if (Object.prototype.hasOwnProperty.call(patch || {}, k)) {
      next[k] = shallow(current?.[k], patch[k]);
    } else if (current?.[k] !== undefined) {
      next[k] = current[k];
    }
  }

  // Arrays con merge por id
  if (Object.prototype.hasOwnProperty.call(patch || {}, "tents")) {
    next.tents = mergeArrayById(current?.tents || [], patch.tents || []);
  } else {
    next.tents = Array.isArray(current?.tents) ? current.tents : [];
  }

  if (Object.prototype.hasOwnProperty.call(patch || {}, "reservations")) {
    next.reservations = mergeArrayById(current?.reservations || [], patch.reservations || []);
  } else {
    next.reservations = Array.isArray(current?.reservations) ? current.reservations : [];
  }

  if (Object.prototype.hasOwnProperty.call(patch || {}, "logs")) {
    // logs por id no siempre tienen id; hacemos concatenación con dedupe por ts+type+message
    const cur = current?.logs || [];
    const p  = patch?.logs || [];
    const key = (r) => `${r?.ts || ""}|${r?.type || ""}|${r?.message || ""}`;
    const map = new Map();
    cur.forEach(r => map.set(key(r), r));
    p.forEach(r => map.set(key(r), r));
    next.logs = Array.from(map.values()).slice(-200); // limit
  } else {
    next.logs = Array.isArray(current?.logs) ? current.logs : [];
  }

  // categories con merge de items por id
  if (Object.prototype.hasOwnProperty.call(patch || {}, "categories")) {
    next.categories = mergeCategories(current?.categories || [], patch.categories || []);
  } else {
    next.categories = Array.isArray(current?.categories) ? current.categories : [];
  }

  // Cualquier otra clave del patch (p.ej. rev embebido)
  for (const k of Object.keys(patch || {})) {
    if (![...objKeys, "tents", "reservations", "logs", "categories"].includes(k)) {
      next[k] = patch[k];
    }
  }

  // 3) Guardar
  await kvSet(stateKey, next);

  // 4) Best-effort INCR
  if (revKey) {
    try {
      const r = await kvIncr(revKey);
      if (typeof r !== "number") {
        await kvSet(revKey, 1);
      }
    } catch {
      // ignorar; el cliente tiene pull de respaldo
    }
  }

  return next;
}
