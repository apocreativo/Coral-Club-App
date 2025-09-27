export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).send('Method Not Allowed');
  try{
    const { key } = req.body || {};
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if(!url || !token) return res.status(500).json({ ok:false, error:'Missing KV envs' });
    const r = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}` }
    });
    const j = await r.json().catch(()=>({}));
    return res.status(200).json({ ok:true, value: Number(j?.result || 0) });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e) }); }
}