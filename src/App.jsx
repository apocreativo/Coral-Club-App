import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { kvGet, kvSet, kvIncr, kvMerge } from "./useKV";

const STATE_KEY="coralclub:state";
const REV_KEY="coralclub:rev";
const HOLD_MINUTES=15;
const DEFAULT_PIN="1234";

const initialData={
  rev:0,
  brand:{ name:"Coral Club", logoUrl:"/logo.png", logoSize:42 },
  background:{ publicPath:"/Mapa.png" },
  layout:{ count:20 },
  payments:{ currency:"USD", whatsapp:"", tentPrice:10, mp:{}, pagoMovil:{}, zelle:{} },
  categories:[{ id:"servicios", name:"Servicios", items:[{id:"toalla",name:"Toalla extra",price:2,img:"/img/toalla.png"}]}],
  tents:[],
  reservations:[],
  logs:[]
};

const nowISO=()=>new Date().toISOString();
const addMinutesISO=(m)=> new Date(Date.now()+m*60000).toISOString();
function makeGrid(count=20){ const cols=Math.ceil(Math.sqrt(count)); const rows=Math.ceil(count/cols);
  const padX=0.10, padTop=0.16, padBottom=0.10; const usableW=1-padX*2; const usableH=1-padTop-padBottom;
  return Array.from({length:count}).map((_,i)=>{ const r=Math.floor(i/cols); const c=i%cols;
    const x=padX+((c+0.5)/cols)*usableW; const y=padTop+((r+0.5)/rows)*usableH;
    return {id:i+1,state:"av",x:+x.toFixed(4),y:+y.toFixed(4)};
  });
}

