import { kv } from "@vercel/kv";
const TENTS_KEY = "app:tents";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { tents } = req.body || {};
  if (!Array.isArray(tents)) return res.status(400).json({ ok:false, error:"tents" });
  await kv.set(TENTS_KEY, tents);
  res.json({ ok:true });
}