import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * Coral Club – MVP Fase 1.6 (9:16)
 *
 * Este archivo implementa la aplicación principal para el MVP de Coral Club.
 * Incluye las funcionalidades descritas en la fase 1.6 como gestión de toldos,
 * extras, reservas, exportación/importación de estado, bloqueos por rango de
 * sombrillas, recargos por fin de semana y anticipos, así como una interfaz
 * administrativa básica. El objetivo es proporcionar una experiencia de
 * reserva sencilla optimizada para formato móvil 9:16.
 */

// ---------- almacenamiento ----------
const STORAGE_KEY = "coralclub_mvp_fase16";

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveState = (s) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* silent */
  }
};

// ---------- utilidades ----------
const money = (n, c = "USD") =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: c }).format(
    Number(n || 0)
  );
const parseTimeToMinutes = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":" ).map(Number);
  return h * 60 + m;
};
const rangesOverlap = (a1, a2, b1, b2) => Math.max(a1, b1) < Math.min(a2, b2);
const isWeekend = (isoDate) => {
  if (!isoDate) return false;
  const d = new Date(isoDate + "T00:00:00");
  const day = d.getDay(); // 0=Sun 6=Sat
  return day === 0 || day === 6;
};

// Genera dos filas equiespaciadas para las sombrillas
function generateUmbrellas(count = 20, keep = []) {
  const n = Math.max(1, Math.min(200, Math.floor(count)));
  const topN = Math.ceil(n / 2);
  const botN = Math.floor(n / 2);
  const spread = (k) => {
    const res = [];
    const L = 8,
      R = 92;
    for (let i = 0; i < k; i++) {
      const t = k === 1 ? 0.5 : i / (k - 1);
      res.push(Math.round(L + t * (R - L)));
    }
    return res;
  };
  const topX = spread(topN);
  const botX = spread(botN);
  const yTop = 35,
    yBot = 56;

  const out = [];
  for (let i = 0; i < topN; i++) {
    const num = i + 1;
    const old = keep.find((u) => u.numero === num);
    out.push({
      numero: num,
      estado: old?.estado || "disponible",
      precio_base: old?.precio_base ?? 12,
      capacidad_incluida: old?.capacidad_incluida ?? 2,
      x: old?.x ?? topX[i],
      y: old?.y ?? yTop,
      notas: old?.notas ?? "",
    });
  }
  for (let j = 0; j < botN; j++) {
    const num = topN + j + 1;
    const old = keep.find((u) => u.numero === num);
    out.push({
      numero: num,
      estado: old?.estado || "disponible",
      precio_base: old?.precio_base ?? 12,
      capacidad_incluida: old?.capacidad_incluida ?? 2,
      x: old?.x ?? botX[j],
      y: old?.y ?? yBot,
      notas: old?.notas ?? "",
    });
  }
  return out;
}

