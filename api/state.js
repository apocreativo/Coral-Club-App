import { kv } from "@vercel/kv";

const CONFIG_KEY = "app:config";
const TENTS_KEY = "app:tents";
const RES_KEY   = "app:reservations";

function nowISO(){ return new Date().toISOString(); }

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const [config, tents, reservations] = await Promise.all([
    kv.get(CONFIG_KEY),
    kv.get(TENTS_KEY),
    kv.get(RES_KEY),
  ]);

  let changed = false;
  const now = new Date().toISOString();

  // Expirar reservas pendientes
  const resList = Array.isArray(reservations) ? [...reservations] : [];
  const tentsList = Array.isArray(tents) ? [...tents] : [];

  for (const r of resList) {
    if (r.status === "pending" && r.expiresAt && r.expiresAt <= now) {
      r.status = "expired";
      const idx = tentsList.findIndex(t => t.id === r.tentId);
      if (idx !== -1) tentsList[idx] = { ...tentsList[idx], state: "av" };
      changed = true;
    }
  }
  if (changed) {
    await Promise.all([
      kv.set(TENTS_KEY, tentsList),
      kv.set(RES_KEY, resList),
    ]);
  }

  res.json({ config: config || null, tents: tentsList, reservations: resList });
}