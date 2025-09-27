// Simple wrappers to call our Vercel Serverless endpoints
const base = '/api';
async function post(path, body) {
  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify(body||{}),
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>'');
    throw new Error(`API ${path} failed: ${res.status} ${t}`);
  }
  return res.json();
}
export async function kvGet(key)  { const r = await post('kv-get',  { key }); return r.value ?? null; }
export async function kvSet(key,value) { const r = await post('kv-set',  { key, value }); return r.ok===true; }
export async function kvIncr(key) { const r = await post('kv-incr', { key }); return r.value ?? null; }
export async function kvMerge(stateKey, patch, revKey) {
  const r = await post('kv-merge', { stateKey, patch, revKey });
  return r.state;
}
