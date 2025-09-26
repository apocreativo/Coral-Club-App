import { kv } from "@vercel/kv";
const CONFIG_KEY = "app:config";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { payload } = req.body || {};
  if (!payload || typeof payload !== "object") return res.status(400).json({ ok:false, error:"payload" });

  // Sobrescribe (o podrías hacer merge profundo si quieres)
  await kv.set(CONFIG_KEY, payload);
  res.json({ ok:true });
}