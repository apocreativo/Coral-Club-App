
const API_URL = import.meta.env.VITE_KV_REST_API_URL || "";
const API_TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NAMESPACE = import.meta.env.VITE_KV_REST_NAMESPACE || "";

let _warned = false;
function ensureEnv(){
  if (!API_URL || !API_TOKEN){
    if(!_warned){
      _warned = true;
      try{ alert("Faltan las variables KV. La app se ejecuta en modo local (sin persistir)."); }catch(_){}
      console.warn("[KV] Vars faltantes: VITE_KV_REST_API_URL / VITE_KV_REST_API_TOKEN");
    }
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

async function safeJson(r){
  try{ return await r.json(); } catch(e){ return { error: "non-json", status: r.status }; }
}

// Helpers (no-throw)
export async function kvGet(key){
  if(!ensureEnv()) return null;
  try{
    const r = await fetch(`${API_URL.replace(/\/$/,'')}/get/${encodeURIComponent(key)}`, { headers: headers(false) });
    if(!r.ok){ console.error("kvGet not ok", r.status); return null; }
    const data = await safeJson(r);
    return data?.result ?? null;
  }catch(e){
    console.error("kvGet error", e); return null;
  }
}
export async function kvSet(key, value){
  if(!ensureEnv()) return null;
  try{
    const r = await fetch(`${API_URL.replace(/\/$/,'')}/set/${encodeURIComponent(key)}`, {
      method: "POST", headers: headers(), body: JSON.stringify({ value })
    });
    if(!r.ok){ console.error("kvSet not ok", r.status); return null; }
    const data = await safeJson(r);
    return data?.result ?? null;
  }catch(e){
    console.error("kvSet error", e); return null;
  }
}
export async function kvIncr(key){
  if(!ensureEnv()) return 0;
  try{
    const r = await fetch(`${API_URL.replace(/\/$/,'')}/incr/${encodeURIComponent(key)}`, { method:"POST", headers: headers(false) });
    if(!r.ok){ console.error("kvIncr not ok", r.status); return 0; }
    const data = await safeJson(r);
    return data?.result ?? 0;
  }catch(e){
    console.error("kvIncr error", e); return 0;
  }
}
export async function kvMerge(stateKey, patch, revKey){
  if(!ensureEnv()){ console.warn("[KV] kvMerge local-only"); return { ...(patch||{}) }; }
  try{
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
  }catch(e){
    console.error("kvMerge error", e); return { ...(patch||{}) };
  }
}
export default { kvGet, kvSet, kvIncr, kvMerge };
