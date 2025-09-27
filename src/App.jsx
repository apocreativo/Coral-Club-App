import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { kvGet, kvSet, kvIncr, kvMerge } from "./useKV";

const STATE_KEY = "coralclub:state";
const REV_KEY = "coralclub:rev";
const HOLD_MINUTES = 15;
const DEFAULT_PIN = "1234";

const initialData = {
  rev: 0,
  brand: { name: "Coral Club", logoUrl: "/logo.png", logoSize: 42 },
  background: { publicPath: "/Mapa.png" },
  layout: { count: 20 },
  payments: {
    currency: "USD",
    whatsapp: "",
    tentPrice: 10,
    mp: { link: "", alias: "" },
    pagoMovil: { bank: "", rif: "", phone: "" },
    zelle: { email: "", name: "" },
  },
  categories: [
    { id: "servicios", name: "Servicios", items: [
      { id: "sombrilla", name: "Sombrilla (1 mesa + 2 sillas)", price: 10, img: "/img/sombrilla.png" },
      { id: "toalla", name: "Toalla Extra", price: 2, img: "/img/toalla.png" },
      { id: "hielera", name: "Hielera con Hielo", price: 5, img: "/img/hielera.png" },
    ]},
  ],
  tents: [],
  reservations: [],
  logs: [],
};

const safeUUID = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const rnd = (a) => (a ^ (crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(1))[0] : Math.random()*256) & 15 >> a / 4).toString(16);
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, rnd);
};
const nowISO = () => new Date().toISOString();
const addMinutesISO = (m) => new Date(Date.now() + m*60000).toISOString();

function makeGrid(count = 20){
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const padX = 0.10, padTop = 0.16, padBottom = 0.10;
  const usableW = 1 - padX*2;
  const usableH = 1 - padTop - padBottom;
  return Array.from({ length: count }).map((_, i)=>{
    const r = Math.floor(i/cols);
    const c = i % cols;
    const x = padX + ((c + 0.5) / cols) * usableW;
    const y = padTop + ((r + 0.5) / rows) * usableH;
    return { id: i+1, state:"av", x:+x.toFixed(4), y:+y.toFixed(4) };
  });
}

const throttle = (fn, ms=120)=>{
  let pending=false, lastArgs=null, last=0;
  return (...args)=>{
    lastArgs=args;
    const now=Date.now();
    if(!pending && now-last>ms){
      last=now; pending=true;
      Promise.resolve(fn(...lastArgs)).finally(()=> pending=false);
    }
  };
};

