import { kv } from "@vercel/kv";
const TENTS_KEY = "app:tents";
const RES_KEY   = "app:reservations";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { tentId, reservation, holdMinutes=15 } = req.body || {};
  if (!tentId || !reservation?.id) return res.status(400).json({ ok:false, error:"input" });

  const tents = (await kv.get(TENTS_KEY)) || [];
  const idx = tents.findIndex(t => t.id === tentId);
  if (idx === -1) return res.status(400).json({ ok:false, reason:"no_tent" });

  if (tents[idx].state !== "av") {
    return res.json({ ok:false, reason:"not_available" });
  }

  // marcar en proceso (pr)
  tents[idx] = { ...tents[idx], state: "pr" };

  const now = Date.now();
  const exp = new Date(now + holdMinutes*60000).toISOString();
  const reservations = (await kv.get(RES_KEY)) || [];
  reservations.unshift({ ...reservation, expiresAt: reservation.expiresAt || exp, createdAt: reservation.createdAt || new Date(now).toISOString(), status:"pending" });

  await Promise.all([ kv.set(TENTS_KEY, tents), kv.set(RES_KEY, reservations) ]);

  res.json({ ok:true });
}