
const API_URL = import.meta.env.VITE_KV_REST_API_URL || "";
const API_TOKEN = import.meta.env.VITE_KV_REST_API_TOKEN || "";
const NAMESPACE = import.meta.env.VITE_KV_REST_NAMESPACE || "";

let _warned = false;
function ensureEnv(){
  if (!API_URL || !API_TOKEN){
    if(!_warned){
      _warned = true;
      console.warn("[KV] Falta VITE_KV_REST_API_URL o VITE_KV_REST_API_TOKEN.");
      try{ alert("Faltan las variables de entorno KV. La app funcionará localmente sin persistir hasta configurarlas."); }catch(_){}
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
export async function kvGet(key){
  if(!ensureEnv()) return null;
  const r = await fetch(`${API_URL.replace(/\/$/,'')}/get/${encodeURIComponent(key)}`, { headers: headers(false) });
  if(!r.ok) throw new Error(`kvGet ${key}: ${r.status}`);
  const data = await r.json();
  return data.result ?? null;
}
export async function kvSet(key, value){
  if(!ensureEnv()) return null;
  const r = await fetch(`${API_URL.replace(/\/$/,'')}/set/${encodeURIComponent(key)}`, {
    method: "POST", headers: headers(), body: JSON.stringify({ value })
  });
  if(!r.ok) throw new Error(`kvSet ${key}: ${r.status}`);
  const data = await r.json(); return data.result;
}
export async function kvIncr(key){
  if(!ensureEnv()) return 0;
  const r = await fetch(`${API_URL.replace(/\/$/,'')}/incr/${encodeURIComponent(key)}`, { method:"POST", headers: headers(false) });
  if(!r.ok) throw new Error(`kvIncr ${key}: ${r.status}`);
  const data = await r.json(); return data.result;
}
export async function kvMerge(stateKey, patch, revKey){
  if(!ensureEnv()){ console.warn("[KV] kvMerge local-only"); return { ...(patch||{}) }; }
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
