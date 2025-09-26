export const config = { runtime: 'nodejs20.x' };

function base(res){
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if(!url || !token){
    res.status(500).json({ error: 'Missing KV_REST_API_URL or KV_REST_API_TOKEN' });
    return null;
  }
  return { url: url.replace(/\/$/, ''), token };
}

export default async function handler(req, res){
  const ctx = base(res); if(!ctx) return;
  const key = (req.query.key || req.query.path || req.query['...key'] || []).join ? (req.query['...key']||[]) : [req.query.key];
  const k = Array.isArray(key) ? key.join('/') : String(key||'');
  const upstream = await fetch(`${ctx.url}/get/${encodeURIComponent(k)}`, {
    headers: { Authorization: `Bearer ${ctx.token}` }
  });
  const data = await upstream.json().catch(()=>({}));
  res.status(upstream.status).json(data);
}
