// api/boot.js
import { kv } from "@vercel/kv";

const STATE_KEY = "coralclub:state";
const REV_KEY = "coralclub:rev";

const initialData = {
  rev: 0,
  brand: { name: "Coral Club", logoUrl: "/logo.png", logoSize: 42 },
  background: { publicPath: "/Mapa.png" },
  layout: { count: 20 },
  payments: {
    currency: "USD",
    tentPrice: 10,
    whatsapp: "",
    mp: { link: "", alias: "" },
    pagoMovil: { bank: "", rif: "", phone: "" },
    zelle: { email: "", name: "" },
  },
  categories: [],
  tents: [],
  reservations: [],
  logs: [],
};

function makeGrid(count = 20) {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const padX = 0.1,
    padTop = 0.16,
    padBottom = 0.1;
  const usableW = 1 - padX * 2;
  const usableH = 1 - padTop - padBottom;
  return Array.from({ length: count }).map((_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = padX + ((c + 0.5) / cols) * usableW;
    const y = padTop + ((r + 0.5) / rows) * usableH;
    return { id: i + 1, state: "av", x: +x.toFixed(4), y: +y.toFixed(4) };
  });
}

export default async function handler(req, res) {
  try {
    if (req.query.reset === "1") {
      await kv.del(STATE_KEY);
      await kv.del(REV_KEY);
    }

    let state = await kv.get(STATE_KEY);
    if (!state) {
      const seeded = { ...initialData, tents: makeGrid(initialData.layout.count) };
      await kv.set(STATE_KEY, seeded);
      await kv.set(REV_KEY, 1);
      return res.status(200).json({ ok: true, state: seeded, rev: 1 });
    }

    const rev = (await kv.get(REV_KEY)) ?? 1;
    return res.status(200).json({ ok: true, state, rev });
  } catch (e) {
    console.error("boot error", e);
    res.status(500).json({ ok: false, error: String(e) });
  }
}
