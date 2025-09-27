function shallowMerge(current={}, patch={}){
  const out = { ...current };
  for(const k of ['brand','background','layout','payments']){
    if(k in patch) out[k] = { ...(current[k]||{}), ...(patch[k]||{}) };
    else if(!(k in out)) out[k] = current[k] || {};
  }
  for(const k of ['categories','tents','reservations','logs']){
    if(k in patch) out[k] = Array.isArray(patch[k]) ? patch[k] : (Array.isArray(current[k])? current[k] : []);
    else if(!(k in out)) out[k] = Array.isArray(current[k]) ? current[k] : [];
  }
  for (const k of Object.keys(patch)){
    if (!['brand','background','layout','payments','categories','tents','reservations','logs'].includes(k)){
      out[k] = patch[k];
    }
  }
  return out;
}
export default async function handler(req, res){
  if(req.method!=='POST') return res.status(405).send('Method Not Allowed');
  try{
    const { stateKey, patch, revKey } = req.body || {};
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if(!url || !token) return res.status(500).json({ ok:false, error:'Missing KV envs' });
    const rGet = await fetch(`${url}/get/${encodeURIComponent(stateKey)}`, { headers:{ Authorization:`Bearer ${token}` } });
    const jGet = await rGet.json().catch(()=>({}));
    const current = rGet.ok ? (jGet?.result || {}) : {};
    const next = shallowMerge(current, patch || {});
    next.rev = Number((current?.rev || 0)) + 1;
    const rSet = await fetch(`${url}/set/${encodeURIComponent(stateKey)}`, {
      method:'POST',
      headers:{ Authorization:`Bearer ${token}`, 'content-type':'application/json' },
      body: JSON.stringify({ value: next, nx:false })
    });
    if(!rSet.ok){ const t = await rSet.text(); return res.status(500).json({ ok:false, error:t }); }
    if(revKey){
      await fetch(`${url}/incr/${encodeURIComponent(revKey)}`, {
        method:'POST',
        headers:{ Authorization:`Bearer ${token}` }
      }).catch(()=>{});
    }
    return res.status(200).json({ ok:true, state: next });
  }catch(e){ return res.status(500).json({ ok:false, error:String(e) }); }
}