export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const { key, value } = req.body || {};
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!url || !token) return res.status(500).json({ ok:false, error:'Missing KV envs' });
    const r = await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method:'POST',
      headers: { Authorization:`Bearer ${token}`, 'content-type':'application/json' },
      body: JSON.stringify({ value, nx:false })
    });
    if (!r.ok) return res.status(500).json({ ok:false, error: await r.text() });
    res.status(200).json({ ok:true });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e) });
  }
}