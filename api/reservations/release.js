import { kv } from "@vercel/kv";
const TENTS_KEY = "app:tents";
const RES_KEY   = "app:reservations";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { tentId, resId, toState="av", newStatus="expired" } = req.body || {};
  const tents = (await kv.get(TENTS_KEY)) || [];
  const resvs = (await kv.get(RES_KEY)) || [];

  const ti = tents.findIndex(t => t.id === tentId);
  if (ti !== -1) tents[ti] = { ...tents[ti], state: toState };

  const ri = resvs.findIndex(r => r.id === resId);
  if (ri !== -1) resvs[ri] = { ...resvs[ri], status: newStatus };

  await Promise.all([ kv.set(TENTS_KEY, tents), kv.set(RES_KEY, resvs) ]);
  res.json({ ok:true });
}
