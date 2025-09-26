
// Client-side KV helper that talks to our serverless proxy (no tokens exposed)
const API_BASE = "/api/kv";

async function safeJson(r){
  try{ return await r.json(); }catch(_){ return null; }
}
export async function kvGet(key){
  const r = await fetch(`${API_BASE}/get/${encodeURIComponent(key)}`);
  const j = await safeJson(r);
  return j?.result ?? null;
}
export async function kvSet(key, value){
  const r = await fetch(`${API_BASE}/set/${encodeURIComponent(key)}`, {
    method:"POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ value })
  });
  const j = await safeJson(r);
  return j?.result ?? null;
}
export async function kvIncr(key){
  const r = await fetch(`${API_BASE}/incr/${encodeURIComponent(key)}`, { method:"POST" });
  const j = await safeJson(r);
  return j?.result ?? 0;
}
export async function kvMerge(stateKey, patch, revKey){
  // Simple shallow merge on server via set+incr sequence (done from client in this version)
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
