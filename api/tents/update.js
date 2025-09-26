import { kv } from "@vercel/kv";
const TENTS_KEY = "app:tents";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { id, x, y, state } = req.body || {};
  if (!id) return res.status(400).json({ ok:false, error:"id" });

  const tents = (await kv.get(TENTS_KEY)) || [];
  const idx = tents.findIndex(t => t.id === id);
  if (idx === -1) {
    tents.push({ id, x: typeof x==="number"?x:0.5, y: typeof y==="number"?y:0.5, state: state || "av" });
  } else {
    tents[idx] = { ...tents[idx],
      ...(typeof x==="number" ? { x } : {}),
      ...(typeof y==="number" ? { y } : {}),
      ...(state ? { state } : {})
    };
  }
  await kv.set(TENTS_KEY, tents);
  res.json({ ok:true, tent: tents.find(t=>t.id===id) });
}