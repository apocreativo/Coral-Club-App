// api/kv/get/[key].js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { key } = req.query;
  try {
    const val = await kv.get(key);
    res.status(200).json({ ok: true, result: val });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