export default function App(){
  const [data, setData] = useState(initialData);
  const [rev, setRev] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [adminTab, setAdminTab] = useState("catalogo");
  const [sheetTab, setSheetTab] = useState("toldo");
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [editingMap, setEditingMap] = useState(false);
  const [selectedTent, setSelectedTent] = useState(null);
  const [dragId, setDragId] = useState(null);

  const [sessionRevParam, setSessionRevParam] = useState("0");
  const topbarRef = useRef(null);
  const [topInsetPx, setTopInsetPx] = useState(70);

  const [payOpen, setPayOpen] = useState(false);
  const [payTab, setPayTab] = useState("mp");
  const [userForm, setUserForm] = useState({ name:'', phoneCountry:'+58', phone:'', email:'' });
  const [myPendingResId, setMyPendingResId] = useState(null);
  const [cart, setCart] = useState([]);

  const tentPrice = Number((data?.payments?.tentPrice) ?? 0) || 0;
  const extrasTotal = useMemo(()=> cart.reduce((acc, it)=> acc + (Number(it.price)||0) * (it.qty||0), 0), [cart]);
  const total = useMemo(()=> (selectedTent ? tentPrice : 0) + extrasTotal, [selectedTent, tentPrice, extrasTotal]);

  const resCode = useMemo(()=>{
    const d = new Date(); const s = d.toISOString().replace(/[-:T.Z]/g,"").slice(2,12);
    return `CC-${selectedTent?.id||"XX"}-${s}`;
  }, [selectedTent]);

  // Safe top inset (no crash on iPad Safari)
  useEffect(()=>{
    const el = topbarRef.current;
    if(!el) return;
    const update = ()=> {
      const h = el?.offsetHeight || 46;
      setTopInsetPx(12 + h + 12);
    };
    update();
    let ro = null;
    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      try {
        ro = new ResizeObserver(()=> update());
        ro.observe(el);
      } catch {
        window.addEventListener("resize", update);
      }
    } else {
      window.addEventListener("resize", update);
    }
    return ()=>{
      if(ro){ try{ ro.disconnect(); }catch{} }
      window.removeEventListener("resize", update);
    };
  }, [topbarRef, data?.brand?.logoSize, data?.brand?.name]);

  // Initial load & seed
  useEffect(()=>{
    (async ()=>{
      try{
        const cur = await kvGet(STATE_KEY);
        if(!cur){
          const seeded = { ...initialData, tents: makeGrid(initialData.layout.count) };
          await kvSet(STATE_KEY, seeded);
          await kvSet(REV_KEY, 1);
          setData(seeded); setRev(1); setSessionRevParam("1");
        } else {
          const withTents = Array.isArray(cur.tents) && cur.tents.length
            ? cur
            : { ...cur, tents: makeGrid(cur?.layout?.count || 20) };
          setData(withTents);
          const r = (await kvGet(REV_KEY)) ?? 1;
          setRev(r); setSessionRevParam(String(r));
        }
      } catch (e) {
        console.warn("KV init fail", e);
        setData(s=> ({ ...s, tents: s.tents?.length ? s.tents : makeGrid(s.layout.count || 20) }));
      } finally { setLoaded(true); }
    })();
  }, []);

  // Poll to achieve multiuser sync
  useEffect(()=>{
    const id = setInterval(async ()=>{
      try{
        const r = await kvGet(REV_KEY);
        if(typeof r === "number" && r !== rev){
          setRev(r); setSessionRevParam(String(r));
          const s = await kvGet(STATE_KEY);
          if(s) setData(s);
        }
      }catch(e){ /* ignore */ }
    }, 1500);
    return ()=> clearInterval(id);
  }, [rev]);

  // Pending expiration
  useEffect(()=>{
    const id = setInterval(async ()=>{
      const now = nowISO();
      const expired = data.reservations.filter(r=> r.status==="pending" && r.expiresAt && r.expiresAt <= now);
      if(expired.length){
        const tentsUpd = data.tents.map(t=> expired.some(r=> r.tentId===t.id) ? { ...t, state:"av" } : t);
        const resUpd = data.reservations.map(r=> expired.some(x=> x.id===r.id) ? { ...r, status:"expired" } : r);
        const next = await kvMerge(STATE_KEY, { tents: tentsUpd, reservations: resUpd }, REV_KEY);
        if(next){ setData(next); setSessionRevParam(String(next.rev||0)); }
      }
    }, 10000);
    return ()=> clearInterval(id);
  }, [data.reservations, data.tents]);

  // Merge helper
  const mergeState = async (patch) => {
    const next = await kvMerge(STATE_KEY, patch, REV_KEY);
    if(next){
      setData(next);
      if(typeof next.rev === "number"){ setRev(next.rev); setSessionRevParam(String(next.rev)); }
    }
  };

  // Tents interactions
  const onTentClick = (t)=>{
    if(editingMap) return;
    if(t.state !== "av"){ alert("Ese toldo no está disponible"); return; }
    setSelectedTent(c => c && c.id===t.id ? null : t);
  };
  const onTentDown = (id)=>{ if(editingMap) setDragId(id); };
  const onMouseMove = throttle((e)=>{
    if(!editingMap || dragId==null) return;
    const el = document.querySelector(".tents-abs"); if(!el) return;
    const rect = el.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;
    x = Math.min(0.98, Math.max(0.02, x));
    y = Math.min(0.98, Math.max(0.02, y));
    const tentsUpd = data.tents.map(t => t.id===dragId ? { ...t, x:+x.toFixed(4), y:+y.toFixed(4) } : t);
    setData(s=> ({ ...s, tents: tentsUpd }));
  }, 80);
  const onMouseUp = async ()=>{
    if(!editingMap || dragId==null) return;
    await mergeState({ tents: data.tents });
    setDragId(null);
  };

  // Cart helpers
  const qtyOf = (id) => (cart.find(x=> x.key===`extra:${id}`)?.qty || 0);
  const addOne = (it)=> setCart(s=>{
    const key = `extra:${it.id}`;
    const ex = s.find(x=> x.key===key);
    if(ex) return s.map(x=> x.key===key ? { ...x, qty:x.qty+1 } : x);
    return [...s, { key, name: it.name, price: it.price, qty: 1 }];
  });
  const removeOne = (it)=> setCart(s=> s.map(x=> x.key===`extra:${it.id}` ? { ...x, qty: Math.max(0, x.qty-1)} : x).filter(x=> x.qty>0));
  const delLine = (k)=> setCart(s=> s.filter(x=> x.key!==k));
  const emptyCart = ()=> setCart([]);

  // Reserva flow
  async function reservar(){
    if(!selectedTent){ alert("Selecciona un toldo primero"); return; }
    const t = data.tents.find(x=> x.id===selectedTent.id);
    if(!t || t.state!=="av"){ alert("Ese toldo ya no está disponible"); return; }
    const reservation = {
      id: safeUUID(),
      tentId: t.id,
      status: "pending",
      createdAt: nowISO(),
      expiresAt: addMinutesISO(HOLD_MINUTES),
      customer: { name: userForm.name||"", phone: userForm.phone||"", email: userForm.email||"" },
      cart
    };
    const tentsUpd = data.tents.map(x=> x.id===t.id ? { ...x, state:"pr" } : x);
    const reservationsUpd = [reservation, ...data.reservations];
    await mergeState({ tents: tentsUpd, reservations: reservationsUpd });
    setMyPendingResId(reservation.id);
    setPayOpen(true);
  }
  async function releaseTent(tentId, resId, toState="av", newStatus="expired"){
    const tentsUpd = data.tents.map(t=> t.id===tentId ? { ...t, state: toState } : t);
    const resUpd = data.reservations.map(r=> r.id===resId ? { ...r, status:newStatus } : r);
    await mergeState({ tents: tentsUpd, reservations: resUpd });
    if(myPendingResId===resId) setMyPendingResId(null);
    if(selectedTent?.id===tentId && toState!=="pr") setSelectedTent(null);
  }
  async function confirmPaid(tentId, resId){
    const tentsUpd = data.tents.map(t=> t.id===tentId ? { ...t, state:"oc" } : t);
    const resUpd = data.reservations.map(r=> r.id===resId ? { ...r, status:"paid" } : r);
    await mergeState({ tents: tentsUpd, reservations: resUpd });
    if(myPendingResId===resId) setMyPendingResId(null);
  }

  // WhatsApp (igual que antes, omitido por brevedad)

  const bustLogo = `${data?.brand?.logoUrl || "/logo.png"}?v=${sessionRevParam}`;
  const bustMap  = `${data?.background?.publicPath || "/Mapa.png"}?v=${sessionRevParam}`;

  return (
    <div className="app-shell" onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
      <div className="phone">
        <div className="bg" style={{ backgroundImage: `url('${bustMap}')` }} />
        <div className="topbar" ref={topbarRef}>
          <img
            src={bustLogo}
            alt="logo"
            width={data?.brand?.logoSize || 42}
            height={data?.brand?.logoSize || 42}
            style={{ objectFit:"contain", borderRadius:12 }}
            onDoubleClick={()=>{ setAdminOpen(true); setAuthed(false); }}
            onError={(e)=>{ e.currentTarget.src="/logo.png"; }}
          />
          <div className="brand">{data?.brand?.name || "Coral Club"}</div>
          <div className="spacer" />
          <div className="legend" style={{ top: `${topInsetPx}px` }}>
            <div style={{ fontWeight:800, marginBottom:4 }}>Estados</div>
            <div className="row"><span className="dot av"></span> Disponible</div>
            <div className="row"><span className="dot pr"></span> En proceso</div>
            <div className="row"><span className="dot oc"></span> Ocupada</div>
            <div className="row"><span className="dot bl"></span> Bloqueada</div>
          </div>
          <button className="iconbtn" title="Admin" onClick={()=>{ setAdminOpen(true); setAuthed(false); }}>⚙️</button>
        </div>

        <div className="tents-abs" style={{ inset: `${topInsetPx}px 12px 12px 12px` }}>
          {(data?.tents || []).map((t)=>(
            <div
              key={t.id}
              className={`tent ${t.state} ${selectedTent?.id===t.id ? "selected" : ""}`}
              style={{ left:`${t.x*100}%`, top:`${t.y*100}%` }}
              title={`Toldo ${t.id}`}
              onMouseDown={()=> onTentDown(t.id)}
              onClick={()=> onTentClick(t)}
            >
              {t.id}
            </div>
          ))}
        </div>

        {!editingMap && (
          <div className={`sheet ${sheetCollapsed ? "collapsed" : ""}`}>
            <div className="sheet-header">
              <div className={`tab ${sheetTab==="toldo"?"active":""}`} onClick={()=> setSheetTab("toldo")}>Toldo</div>
              <div className={`tab ${sheetTab==="extras"?"active":""}`} onClick={()=> setSheetTab("extras")}>Extras</div>
              <div className={`tab ${sheetTab==="carrito"?"active":""}`} onClick={()=> setSheetTab("carrito")}>Carrito</div>
              <div className="spacer"></div>
              <button className="iconbtn" title={sheetCollapsed?"Expandir":"Colapsar"} onClick={()=> setSheetCollapsed(v=>!v)}>{sheetCollapsed ? "▲" : "▼"}</button>
            </div>
            <div className="sheet-body">
              {/* ... mantiene tu UI base para extras/carrito (omitido por brevedad) */}
              <div className="list">
                <div className="item">
                  <div className="title">Reservar Toldo</div>
                  <div className="hint" style={{ marginTop:6 }}>Toca un toldo <b>disponible</b> en el mapa y luego “Reservar”.</div>
                  <div style={{ marginTop:8 }}>{selectedTent ? <>Seleccionado: <b>Toldo {selectedTent.id}</b></> : <span className="hint">Ningún toldo seleccionado</span>}</div>
                </div>
              </div>
            </div>
            <div className="sheet-footer">
              <div className="total">Total: {data?.payments?.currency || "USD"} {total.toFixed(2)}</div>
              <button className="btn primary" disabled={!selectedTent} onClick={reservar}>Reservar</button>
            </div>
          </div>
        )}

        {adminOpen && (
          <div className="overlay" onClick={(e)=>{ if(e.target===e.currentTarget) setAdminOpen(false); }}>
            {!authed ? (
              <div className="modal" onClick={(e)=> e.stopPropagation()}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>Ingresar al Administrador</div>
                  <div className="spacer"></div>
                  <button className="btn" onClick={()=> setAdminOpen(false)}>Cerrar</button>
                </div>
                <div className="row">
                  <input className="input" id="pin" placeholder="PIN" type="password" />
                  <button className="btn primary" onClick={()=>{
                    const v = document.getElementById("pin").value;
                    v === DEFAULT_PIN ? setAuthed(true) : alert("PIN inválido");
                  }}>Entrar</button>
                </div>
                <div className="hint" style={{ marginTop:6 }}>Atajos: Alt/⌥+A • doble clic en el logo.</div>
              </div>
            ) : (
              <div className="modal" onClick={(e)=> e.stopPropagation()}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{ fontWeight:800, fontSize:16 }}>Administrador</div>
                  <div className="spacer"></div>
                  <button className="btn" onClick={()=> setAuthed(false)}>Salir</button>
                  <button className="btn" onClick={()=> setAdminOpen(false)}>Cerrar</button>
                </div>

                <div className="tabs">
                  <div className={`tab-admin ${adminTab==="marca" ? "active":""}`} onClick={()=> setAdminTab("marca")}>Marca & Fondo</div>
                  <div className={`tab-admin ${adminTab==="layout" ? "active":""}`} onClick={()=> setAdminTab("layout")}>Layout</div>
                  <div className={`tab-admin ${adminTab==="pagos" ? "active":""}`} onClick={()=> setAdminTab("pagos")}>Pagos</div>
                </div>

                {adminTab==="marca" && (
                  <div>
                    <div className="grid2">
                      <label><div>Nombre de marca</div>
                        <input className="input" value={data?.brand?.name||""} onChange={(e)=> mergeState({ brand: { ...data.brand, name: e.target.value } })} />
                      </label>
                      <label><div>Tamaño del logo</div>
                        <input className="input" type="number" min={24} max={120} value={data?.brand?.logoSize||42} onChange={(e)=> mergeState({ brand: { ...data.brand, logoSize: Math.max(24, Math.min(120, parseInt(e.target.value||"40"))) } })} />
                      </label>
                    </div>
                    <div className="grid2" style={{ marginTop:8 }}>
                      <label><div>Logo – ruta pública</div>
                        <input className="input" placeholder="/logo.png" value={data?.brand?.logoUrl||""} onChange={(e)=> mergeState({ brand: { ...data.brand, logoUrl: e.target.value } })} />
                      </label>
                      <label><div>Fondo – ruta pública</div>
                        <input className="input" placeholder="/Mapa.png" value={data?.background?.publicPath||""} onChange={(e)=> mergeState({ background: { ...data.background, publicPath: e.target.value } })} />
                      </label>
                    </div>
                  </div>
                )}

                {adminTab==="layout" && (
                  <div>
                    <div className="row" style={{ flexWrap:"wrap", gap:8 }}>
                      <button className="btn" onClick={()=> setEditingMap(v=>!v)}>{editingMap ? "Dejar de editar mapa" : "Editar mapa (drag&drop)"}</button>
                      <button className="btn" onClick={async ()=>{
                        const tents = makeGrid(data?.layout?.count || 20);
                        await mergeState({ tents });
                      }}>Regenerar en rejilla</button>
                      <button className="btn" onClick={async ()=>{
                        const last = (data?.tents||[])[(data?.tents||[]).length-1];
                        const t = { id:(last?.id||0)+1, state:"av", x:0.5, y:0.5 };
                        await mergeState({ tents: [...(data?.tents||[]), t] });
                      }}>+ Agregar Toldo</button>
                    </div>
                    <div className="row" style={{ marginTop:8 }}>
                      <input className="input" type="number" min={1} value={data?.layout?.count||20}
                        onChange={async (e)=>{
                          const cnt = Math.max(1, parseInt(e.target.value||"1"));
                          await mergeState({ layout: { ...(data?.layout||{}), count: cnt } });
                        }} />
                    </div>
                    <div className="hint" style={{ marginTop:6 }}>Al editar, se oculta la hoja inferior para arrastrar hasta abajo del mapa.</div>
                  </div>
                )}

                {adminTab==="pagos" && (
                  <div>
                    <div className="grid2">
                      <label><div>Moneda</div>
                        <input className="input" value={data?.payments?.currency||"USD"} onChange={(e)=> mergeState({ payments: { ...data.payments, currency: e.target.value } })} />
                      </label>
                      <label><div>WhatsApp (Ejem 58412...)</div>
                        <input className="input" value={data?.payments?.whatsapp||""} onChange={(e)=> mergeState({ payments: { ...data.payments, whatsapp: e.target.value } })} />
                      </label>
                    </div>
                    <div className="grid2" style={{ marginTop:8 }}>
                      <label><div>Precio del toldo</div>
                        <input className="input" type="number" min="0" step="0.5"
                          value={data?.payments?.tentPrice ?? 0}
                          onChange={(e)=> mergeState({ payments: { ...data.payments, tentPrice: Number(e.target.value || 0) } })} />
                      </label>
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
