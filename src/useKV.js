
const DISABLE = (import.meta.env.VITE_DISABLE_KV || "") === "1";
const API_URL = import.meta.env.VITE_KV_REST_API_URL || "";
const API_TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NAMESPACE = import.meta.env.VITE_KV_REST_NAMESPACE || "";

function envOk(){
  if (DISABLE) { console.warn("[KV] DISABLED by VITE_DISABLE_KV=1"); return false; }
  if (!API_URL || !API_TOKEN){ console.warn("[KV] Missing envs. Local mode."); return false; }
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
    const ct = r.headers.get("content-type") || "";
    if(!/application\/json/i.test(ct)){
      console.error("[KV] Non-JSON response", ct, url); return null;
    }
    const j = await r.json().catch(e=>{ console.error("[KV] JSON parse", e); return null; });
    return j;
  }catch(e){
    console.error("[KV] fetch error", e);
    return null;
  }
}

export async function kvGet(key){
  if(!envOk()) return null;
  return (await safeFetch(`${base()}/get/${encodeURIComponent(key)}`, { headers: headers(false) }))?.result ?? null;
}
export async function kvSet(key, value){
  if(!envOk()) return null;
  return (await safeFetch(`${base()}/set/${encodeURIComponent(key)}`, { method:"POST", headers: headers(), body: JSON.stringify({ value }) }))?.result ?? null;
}
export async function kvIncr(key){
  if(!envOk()) return 0;
  return (await safeFetch(`${base()}/incr/${encodeURIComponent(key)}`, { method:"POST", headers: headers(false) }))?.result ?? 0;
}
export async function kvMerge(stateKey, patch, revKey){
  if(!envOk()){ return { ...(patch||{}) }; }
  const cur = await kvGet(stateKey);
  const next = cur ? { ...cur } : {};
  for(const [k,v] of Object.entries(patch||{})){
    if(Array.isArray(v)) next[k] = v;
    else if (v && typeof v === "object") next[k] = { ...(next[k]||{}), ...v };
    else next[k] = v;
  }
  const newRev = await kvIncr(revKey);
  next.rev = newRev || 0;
  await kvSet(stateKey, next);
  return next;
}

export default { kvGet, kvSet, kvIncr, kvMerge };
