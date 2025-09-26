// api/boot.js — inicializa el estado en KV
export const config = { runtime: "nodejs" };

const STATE_KEY = "coralclub:state";
const REV_KEY = "coralclub:rev";

export default async function handler(req, res) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ ok: false, error: "Missing KV env vars" });
  }

  const head = { headers: { Authorization: `Bearer ${token}` } };
  const headJson = {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };

  const initial = {
    brand: { name: "Coral Club", logoUrl: "/logo.png", logoSize: 42 },
    background: { publicPath: "/Mapa.png" },
    layout: { count: 20 },
    payments: { currency: "USD", whatsapp: "", tentPrice: 10 },
    categories: [],
    tents: [],
    reservations: [],
    logs: [],
    rev: 1,
  };

  try {
    let rev = await fetch(`${url}/get/${encodeURIComponent(REV_KEY)}`, head)
      .then((r) => r.json())
      .then((j) => j?.result?.value || 0);

    let state = await fetch(`${url}/get/${encodeURIComponent(STATE_KEY)}`, head)
      .then((r) => r.json())
      .then((j) => j?.result?.value);

    if (typeof state === "string") {
      try { state = JSON.parse(state); } catch {}
    }

    if (!rev || !state) {
      await fetch(`${url}/set/${encodeURIComponent(STATE_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: initial }),
      });

      await fetch(`${url}/set/${encodeURIComponent(REV_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: 1 }),
      });

      state = initial;
      rev = 1;
    }

    res.status(200).json({ ok: true, state, rev });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}

function decode(v) {
  try {
    if (typeof v === "string") return JSON.parse(v);
    return v;
  } catch {
    return v;
  }
}
