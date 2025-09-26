
const API_URL = import.meta.env.VITE_KV_REST_API_URL || "";
const API_TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NAMESPACE = import.meta.env.VITE_KV_REST_NAMESPACE || "";

// No UI changes: solo console.warn/console.error
function envOk(){
  if (!API_URL || !API_TOKEN){
    if (typeof console !== "undefined") console.warn("[KV] Falta VITE_KV_REST_API_URL o VITE_KV_REST_API_TOKEN. Modo local.");
    return false;
  }
  return true;
}
function headers(json=true){
  const h = { "Authorization": `Bearer ${API_TOKEN}` };
  if(json) h["Content-Type"] = "application/json";
  if(NAMESPACE) h["Upstash-Namespaces"] = NAMESPACE;
  return h;
}
const base = () => API_URL.replace(/\/$/, "");

async function safeFetch(url, opts){
  try{
    const r = await fetch(url, opts);
    if(!r.ok){ console.error("[KV] HTTP", r.status, url); return null; }
    const j = await r.json().catch(()=>null);
    return j;
  }catch(e){
    console.error("[KV] fetch error", e);
    return null;
  }
}

export async function kvGet(key){
  if(!envOk()) return null;
  const data = await safeFetch(`${base()}/get/${encodeURIComponent(key)}`, { headers: headers(false) });
  return data?.result ?? null;
}
export async function kvSet(key, value){
  if(!envOk()) return null;
  const data = await safeFetch(`${base()}/set/${encodeURIComponent(key)}`, {
    method:"POST", headers: headers(), body: JSON.stringify({ value })
  });
  return data?.result ?? null;
}
export async function kvIncr(key){
  if(!envOk()) return 0;
  const data = await safeFetch(`${base()}/incr/${encodeURIComponent(key)}`, { method:"POST", headers: headers(false) });
  return (data?.result ?? 0) || 0;
}
export async function kvMerge(stateKey, patch, revKey){
  if(!envOk()){
    // Merge local-only para no romper la UX
    return { ...(patch||{}) };
  }
  const cur = await kvGet(stateKey);
  const next = cur ? { ...cur } : {};
  for(const [k,v] of Object.entries(patch||{})){
    if(Array.isArray(v)) next[k] = v;
    else if (v && typeof v === "object") next[k] = { ...(next[k]||{}), ...v };
    else next[k] = v;
  }
  const newRev = await kvIncr(revKey);
  next.rev = newRev;
  await kvSet(stateKey, next);
  return next;
}
export default { kvGet, kvSet, kvIncr, kvMerge };