// Placeholder SVG si falla el logo
const FALLBACK_LOGO =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='100%' height='100%' fill='#E8FBFB'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='#0E3A59'>Logo</text></svg>`
  );

// ---------- estado semilla ----------
const seed = {
  brand: {
    nombre: "Coral Club",
    logo: "/Logo.jpg",
    fondos: { inicio: "/Maps.png", mapa: "/Maps.png" },
    colores: { pri: "#20CFCF", sec: "#FF6F61", txt: "#0E3A59", acc: "#F4E8D3" },
  },
  umbrellas: generateUmbrellas(20),
  inventario: { cantidad_toldos: 20 },
  items: [
    {
      id: "silla",
      nombre: "Silla extra",
      categoria: "Sillas",
      precio: 3.5,
      stock: 100,
      max_por_reserva: 6,
      activo: true,
    },
    {
      id: "mesa",
      nombre: "Mesa extra",
      categoria: "Mesas",
      precio: 8.0,
      stock: 50,
      max_por_reserva: 2,
      activo: true,
    },
  ],
  parametros: {
    impuesto_pct: 0,
    moneda: "USD",
    whatsapp_contacto: "+58 000-0000000",
    anticipo_pct: 0,
    recargo_finsemana_pct: 0,
  },
  reservas: [],
  bloqueos: [], // {id, fecha, desde, hasta, fromNum, toNum, motivo}
};

// ---------- Componentes de la App ----------
function App() {
  const [state, setState] = useState(() => loadState() || seed);
  const [tab, setTab] = useState("inicio");
  const [dialogUmbrella, setDialogUmbrella] = useState(null);
  const [selectedUmbrella, setSelectedUmbrella] = useState(null);

  // filtros de reserva en plano
  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");

  // carrito (extras del usuario)
  const [cart, setCart] = useState([]); // [{id,nombre,precio,cant,comment}]

  useEffect(() => saveState(state), [state]);

  // tema
  const theme = {
    "--pri": state.brand.colores.pri,
    "--sec": state.brand.colores.sec,
    "--txt": state.brand.colores.txt,
    "--acc": state.brand.colores.acc,
  };

  // Auto-heal inicial: umbrellas y coords válidas
  useEffect(() => {
    setState((s) => {
      let umbrellas = s.umbrellas?.length
        ? s.umbrellas
        : generateUmbrellas(
            Math.max(1, Number(s?.inventario?.cantidad_toldos) || 20)
          );
      umbrellas = umbrellas.map((u) => ({
        ...u,
        x: typeof u.x === "number" && !Number.isNaN(u.x) ? u.x : 50,
        y: typeof u.y === "number" && !Number.isNaN(u.y) ? u.y : 50,
      }));
      return { ...s, umbrellas };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------- carrito ----------
  const getMaxPerReserva = (id, fallback) => {
    const fromState = state.items.find((i) => i.id === id)?.max_por_reserva;
    if (typeof fallback === "number") return fallback;
    if (typeof fromState === "number") return fromState;
    return undefined;
  };

  const setCartComment = (id, comment) =>
    setCart((p) => p.map((c) => (c.id === id ? { ...c, comment } : c)));

  const addToCart = (item, delta) =>
    setCart((p) => {
      const i = p.findIndex((x) => x.id === item.id);
      const limit = getMaxPerReserva(item.id, item.max_por_reserva);
      if (i >= 0) {
        const next = [...p];
        const newQty = Math.max(0, next[i].cant + (delta || 1));
        if (limit && newQty > limit) {
          alert(`Máximo ${limit} por reserva.`);
          return p;
        }
        if (newQty === 0) return next.filter((_, k) => k !== i);
        next[i] = { ...next[i], cant: newQty };
        return next;
      }
      const start = Math.max(0, delta || 1);
      if (limit && start > limit) {
        alert(`Máximo ${limit} por reserva.`);
        return p;
      }
      return [
        ...p,
        {
          id: item.id,
          nombre: item.nombre,
          precio: item.precio,
          cant: start,
          comment: "",
        },
      ];
    });

  const removeFromCart = (id) => setCart((p) => p.filter((c) => c.id !== id));

  const subtotal = useMemo(
    () => cart.reduce((s, it) => s + it.precio * it.cant, 0),
    [cart]
  );
  const impuestos = useMemo(
    () => subtotal * (Number(state.parametros.impuesto_pct) / 100),
    [subtotal, state.parametros.impuesto_pct]
  );
  const total = useMemo(() => subtotal + impuestos, [subtotal, impuestos]);
  const moneda = state.parametros.moneda;

  // limpiar selección al cambiar tab
  useEffect(() => {
    if (tab !== "confirmacion") setSelectedUmbrella(null);
  }, [tab]);

  return (
    <div
      className="w-full min-h-screen flex items-center justify-center"
      style={{ background: "var(--acc)", ...theme }}
    >
      {/* CONTENEDOR 9:16 CENTRADO */}
      <div className="w-full max-w-[480px] aspect-[9/16] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <TopBar brand={state.brand} setTab={setTab} />
        <div className="flex-1 overflow-y-auto">
          {tab === "inicio" && <Inicio brand={state.brand} setTab={setTab} />}

          {tab === "plano" && (
            <Plano
              state={state}
              setState={setState}
              fecha={fecha}
              setFecha={setFecha}
              horaInicio={horaInicio}
              setHoraInicio={setHoraInicio}
              horaFin={horaFin}
              setHoraFin={setHoraFin}
              openDetalle={(u) => {
                setDialogUmbrella(u);
              }}
            />
          )}

          {tab === "items" && (
            <Items
              state={state}
              cart={cart}
              addToCart={addToCart}
              setCartComment={setCartComment}
              removeFromCart={removeFromCart}
            />
          )}

          {tab === "carrito" && (
            <Carrito
              state={state}
              cart={cart}
              addToCart={addToCart}
              setCartComment={setCartComment}
              removeFromCart={removeFromCart}
              subtotal={subtotal}
              impuestos={impuestos}
              total={total}
              goConfirm={() => setTab("confirmacion")}
              goItems={() => setTab("items")}
            />
          )}

          {tab === "confirmacion" && (
            <Confirmacion
              state={state}
              setState={setState}
              cart={cart}
              clearCart={() => setCart([])}
              selectedUmbrella={selectedUmbrella}
              setSelectedUmbrella={setSelectedUmbrella}
              fecha={fecha}
              horaInicio={horaInicio}
              horaFin={horaFin}
              setFecha={setFecha}
              setHoraInicio={setHoraInicio}
              setHoraFin={setHoraFin}
              setTab={setTab}
            />
          )}

          {tab === "reservas" && (
            <MisReservas
              reservas={state.reservas}
              moneda={state.parametros.moneda}
              setState={setState}
            />
          )}

          {tab === "admin" && <Admin state={state} setState={setState} />}
        </div>
        <BottomNav setTab={setTab} />
      </div>

      {dialogUmbrella && (
        <Modal onClose={() => setDialogUmbrella(null)}>
          <DetalleSombrilla
            u={dialogUmbrella}
            fecha={fecha}
            horaInicio={horaInicio}
            horaFin={horaFin}
            onDone={(u) => {
              setSelectedUmbrella(u);
              setDialogUmbrella(null);
              setTab("confirmacion");
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ---------- UI ----------
function ImgFallback({ src, alt, className }) {
  const [err, setErr] = useState(false);
  return (
    <img
      src={err ? FALLBACK_LOGO : src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
      referrerPolicy="no-referrer"
    />
  );
}

function TopBar({ brand, setTab }) {
  return (
    <div
      className="h-14 flex items-center justify-between px-3"
      style={{ borderBottom: "1px solid #eee", background: "rgba(255,255,255,.8)" }}
    >
      <div
        className="flex items-center gap-2"
        style={{ cursor: "pointer" }}
        onClick={() => setTab("inicio")}
      >
        <ImgFallback
          src={brand.logo}
          alt="logo"
          className="w-8 h-8 rounded-full object-cover"
        />
        <span className="font-semibold" style={{ color: "var(--txt)" }}>
          {brand.nombre}
        </span>
        <span
          className="ml-2 text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,0,0,.05)" }}
        >
          v1.6
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="px-3 py-1.5 rounded-lg text-white text-sm"
          style={{ background: "var(--pri)" }}
          onClick={() => setTab("admin")}
        >
          Admin
        </button>
        <button
          className="px-3 py-1.5 rounded-lg text-white text-sm"
          style={{ background: "var(--sec)" }}
          onClick={() => setTab("carrito")}
        >
          🧺
        </button>
      </div>
    </div>
  );
}

function BottomNav({ setTab }) {
  const Btn = ({ label, tab }) => (
    <button
      className="flex flex-col items-center text-xs"
      onClick={() => setTab(tab)}
    >
      <div className="w-9 h-9 grid place-items-center">
        {label === "Sombrillas"
          ? "⛱️"
          : label === "Extras"
          ? "➕"
          : label === "Reservas"
          ? "📅"
          : "🏠"}
      </div>
      <span>{label}</span>
    </button>
  );
  return (
    <div
      className="h-16"
      style={{
        borderTop: "1px solid #eee",
        background: "rgba(255,255,255,.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
      }}
    >
      <Btn label="Inicio" tab="inicio" />
      <Btn label="Sombrillas" tab="plano" />
      <Btn label="Extras" tab="items" />
      <Btn label="Reservas" tab="reservas" />
    </div>
  );
}

/** INICIO con fondo controlado dentro del 9:16 */
function Inicio({ brand, setTab }) {
  return (
    <div className="relative p-4 h-full">
      {/* Fondo suave, contenido encima */}
      <div
        className="absolute inset-0 -z-10 opacity-30 bg-cover bg-center"
        style={{ backgroundImage: `url(${brand.fondos.inicio})` }}
      />
      <div className="flex flex-col items-center gap-3 pt-8 text-center">
        <ImgFallback
          src={brand.logo}
          alt="logo"
          className="w-24 h-24 rounded-full shadow object-cover"
        />
        <h1 className="text-2xl font-bold" style={{ color: "var(--txt)" }}>
          {brand.nombre}
        </h1>
        <p className="text-sm" style={{ color: "rgba(14,58,89,.8)" }}>
          Reserva tu toldo, sillas y mesas
        </p>
        <div className="grid gap-3 w-full mt-4">
          <button
            className="h-12 rounded-xl text-white"
            style={{ background: "var(--pri)" }}
            onClick={() => setTab("plano")}
          >
            Reservar sombrilla
          </button>
          <button
            className="h-12 rounded-xl text-white"
            style={{ background: "var(--sec)" }}
            onClick={() => setTab("items")}
          >
            Ver extras
          </button>
        </div>
      </div>
    </div>
  );
}

function Plano({
  state,
  setState,
  fecha,
  setFecha,
  horaInicio,
  setHoraInicio,
  horaFin,
  setHoraFin,
  openDetalle,
}) {
  const bgUrl = state.brand?.fondos?.mapa || "";
  const [filtro, setFiltro] = useState("todas");

  const bloqueoAct = (num, f, S, E) => {
    if (!f || !(S >= 0) || !(E > 0)) return false;
    return state.bloqueos.some((b) => {
      if (b.fecha !== f) return false;
      if (!(num >= b.fromNum && num <= b.toNum)) return false;
      return rangesOverlap(
        S,
        E,
        parseTimeToMinutes(b.desde),
        parseTimeToMinutes(b.hasta)
      );
    });
  };

  const ocupadaEnRango = (num) => {
    if (!fecha || !horaInicio || !horaFin) return false;
    const S = parseTimeToMinutes(horaInicio);
    const E = parseTimeToMinutes(horaFin);
    const reserved = state.reservas.some(
      (r) =>
        r.sombrilla === num &&
        r.fecha === fecha &&
        r.estado !== "cancelada" &&
        rangesOverlap(
          S,
          E,
          parseTimeToMinutes(r.horaInicio),
          parseTimeToMinutes(r.horaFin)
        )
    );
    if (reserved) return true;
    return bloqueoAct(num, fecha, S, E);
  };

  const handleMapClick = (e) => {
    if (!bgUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const numero = Number(prompt("Asignar coordenadas a sombrilla # (1..N)", "1"));
    if (!numero || Number.isNaN(numero)) return;
    setState((s) => ({
      ...s,
      umbrellas: s.umbrellas.map((u) =>
        u.numero === numero
          ? {
              ...u,
              x: Math.round(x * 100) / 100,
              y: Math.round(y * 100) / 100,
            }
          : u
      ),
    }));
  };

  const filtered = state.umbrellas.filter((u) => {
    if (filtro === "libres") {
      const S = parseTimeToMinutes(horaInicio || "00:00");
      const E = parseTimeToMinutes(horaFin || "23:59");
      const busy =
        (fecha && horaInicio && horaFin && ocupadaEnRango(u.numero)) ||
        u.estado !== "disponible";
      const blocked = bloqueoAct(u.numero, fecha, S, E);
      return !busy && !blocked;
    }
    return true;
  });

  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-3">Plano de playa</h2>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <div>
          <label className="text-xs">Fecha</label>
          <input
            type="date"
            className="w-full h-9"
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0 8px" }}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs">Desde</label>
          <input
            type="time"
            className="w-full h-9"
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0 8px" }}
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs">Hasta</label>
          <input
            type="time"
            className="w-full h-9"
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0 8px" }}
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs" style={{ color: "#666" }}>
          {bgUrl ? (
            <>
              Haz <b>clic</b> sobre el mapa para asignar coordenadas a un número.
            </>
          ) : (
            <>
              Define una <b>URL de mapa</b> en Admin → Inventario &amp; Mapa.
            </>
          )}
        </div>
        <select
          className="text-xs h-8"
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0 8px" }}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="todas">Ver todas</option>
          <option value="libres">Solo libres</option>
        </select>
      </div>

      <div
        className="relative rounded-2xl overflow-hidden grid place-items-center"
        style={{
          border: "1px solid #eee",
          aspectRatio: "9/13",
          backgroundImage: bgUrl ? `url(${bgUrl})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          cursor: "crosshair",
        }}
        onClick={handleMapClick}
      >
        {!bgUrl && (
          <div
            className="text-xs"
            style={{ color: "#777", padding: 12, textAlign: "center" }}
          >
            Sin imagen. Pega una URL de mapa en Admin.
          </div>
        )}

        {filtered.map((u) => {
          const S = parseTimeToMinutes(horaInicio || "00:00");
          const E = parseTimeToMinutes(horaFin || "23:59");
          const occ =
            (fecha && horaInicio && horaFin &&
              state.reservas.some(
                (r) =>
                  r.sombrilla === u.numero &&
                  r.fecha === fecha &&
                  r.estado !== "cancelada" &&
                  rangesOverlap(
                    S,
                    E,
                    parseTimeToMinutes(r.horaInicio),
                    parseTimeToMinutes(r.horaFin)
                  )
              )) ||
            u.estado === "ocupada";
          const blocked = bloqueoAct(u.numero, fecha, S, E) || u.estado === "bloqueada";
          const cls = blocked ? "#9CA3AF" : occ ? "#EF4444" : "#22C55E";
          const left = typeof u.x === "number" ? `${u.x}%` : "50%";
          const top = typeof u.y === "number" ? `${u.y}%` : "50%";
          return (
            <button
              key={u.numero}
              className="absolute w-9 h-9 rounded-full text-white text-xs font-bold"
              style={{
                transform: "translate(-50%, -50%)",
                left,
                top,
                background: cls,
                border: "1px solid rgba(0,0,0,.2)",
                zIndex: 10,
              }}
              onClick={(ev) => {
                ev.stopPropagation();
                openDetalle(u);
              }}
              title={`Sombrilla #${u.numero}`}
            >
              {u.numero}
            </button>
          );
        })}
      </div>

      {/* Leyenda */}
      <div
        className="flex items-center justify-between mt-2"
        style={{ fontSize: 11, color: "#666" }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 9999,
                background: "#22C55E",
                border: "1px solid #0001",
              }}
            />
            Libre
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 9999,
                background: "#EF4444",
                border: "1px solid #0001",
              }}
            />
            Ocupada
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 9999,
                background: "#9CA3AF",
                border: "1px solid #0001",
              }}
            />
            Bloqueada
          </span>
        </div>
        <span>Haz clic para asignar X/Y</span>
      </div>
    </div>
  );
}

