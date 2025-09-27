
const API = { base: "/api/kv" };
async function j(r){ try{ return await r.json(); }catch(_){ return null; } }
export const STATE_KEY = "coralclub:state";
export const REV_KEY = "coralclub:rev";
export async function boot(){ const r = await fetch("/api/boot"); return await j(r); }
export async function kvGet(key){ const r = await fetch(`${API.base}/get/${encodeURIComponent(key)}`); return (await j(r))?.result ?? null; }
export async function kvSet(key, value){ const r = await fetch(`${API.base}/set/${encodeURIComponent(key)}`, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ value }) }); return (await j(r))?.result ?? null; }
export async function kvIncr(key){ const r = await fetch(`${API.base}/incr/${encodeURIComponent(key)}`, { method:"POST" }); return (await j(r))?.result ?? 0; }
export async function kvMerge(stateKey, patch, revKey){
  const cur = await kvGet(stateKey);
  const next = cur ? { ...cur } : {};
  for(const [k,v] of Object.entries(patch||{})){
    if(Array.isArray(v)) next[k] = v; else if (v && typeof v === "object") next[k] = { ...(next[k]||{}), ...v }; else next[k] = v;
  }
  const newRev = await kvIncr(revKey);
  next.rev = newRev || 0;
  await kvSet(stateKey, next);
  return next;
}
export default { boot, kvGet, kvSet, kvIncr, kvMerge, STATE_KEY, REV_KEY };