export default function App(){
  const [data,setData]=useState(initialData);
  const [rev,setRev]=useState(0);
  const [loaded,setLoaded]=useState(false);
  const [selectedTent,setSelectedTent]=useState(null);
  const [adminOpen,setAdminOpen]=useState(false);
  const [authed,setAuthed]=useState(false);
  const [sheetTab,setSheetTab]=useState("toldo");
  const [cart,setCart]=useState([]);
  const [sessionRevParam,setSessionRevParam]=useState("0");
  const topbarRef=useRef(null);
  const [topInsetPx,setTopInsetPx]=useState(70);

  // compute total: tentPrice once + extras
  const tentPrice = Number(data?.payments?.tentPrice||0);
  const total = useMemo(()=>{
    const extras = cart.reduce((a,b)=> a + (Number(b.price)||0)*(b.qty||0), 0);
    return (selectedTent ? tentPrice : 0) + extras;
  },[cart,selectedTent,tentPrice]);

  // dynamic inset for legend
  useEffect(()=>{
    if(!topbarRef.current) return;
    const el=topbarRef.current;
    const ro=new ResizeObserver((entries)=>{
      for(const entry of entries){
        const h=entry.contentRect.height || el.offsetHeight || 46;
        setTopInsetPx(12+h+12);
      }
    });
    ro.observe(el); return ()=> ro.disconnect();
  },[]);

  // Initial load from KV
  useEffect(()=>{(async()=>{
    try{
      const cur=await kvGet(STATE_KEY);
      if(!cur){
        const seeded={...initialData,tents:makeGrid(initialData.layout.count)};
        await kvSet(STATE_KEY, seeded);
        await kvSet(REV_KEY, 1);
        setData(seeded); setRev(1); setSessionRevParam("1");
      }else{
        setData(cur);
        const r=(await kvGet(REV_KEY)) ?? 1;
        setRev(r); setSessionRevParam(String(r));
      }
      setLoaded(true);
    }catch(e){ console.error(e); setLoaded(true); }
  })()},[]);

  // Polling
  useEffect(()=>{
    const id=setInterval(async()=>{
      try{
        const r=await kvGet(REV_KEY);
        if(typeof r==="number" && r!==rev){
          setRev(r);
          const cur=await kvGet(STATE_KEY);
          if(cur){ setData(cur); setSessionRevParam(String(r)); }
        }
      }catch(e){/* ignore */}
    },1500);
    return ()=> clearInterval(id);
  },[rev]);

  // Expire pending
  useEffect(()=>{
    const id=setInterval(async()=>{
      const now=nowISO();
      const expired=data.reservations.filter(r=> r.status==='pending' && r.expiresAt && r.expiresAt<=now);
      if(expired.length){
        const tentsUpd=data.tents.map(t=> expired.some(r=>r.tentId===t.id) ? {...t,state:'av'} : t);
        const resUpd=data.reservations.map(r=> expired.some(x=>x.id===r.id) ? {...r,status:'expired'} : r);
        const next=await kvMerge(STATE_KEY,{tents:tentsUpd,reservations:resUpd},REV_KEY);
        setData(next); setSessionRevParam(String(next.rev||0));
      }
    }, 10000);
    return ()=> clearInterval(id);
  },[data.reservations,data.tents]);

  // actions
  const onTentClick=(t)=>{ if(t.state!=='av') return; setSelectedTent(s=> s&&s.id===t.id?null:t); };

  const reservar=async()=>{
    if(!selectedTent) return;
    const t=data.tents.find(x=>x.id===selectedTent.id);
    if(!t || t.state!=='av') return;
    const res={ id:crypto.randomUUID(), tentId:t.id, status:'pending', createdAt:nowISO(), expiresAt:addMinutesISO(15), cart };
    const tentsUpd=data.tents.map(x=> x.id===t.id? {...x,state:'pr'} : x);
    const reservationsUpd=[res, ...(data.reservations||[])];
    const next=await kvMerge(STATE_KEY,{tents:tentsUpd,reservations:reservationsUpd},REV_KEY);
    setData(next); setSelectedTent(null);
  };

  const regenGrid=async()=>{
    const tents=makeGrid(data.layout.count||20);
    const next=await kvMerge(STATE_KEY,{tents},REV_KEY);
    setData(next);
  };

  const onChangeBrandName = async (v)=> setData(await kvMerge(STATE_KEY,{ brand:{...data.brand,name:v} },REV_KEY));
  const onChangeLogoUrl  = async (v)=> setData(await kvMerge(STATE_KEY,{ brand:{...data.brand,logoUrl:v} },REV_KEY));
  const onChangeBgPath   = async (v)=> setData(await kvMerge(STATE_KEY,{ background:{...data.background,publicPath:v} },REV_KEY));
  const onChangePayments = async (patch)=> setData(await kvMerge(STATE_KEY,{ payments:{...data.payments,...patch} },REV_KEY));

  const bustLogo=`${data.brand.logoUrl||"/logo.png"}?v=${sessionRevParam}`;
  const bustMap =`${data.background.publicPath||"/Mapa.png"}?v=${sessionRevParam}`;

  return (
    <div className="app-shell">
      <div className="phone">
        <div className="bg" style={{ backgroundImage:`url('${bustMap}')` }} />
        <div className="topbar" ref={topbarRef}>
          <img src={bustLogo} alt="logo" width={data.brand.logoSize} height={data.brand.logoSize}
               onDoubleClick={()=>{setAdminOpen(true); setAuthed(false);}} />
          <div className="brand">{data.brand.name}</div>
          <div className="spacer" />
          <button className="iconbtn" onClick={()=>{setAdminOpen(true); setAuthed(false);}}>⚙️</button>
          <div className="legend" style={{ top:`${topInsetPx}px` }}>
            <div className="row"><span className="dot av" /> Disponible</div>
            <div className="row"><span className="dot pr" /> En proceso</div>
            <div className="row"><span className="dot oc" /> Ocupada</div>
            <div className="row"><span className="dot bl" /> Bloqueada</div>
          </div>
        </div>

        <div className="tents-abs" style={{ inset:`${topInsetPx}px 12px 12px 12px` }}>
          {(data.tents||[]).map(t=>(
            <div key={t.id} className={`tent ${t.state} ${selectedTent?.id===t.id?'selected':''}`}
                 style={{ left:`${t.x*100}%`, top:`${t.y*100}%` }} onClick={()=>onTentClick(t)}>{t.id}</div>
          ))}
        </div>

        <div className="sheet">
          <div className="sheet-header">
            <div className={`tab ${sheetTab==='toldo'?'active':''}`} onClick={()=>setSheetTab('toldo')}>Toldo</div>
            <div className={`tab ${sheetTab==='extras'?'active':''}`} onClick={()=>setSheetTab('extras')}>Extras</div>
            <div className={`tab ${sheetTab==='carrito'?'active':''}`} onClick={()=>setSheetTab('carrito')}>Carrito</div>
          </div>
          <div className="sheet-body">
            {sheetTab==='toldo' && (
              <div className="list">
                <div className="item">
                  <div className="title">Reservar Toldo</div>
                  <div className="hint">Toca un toldo disponible en el mapa y luego “Reservar”.</div>
                  <div style={{ marginTop:8 }}>{selectedTent?<>Seleccionado: <b>#{selectedTent.id}</b></>:<span className="hint">Ningún toldo seleccionado</span>}</div>
                  <div className="row" style={{ marginTop:8, gap:8 }}>
                    <button className="btn" onClick={()=>setSelectedTent(null)}>Quitar selección</button>
                    <button className="btn primary" disabled={!selectedTent} onClick={reservar}>Reservar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="sheet-footer">
            <div className="total">Total: {data.payments.currency} {total.toFixed(2)}</div>
            <button className="btn primary" disabled={!selectedTent} onClick={reservar}>Reservar</button>
          </div>
        </div>

        {adminOpen && (
          <div className="overlay" onClick={(e)=>{if(e.target===e.currentTarget)setAdminOpen(false)}}>
            {!authed ? (
              <div className="modal">
                <div className="title">Ingresar al Administrador</div>
                <div className="row" style={{marginTop:8}}>
                  <input className="input" id="pin" placeholder="PIN" type="password" />
                  <button className="btn primary" onClick={()=>{
                    const v=document.getElementById('pin').value;
                    v===DEFAULT_PIN?setAuthed(true):alert('PIN inválido');
                  }}>Entrar</button>
                </div>
              </div>
            ) : (
              <div className="modal">
                <div className="title">Admin</div>
                <div className="list" style={{marginTop:8}}>
                  <label className="row">
                    <div style={{width:140}}>Nombre marca</div>
                    <input className="input" value={data.brand.name} onChange={(e)=>onChangeBrandName(e.target.value)} />
                  </label>
                  <label className="row">
                    <div style={{width:140}}>Logo URL</div>
                    <input className="input" value={data.brand.logoUrl} onChange={(e)=>onChangeLogoUrl(e.target.value)} />
                  </label>
                  <label className="row">
                    <div style={{width:140}}>Fondo</div>
                    <input className="input" value={data.background.publicPath} onChange={(e)=>onChangeBgPath(e.target.value)} />
                  </label>
                  <label className="row">
                    <div style={{width:140}}>Precio Toldo</div>
                    <input className="input" type="number" value={data.payments.tentPrice||0}
                           onChange={(e)=>onChangePayments({ tentPrice:Number(e.target.value||0) })} />
                  </label>
                </div>
                <div className="row" style={{marginTop:8, gap:8}}>
                  <button className="btn" onClick={()=>setAuthed(false)}>Salir</button>
                  <button className="btn" onClick={()=>setAdminOpen(false)}>Cerrar</button>
                  <button className="btn" onClick={regenGrid}>Regenerar rejilla</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
