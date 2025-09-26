export const config = { runtime: 'nodejs20.x' };
function ctxOr500(res){
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if(!url || !token){ res.status(500).json({ error:"Missing KV_REST_API_URL or KV_REST_API_TOKEN" }); return null; }
  return { url: url.replace(/\/$/, ''), token };
}export default async function handler(req, res){
  const ctx = ctxOr500(res); if(!ctx) return;
  const parts = req.query['...key'] || []; const key = Array.isArray(parts)? parts.join('/') : String(parts||'');
  const body = typeof req.body === 'object' ? req.body : {};
  const r = await fetch(`${ctx.url}/set/${encodeURIComponent(key)}`, { method:"POST", headers:{ Authorization:`Bearer ${ctx.token}`,"Content-Type":"application/json" }, body: JSON.stringify({ value: body.value }) });
  const j = await r.json().catch(()=>({})); res.status(r.status).json(j);
}