function Items({ state, cart, addToCart, setCartComment, removeFromCart }) {
  const activos = state.items.filter((i) => i.activo);
  const qty = (id) => cart.find((c) => c.id === id)?.cant || 0;
  const comment = (id) => cart.find((c) => c.id === id)?.comment || "";

  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-3">Extras</h2>
      <div className="flex flex-col gap-2">
        {activos.map((it) => (
          <div
            key={it.id}
            className="border rounded-xl p-2"
            style={{ borderColor: "#eee" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{it.nombre}</div>
                <div className="text-xs" style={{ color: "#777" }}>
                  {it.categoria || "Otros"} · {money(it.precio, state.parametros.moneda)}
                  {typeof it.stock === "number" ? ` · Stock: ${it.stock}` : ""}
                  {typeof it.max_por_reserva === "number"
                    ? ` · Máx/res: ${it.max_por_reserva}`
                    : ""}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-lg"
                  style={{ border: "1px solid #ddd" }}
                  onClick={() => addToCart(it, -1)}
                >
                  -
                </button>
                <span className="w-6 text-center">{qty(it.id)}</span>
                <button
                  className="px-3 py-1 rounded-lg text-white"
                  style={{ background: "var(--pri)" }}
                  onClick={() => addToCart(it, +1)}
                >
                  +
                </button>
              </div>
            </div>
            {qty(it.id) > 0 && (
              <>
                <input
                  className="w-full h-9 rounded-lg text-sm mt-2"
                  style={{ border: "1px solid #ddd", padding: "0 8px" }}
                  placeholder="Comentarios para este ítem…"
                  value={comment(it.id)}
                  onChange={(e) => setCartComment(it.id, e.target.value)}
                />
                <div className="text-right mt-1">
                  <button
                    className="text-xs"
                    style={{ color: "#dc2626", textDecoration: "underline" }}
                    onClick={() => removeFromCart(it.id)}
                  >
                    Quitar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------- Carrito --------------
function Carrito({
  state,
  cart,
  addToCart,
  setCartComment,
  removeFromCart,
  subtotal,
  impuestos,
  total,
  goConfirm,
  goItems,
}) {
  const moneda = state.parametros.moneda;
  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-3">Carrito</h2>
      {cart.length === 0 ? (
        <p className="text-sm" style={{ color: "#666" }}>
          Tu carrito está vacío. Añade extras desde la sección "Extras".
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cart.map((c) => (
            <div key={c.id} className="border rounded-xl p-2" style={{ borderColor: "#eee" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.nombre}</div>
                  <div className="text-xs" style={{ color: "#777" }}>
                    {money(c.precio, moneda)} × {c.cant} = {money(c.precio * c.cant, moneda)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-1 rounded-lg"
                    style={{ border: "1px solid #ddd" }}
                    onClick={() => addToCart({ id: c.id, nombre: c.nombre, precio: c.precio }, -1)}
                  >
                    -
                  </button>
                  <span className="w-6 text-center">{c.cant}</span>
                  <button
                    className="px-3 py-1 rounded-lg text-white"
                    style={{ background: "var(--pri)" }}
                    onClick={() => addToCart({ id: c.id, nombre: c.nombre, precio: c.precio }, +1)}
                  >
                    +
                  </button>
                </div>
              </div>
              {c.comment && (
                <div className="mt-1 text-xs" style={{ color: "#555" }}>
                  Nota: {c.comment}
                </div>
              )}
              <div className="text-right mt-1">
                <button
                  className="text-xs"
                  style={{ color: "#dc2626", textDecoration: "underline" }}
                  onClick={() => removeFromCart(c.id)}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 border-t pt-2" style={{ borderColor: "#eee" }}>
        <div className="flex justify-between text-sm mb-1">
          <span>Subtotal</span>
          <span>{money(subtotal, moneda)}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span>Impuestos</span>
          <span>{money(impuestos, moneda)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{money(total, moneda)}</span>
        </div>
      </div>
      <div className="grid gap-3 mt-4">
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "var(--pri)" }}
          onClick={goItems}
        >
          Seguir comprando
        </button>
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "var(--sec)" }}
          disabled={cart.length === 0}
          onClick={goConfirm}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// -------------- Modal --------------
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 w-full max-w-md relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-2 right-3 text-xl"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

// -------------- DetalleSombrilla --------------
function DetalleSombrilla({ u, fecha, horaInicio, horaFin, onDone }) {
  const faltaHora = !fecha || !horaInicio || !horaFin;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">Sombrilla #{u.numero}</h3>
      <p className="text-sm">Capacidad incluida: {u.capacidad_incluida} personas</p>
      <p className="text-sm">Precio base: {money(u.precio_base)}</p>
      {u.notas && <p className="text-xs" style={{ color: "#555" }}>{u.notas}</p>}
      <div className="text-sm">
        <div>Fecha: {fecha || <span className="text-red-500">selecciona</span>}</div>
        <div>
          Horario: {horaInicio || "--:--"} – {horaFin || "--:--"}
        </div>
      </div>
      {faltaHora && (
        <p className="text-xs text-red-500">
          Debes seleccionar fecha y rango horario en el plano para continuar.
        </p>
      )}
      <button
        className="h-10 rounded-xl text-white mt-2"
        style={{ background: faltaHora ? "#ccc" : "var(--pri)" }}
        disabled={faltaHora}
        onClick={() => onDone(u)}
      >
        Seleccionar sombrilla
      </button>
    </div>
  );
}

// -------------- Confirmacion --------------
function Confirmacion({
  state,
  setState,
  cart,
  clearCart,
  selectedUmbrella,
  setSelectedUmbrella,
  fecha,
  horaInicio,
  horaFin,
  setFecha,
  setHoraInicio,
  setHoraFin,
  setTab,
}) {
  const [copied, setCopied] = useState(false);
  if (!selectedUmbrella) {
    return (
      <div className="p-4 flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Confirmación</h2>
        <p className="text-sm">Selecciona primero una sombrilla en el plano.</p>
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "var(--pri)" }}
          onClick={() => setTab("plano")}
        >
          Ir al plano
        </button>
      </div>
    );
  }
  const u = selectedUmbrella;
  const basePrice = u.precio_base || 0;
  const extrasPrice = cart.reduce((s, it) => s + it.precio * it.cant, 0);
  const subtotal = basePrice + extrasPrice;
  const taxPct = Number(state.parametros.impuesto_pct) || 0;
  const tax = subtotal * (taxPct / 100);
  const weekendPct = isWeekend(fecha) ? Number(state.parametros.recargo_finsemana_pct) || 0 : 0;
  const recargo = subtotal * (weekendPct / 100);
  const total = subtotal + tax + recargo;
  const anticipoPct = Number(state.parametros.anticipo_pct) || 0;
  const anticipo = total * (anticipoPct / 100);
  const restante = total - anticipo;
  const moneda = state.parametros.moneda;

  const summaryText = () => {
    let text = `Reserva Coral Club\n`;
    text += `Sombrilla #${u.numero}\n`;
    text += `Fecha: ${fecha} Horario: ${horaInicio}-${horaFin}\n`;
    if (cart.length > 0) {
      text += `Extras:\n`;
      cart.forEach((it) => {
        text += `- ${it.nombre} × ${it.cant}`;
        if (it.comment) text += ` (${it.comment})`;
        text += "\n";
      });
    }
    text += `Subtotal: ${money(subtotal, moneda)}\n`;
    if (tax) text += `Impuestos: ${money(tax, moneda)}\n`;
    if (recargo) text += `Recargo fin de semana: ${money(recargo, moneda)}\n`;
    text += `Total: ${money(total, moneda)}\n`;
    if (anticipo) text += `Anticipo (${anticipoPct}%): ${money(anticipo, moneda)}\n`;
    text += `A pagar restante: ${money(restante, moneda)}`;
    return text;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("No se pudo copiar al portapapeles");
    }
  };

  const handleWhatsApp = () => {
    const num = (state.parametros.whatsapp_contacto || "").replace(/[^0-9+]/g, "");
    const url = `https://wa.me/${encodeURIComponent(num)}?text=${encodeURIComponent(
      summaryText()
    )}`;
    window.open(url, "_blank");
  };

  const handleConfirm = () => {
    // crear reserva
    setState((prev) => {
      const id = Date.now().toString();
      const newReserva = {
        id,
        sombrilla: u.numero,
        fecha,
        horaInicio,
        horaFin,
        items: cart.map((c) => ({ ...c })),
        subtotal,
        impuestos: tax,
        recargo,
        total,
        anticipo,
        estado: "activa",
        estado_pago: anticipo ? "anticipo" : "pendiente",
        creadoEn: new Date().toISOString(),
      };
      // descontar stock de items
      const updatedItems = prev.items.map((it) => {
        const cc = cart.find((c) => c.id === it.id);
        if (cc && typeof it.stock === "number") {
          return { ...it, stock: it.stock - cc.cant };
        }
        return it;
      });
      return {
        ...prev,
        reservas: [...prev.reservas, newReserva],
        items: updatedItems,
      };
    });
    // reset filtros y carrito
    clearCart();
    setSelectedUmbrella(null);
    setFecha("");
    setHoraInicio("");
    setHoraFin("");
    setTab("reservas");
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h2 className="font-semibold text-lg">Confirmación de reserva</h2>
      <div className="border rounded-lg p-3" style={{ borderColor: "#eee" }}>
        <div className="text-sm">
          <div className="font-medium mb-1">Sombrilla #{u.numero}</div>
          <div>
            Fecha: {fecha} · {horaInicio}-{horaFin}
          </div>
        </div>
        <div className="mt-2 text-sm">
          <div>Precio base: {money(basePrice, moneda)}</div>
          <div>Extras: {money(extrasPrice, moneda)}</div>
          <div>Subtotal: {money(subtotal, moneda)}</div>
          {tax > 0 && <div>Impuestos: {money(tax, moneda)}</div>}
          {recargo > 0 && <div>Recargo fin de semana: {money(recargo, moneda)}</div>}
          <div className="font-semibold">Total: {money(total, moneda)}</div>
          {anticipo > 0 && (
            <div>
              Anticipo ({anticipoPct}%): {money(anticipo, moneda)} – Restante:
              {" "}
              {money(restante, moneda)}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="mt-2 text-sm">
            <div className="font-medium mb-1">Extras:</div>
            <ul className="list-disc list-inside text-xs" style={{ color: "#555" }}>
              {cart.map((c) => (
                <li key={c.id}>
                  {c.nombre} × {c.cant}
                  {c.comment ? ` (${c.comment})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="grid gap-2">
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "var(--pri)" }}
          onClick={handleConfirm}
        >
          Confirmar y guardar
        </button>
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "var(--sec)" }}
          onClick={handleCopy}
        >
          {copied ? "¡Copiado!" : "Copiar resumen"}
        </button>
        <button
          className="h-10 rounded-xl text-white"
          style={{ background: "#25D366" }}
          onClick={handleWhatsApp}
        >
          Enviar por WhatsApp
        </button>
      </div>
    </div>
  );
}

// -------------- MisReservas --------------
function MisReservas({ reservas, moneda, setState }) {
  const cancelar = (id) => {
    setState((prev) => {
      const res = prev.reservas.find((r) => r.id === id);
      if (!res || res.estado === "cancelada") return prev;
      // reponer stock de extras
      const updatedItems = prev.items.map((it) => {
        const c = res.items.find((ci) => ci.id === it.id);
        if (c && typeof it.stock === "number") {
          return { ...it, stock: it.stock + c.cant };
        }
        return it;
      });
      const newReservas = prev.reservas.map((r) =>
        r.id === id ? { ...r, estado: "cancelada" } : r
      );
      return { ...prev, reservas: newReservas, items: updatedItems };
    });
  };
  const togglePago = (id) => {
    setState((prev) => {
      const newReservas = prev.reservas.map((r) => {
        if (r.id !== id) return r;
        const nextEstado =
          r.estado_pago === "pagado" ? "pendiente" : "pagado";
        return { ...r, estado_pago: nextEstado };
      });
      return { ...prev, reservas: newReservas };
    });
  };
  return (
    <div className="p-4">
      <h2 className="font-semibold text-lg mb-3">Mis Reservas</h2>
      {reservas.length === 0 ? (
        <p className="text-sm" style={{ color: "#666" }}>
          No tienes reservas aún.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reservas
            .slice()
            .reverse()
            .map((r) => (
              <div
                key={r.id}
                className="border rounded-xl p-3"
                style={{ borderColor: "#eee", opacity: r.estado === "cancelada" ? 0.6 : 1 }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-sm">
                      Sombrilla #{r.sombrilla}
                    </div>
                    <div className="text-xs" style={{ color: "#555" }}>
                      {r.fecha} · {r.horaInicio}-{r.horaFin}
                    </div>
                    <div className="text-xs" style={{ color: "#555" }}>
                      Total: {money(r.total, moneda)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <span
                      style={{
                        color:
                          r.estado === "cancelada"
                            ? "#9CA3AF"
                            : r.estado_pago === "pagado"
                            ? "#16A34A"
                            : r.estado_pago === "anticipo"
                            ? "#EA580C"
                            : "#FBBF24",
                      }}
                    >
                      {r.estado === "cancelada"
                        ? "Cancelada"
                        : r.estado_pago === "pagado"
                        ? "Pagado"
                        : r.estado_pago === "anticipo"
                        ? "Anticipado"
                        : "Pendiente"}
                    </span>
                    {r.estado !== "cancelada" && (
                      <>
                        {r.estado_pago !== "pagado" && (
                          <button
                            className="underline"
                            style={{ color: "var(--pri)" }}
                            onClick={() => togglePago(r.id)}
                          >
                            Marcar pagado
                          </button>
                        )}
                        <button
                          className="underline"
                          style={{ color: "#dc2626" }}
                          onClick={() => cancelar(r.id)}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {r.items && r.items.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-xs" style={{ color: "#555" }}>
                    {r.items.map((it) => (
                      <li key={it.id}>
                        {it.nombre} × {it.cant}
                        {it.comment ? ` (${it.comment})` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// -------------- Admin --------------
function Admin({ state, setState }) {
  // Estados locales para formularios de bloqueo
  const [blockDate, setBlockDate] = useState("");
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockNumFrom, setBlockNumFrom] = useState(1);
  const [blockNumTo, setBlockNumTo] = useState(1);
  const [blockMotivo, setBlockMotivo] = useState("");
  const [exportJson, setExportJson] = useState("");

  const updateParam = (key, value) => {
    setState((prev) => ({
      ...prev,
      parametros: { ...prev.parametros, [key]: value },
    }));
  };

  const updateUmbrellaCount = (n) => {
    const count = Math.max(1, Math.floor(Number(n) || 0));
    setState((prev) => ({
      ...prev,
      umbrellas: generateUmbrellas(count, prev.umbrellas),
      inventario: { ...prev.inventario, cantidad_toldos: count },
    }));
  };

  const updateMapUrl = (tipo, value) => {
    setState((prev) => ({
      ...prev,
      brand: {
        ...prev.brand,
        fondos: { ...prev.brand.fondos, [tipo]: value },
      },
    }));
  };

  const updateItemField = (id, field, value) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((it) => {
        if (it.id !== id) return it;
        if (field === "precio" || field === "stock" || field === "max_por_reserva") {
          return { ...it, [field]: value === "" ? undefined : Number(value) };
        }
        if (field === "activo") {
          return { ...it, [field]: Boolean(value) };
        }
        return { ...it, [field]: value };
      }),
    }));
  };

  const addBlock = () => {
    if (!blockDate || !blockFrom || !blockTo || !blockNumFrom || !blockNumTo) {
      alert("Completa todos los campos de bloqueo");
      return;
    }
    if (parseTimeToMinutes(blockFrom) >= parseTimeToMinutes(blockTo)) {
      alert("El horario de bloqueo no es válido");
      return;
    }
    const id = Date.now().toString();
    setState((prev) => ({
      ...prev,
      bloqueos: [
        ...prev.bloqueos,
        {
          id,
          fecha: blockDate,
          desde: blockFrom,
          hasta: blockTo,
          fromNum: Math.min(Number(blockNumFrom), Number(blockNumTo)),
          toNum: Math.max(Number(blockNumFrom), Number(blockNumTo)),
          motivo: blockMotivo,
        },
      ],
    }));
    // reset formulario
    setBlockDate("");
    setBlockFrom("");
    setBlockTo("");
    setBlockNumFrom(1);
    setBlockNumTo(1);
    setBlockMotivo("");
  };

  const removeBlock = (id) => {
    setState((prev) => ({
      ...prev,
      bloqueos: prev.bloqueos.filter((b) => b.id !== id),
    }));
  };

  const handleExportState = () => {
    setExportJson(JSON.stringify(state, null, 2));
  };
  const handleImportState = () => {
    try {
      const obj = JSON.parse(exportJson);
      setState(obj);
      alert("Estado importado correctamente");
    } catch (e) {
      alert("JSON no válido");
    }
  };
  const handleExportCSV = () => {
    const headers = [
      "id",
      "sombrilla",
      "fecha",
      "horaInicio",
      "horaFin",
      "items",
      "subtotal",
      "impuestos",
      "recargo",
      "total",
      "anticipo",
      "estado",
      "estado_pago",
    ];
    const rows = [headers.join(",")];
    state.reservas.forEach((r) => {
      const itemsStr = r.items
        .map((i) => `${i.nombre}:${i.cant}`)
        .join("|");
      rows.push([
        r.id,
        r.sombrilla,
        r.fecha,
        r.horaInicio,
        r.horaFin,
        itemsStr,
        r.subtotal,
        r.impuestos,
        r.recargo,
        r.total,
        r.anticipo,
        r.estado,
        r.estado_pago,
      ].join(","));
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reservas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 overflow-y-auto">
      <h2 className="font-semibold text-lg mb-3">Administración</h2>
      {/* Inventario & mapa */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Inventario &amp; Mapa</h3>
        <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
          <label className="flex flex-col">
            Cantidad de toldos
            <input
              type="number"
              min={1}
              value={state.inventario.cantidad_toldos || 1}
              onChange={(e) => updateUmbrellaCount(e.target.value)}
              className="h-8 rounded-lg border px-2"
            />
          </label>
          <label className="flex flex-col">
            URL del mapa
            <input
              type="text"
              value={state.brand.fondos.mapa || ""}
              onChange={(e) => updateMapUrl("mapa", e.target.value)}
              className="h-8 rounded-lg border px-2"
              placeholder="https://..."
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col">
            Fondo de inicio
            <input
              type="text"
              value={state.brand.fondos.inicio || ""}
              onChange={(e) => updateMapUrl("inicio", e.target.value)}
              className="h-8 rounded-lg border px-2"
              placeholder="https://..."
            />
          </label>
          <button
            className="mt-6 h-8 rounded-lg text-white"
            style={{ background: "var(--pri)" }}
            onClick={() => updateUmbrellaCount(state.inventario.cantidad_toldos)}
          >
            Recolocar toldos
          </button>
        </div>
      </div>
      {/* Parámetros */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Parámetros</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col">
            Impuesto (%)
            <input
              type="number"
              value={state.parametros.impuesto_pct}
              onChange={(e) => updateParam("impuesto_pct", Number(e.target.value))}
              className="h-8 rounded-lg border px-2"
            />
          </label>
          <label className="flex flex-col">
            Moneda (ISO)
            <input
              type="text"
              value={state.parametros.moneda}
              onChange={(e) => updateParam("moneda", e.target.value.toUpperCase())}
              className="h-8 rounded-lg border px-2"
            />
          </label>
          <label className="flex flex-col">
            Anticipo (%)
            <input
              type="number"
              value={state.parametros.anticipo_pct}
              onChange={(e) => updateParam("anticipo_pct", Number(e.target.value))}
              className="h-8 rounded-lg border px-2"
            />
          </label>
          <label className="flex flex-col">
            Recargo fin de semana (%)
            <input
              type="number"
              value={state.parametros.recargo_finsemana_pct}
              onChange={(e) => updateParam("recargo_finsemana_pct", Number(e.target.value))}
              className="h-8 rounded-lg border px-2"
            />
          </label>
          <label className="flex flex-col col-span-2">
            WhatsApp contacto
            <input
              type="text"
              value={state.parametros.whatsapp_contacto}
              onChange={(e) => updateParam("whatsapp_contacto", e.target.value)}
              className="h-8 rounded-lg border px-2"
              placeholder="+580000000000"
            />
          </label>
        </div>
      </div>
      {/* Extras */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Extras</h3>
        <div className="flex flex-col gap-2">
          {state.items.map((it) => (
            <div key={it.id} className="border rounded-lg p-2 text-sm" style={{ borderColor: "#eee" }}>
              <div className="grid grid-cols-6 gap-1 items-center">
                <div className="col-span-2 font-medium">{it.nombre}</div>
                <input
                  type="number"
                  value={it.precio}
                  onChange={(e) => updateItemField(it.id, "precio", e.target.value)}
                  className="h-7 rounded border px-1 text-xs"
                  title="Precio"
                />
                <input
                  type="number"
                  value={typeof it.stock === "number" ? it.stock : ""}
                  onChange={(e) => updateItemField(it.id, "stock", e.target.value)}
                  className="h-7 rounded border px-1 text-xs"
                  title="Stock"
                />
                <input
                  type="number"
                  value={typeof it.max_por_reserva === "number" ? it.max_por_reserva : ""}
                  onChange={(e) => updateItemField(it.id, "max_por_reserva", e.target.value)}
                  className="h-7 rounded border px-1 text-xs"
                  title="Máximo por reserva"
                />
                <label className="flex items-center gap-1 justify-center">
                  <input
                    type="checkbox"
                    checked={it.activo}
                    onChange={(e) => updateItemField(it.id, "activo", e.target.checked)}
                  />
                  Activo
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Bloqueos */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Bloqueos</h3>
        <div className="flex flex-col gap-3">
          {state.bloqueos.length === 0 && (
            <p className="text-sm" style={{ color: "#666" }}>
              No hay bloqueos registrados.
            </p>
          )}
          {state.bloqueos.map((b) => (
            <div
              key={b.id}
              className="border rounded-lg p-2 text-xs flex justify-between items-center"
              style={{ borderColor: "#eee" }}
            >
              <div>
                <div>
                  {b.fecha} · {b.desde}-{b.hasta}
                </div>
                <div>
                  Sombrillas {b.fromNum}–{b.toNum}
                </div>
                {b.motivo && <div>Motivo: {b.motivo}</div>}
              </div>
              <button
                className="text-red-600 text-xs underline"
                onClick={() => removeBlock(b.id)}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <input
            type="date"
            value={blockDate}
            onChange={(e) => setBlockDate(e.target.value)}
            className="h-7 rounded border px-1"
            placeholder="Fecha"
          />
          <input
            type="time"
            value={blockFrom}
            onChange={(e) => setBlockFrom(e.target.value)}
            className="h-7 rounded border px-1"
            placeholder="Desde"
          />
          <input
            type="time"
            value={blockTo}
            onChange={(e) => setBlockTo(e.target.value)}
            className="h-7 rounded border px-1"
            placeholder="Hasta"
          />
          <input
            type="number"
            min={1}
            value={blockNumFrom}
            onChange={(e) => setBlockNumFrom(e.target.value)}
            className="h-7 rounded border px-1"
            placeholder="# desde"
          />
          <input
            type="number"
            min={1}
            value={blockNumTo}
            onChange={(e) => setBlockNumTo(e.target.value)}
            className="h-7 rounded border px-1"
            placeholder="# hasta"
          />
          <input
            type="text"
            value={blockMotivo}
            onChange={(e) => setBlockMotivo(e.target.value)}
            className="h-7 rounded border px-1 col-span-2"
            placeholder="Motivo (opcional)"
          />
          <button
            className="col-span-2 h-8 rounded-lg text-white"
            style={{ background: "var(--pri)" }}
            onClick={addBlock}
          >
            Agregar bloqueo
          </button>
        </div>
      </div>
      {/* Exportar/Importar */}
      <div className="mb-6">
        <h3 className="font-medium mb-2">Exportar / Importar</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            className="h-8 rounded-lg text-white"
            style={{ background: "var(--pri)" }}
            onClick={handleExportState}
          >
            Exportar JSON
          </button>
          <button
            className="h-8 rounded-lg text-white"
            style={{ background: "var(--sec)" }}
            onClick={handleImportState}
          >
            Importar JSON
          </button>
          <button
            className="col-span-2 h-8 rounded-lg text-white"
            style={{ background: "#2563EB" }}
            onClick={handleExportCSV}
          >
            Exportar CSV reservas
          </button>
        </div>
        <textarea
          className="mt-2 w-full h-32 border rounded p-2 text-xs"
          value={exportJson}
          onChange={(e) => setExportJson(e.target.value)}
          placeholder="Aquí aparecerá el JSON exportado. Puedes pegar uno para importar."
        />
      </div>
    </div>
  );
}

function Root() {
  return <App />;
}

createRoot(document.getElementById("root")).render(<Root />);