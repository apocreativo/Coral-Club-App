// api/kv/set/[key].js
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  const { key } = req.query;
  try {
    const { value } = req.body || {};
    await kv.set(key, value);
    res.status(200).json({ ok: true, result: value });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
}
