// REST helpers to Vercel KV through /api/*
// If API fails, we return null (caller handles defaults).
const base = '/api';
async function post(path, body) {
  try {
    const res = await fetch(`${base}/${path}`, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify(body||{}),
    });
    if (!res.ok) throw new Error(`API ${path} ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[KV API] fail:', path, e?.message);
    return null;
  }
}
export async function kvGet(key){ const r = await post('kv-get', { key }); return r ? (r.value ?? null) : null; }
export async function kvSet(key,value){ const r = await post('kv-set', { key, value }); return !!(r && r.ok); }
export async function kvIncr(key){ const r = await post('kv-incr', { key }); return r ? (r.value ?? null) : null; }
export async function kvMerge(stateKey, patch, revKey){ const r = await post('kv-merge', { stateKey, patch, revKey }); return r ? r.state : null; }
