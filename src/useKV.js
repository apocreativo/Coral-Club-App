// src/useKV.js — blindado contra pantallas negras y datos incompletos
const API_BASE = "/api/kv";
export const STATE_KEY = "coralclub:state";
export const REV_KEY   = "coralclub:rev";

// Helpers
async function safeJson(r){ try{ return await r.json(); }catch{ return null; } }
function decode(v){ if(typeof v==="string"){ try{ return JSON.parse(v); }catch{} } return v; }

// Defaults seguros para que nunca falle un render (tents.map, brand.name, etc.)
function normalizeState(s){
  s = decode(s) || {};
  const brand = s.brand && typeof s.brand === "object" ? s.brand : {};
  const background = s.background && typeof s.background === "object" ? s.background : {};
  const p0 = s.payments && typeof s.payments === "object" ? s.payments : {};
  const payments = {
    currency: p0.currency || "USD",
    tentPrice: Number(p0.tentPrice ?? 0) || 0,
    whatsapp: p0.whatsapp || "",
    mp: p0.mp || "",
    zelle: p0.zelle || "",
    bank: p0.bank || "",
    alias: p0.alias || "",
    phone: p0.phone || "",
    linkMp: p0.linkMp || "",
  };
  return {
    brand: {
      name: brand.name || "Coral Club",
      logoUrl: brand.logoUrl || "/logo.png",
      logoSize: typeof brand.logoSize === "number" ? brand.logoSize : 42,
      ...brand,
    },
    background: { publicPath: background.publicPath || "/Mapa.png", ...background },
    layout: s.layout && typeof s.layout === "object" ? s.layout : {},
    categories: Array.isArray(s.categories) ? s.categories : [],
    tents: Array.isArray(s.tents) ? s.tents : [],
    reservations: Array.isArray(s.reservations) ? s.reservations : [],
    logs: Array.isArray(s.logs) ? s.logs : [],
    payments,
    rev: typeof s.rev === "number" ? s.rev : 1,
  };
}

// API
export async function boot(){
  const r = await fetch("/api/boot");
  const d = await safeJson(r);
  return {
    ok: !!d?.ok,
    state: normalizeState(d?.state),
    rev: typeof d?.rev === "number" ? d.rev : 0,
  };
}

export async function kvGet(key){
  const r = await fetch(`${API_BASE}/get/${encodeURIComponent(key)}`);
  const j = await safeJson(r);
  return decode(j?.result ?? null);
}

export async function kvSet(key, value){
  const r = await fetch(`${API_BASE}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  const j = await safeJson(r);
  return decode(j?.result ?? null);
}

export async function kvIncr(key){
  const r = await fetch(`${API_BASE}/incr/${encodeURIComponent(key)}`, { method: "POST" });
  const j = await safeJson(r);
  return Number(j?.result ?? 0);
}

// Merge superficial + normalización y bump de REV
export async function kvMerge(stateKey, patch, revKey){
  const cur = normalizeState(await kvGet(stateKey));
  const next = { ...cur };
  for (const [k,v] of Object.entries(patch || {})) {
    if (Array.isArray(v)) next[k] = v;
    else if (v && typeof v === "object") next[k] = { ...(next[k]||{}), ...v };
    else next[k] = v;
  }
  // coherencia en payments
  next.payments = normalizeState({ payments: next.payments }).payments;

  const newRev = await kvIncr(revKey);
  next.rev = newRev || 0;

  await kvSet(stateKey, next);
  return normalizeState(next);
}

export default { boot, kvGet, kvSet, kvIncr, kvMerge, STATE_KEY, REV_KEY };
