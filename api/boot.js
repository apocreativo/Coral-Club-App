// api/boot.js — inicializa/normaliza estado en KV
export const config = { runtime: "nodejs" };

const STATE_KEY = "coralclub:state";
const REV_KEY   = "coralclub:rev";

export default async function handler(req, res) {
  const url   = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ ok:false, error:"Missing KV env vars" });
  }

  const baseUrl  = url.replace(/\/$/, "");
  const head     = { headers: { Authorization: `Bearer ${token}` } };
  const headJson = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
  const j = async (r) => { try { return await r.json(); } catch { return null; } };

  // Estado inicial mínimo válido (puedes ajustar tentPrice default)
  const initial = {
    brand: { name: "Coral Club", logoUrl: "/logo.png", logoSize: 42 },
    background: { publicPath: "/Mapa.png" },
    layout: {},
    payments: { currency: "USD", whatsapp: "", tentPrice: 10 },
    categories: [],
    tents: [],
    reservations: [],
    logs: [],
    rev: 1,
  };

  try {
    // Reset opcional
    const requestUrl = new URL(req.url, "https://dummy");
    const isReset = requestUrl.searchParams.get("reset") === "1";
    if (isReset) {
      await fetch(`${baseUrl}/set/${encodeURIComponent(STATE_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: initial })
      });
      await fetch(`${baseUrl}/set/${encodeURIComponent(REV_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: 1 })
      });
      return res.status(200).json({ ok:true, state: initial, rev: 1, reset:true });
    }

    // Leer rev y state
    let rev = await fetch(`${baseUrl}/get/${encodeURIComponent(REV_KEY)}`, head).then(j);
    rev = (rev && rev.result && rev.result.value) ?? (rev && rev.result) ?? 0;

    let state = await fetch(`${baseUrl}/get/${encodeURIComponent(STATE_KEY)}`, head).then(j);
    state = (state && state.result && state.result.value) ?? (state && state.result) ?? null;

    // Si vino como string, intenta parsear
    if (typeof state === "string") {
      try { state = JSON.parse(state); } catch {}
    }

    // Seed si faltaba algo
    if (!rev || !state) {
      await fetch(`${baseUrl}/set/${encodeURIComponent(STATE_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: initial })
      });
      await fetch(`${baseUrl}/set/${encodeURIComponent(REV_KEY)}`, {
        method: "POST", ...headJson, body: JSON.stringify({ value: 1 })
      });
      state = initial;
      rev   = 1;
    }

    return res.status(200).json({ ok:true, state, rev });
  } catch (e) {
    return res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}
