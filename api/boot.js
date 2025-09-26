export const config = { runtime: 'nodejs20.x' };
function ctxOr500(res){ const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if(!url || !token){ res.status(500).json({ ok:false, error:"Missing KV_REST_API_URL or KV_REST_API_TOKEN" }); return null; }
  return { url: url.replace(/\/$/, ''), token };
}
const STATE_KEY="coralclub:state", REV_KEY="coralclub:rev";
const initial={ brand:{name:"Coral Club",logoUrl:"/logo.png",logoSize:42}, background:{publicPath:"/Mapa.png"}, layout:{},
  payments:{currency:"USD",tentPrice:0,whatsapp:""}, categories:[], tents:[], reservations:[], logs:[], rev:1 };
export default async function handler(req,res){
  const ctx = ctxOr500(res); if(!ctx) return;
  const head={ headers:{ Authorization:`Bearer ${ctx.token}` } }, headJson={ headers:{ Authorization:`Bearer ${ctx.token}`,"Content-Type":"application/json" } };
  const g = p=>fetch(`${ctx.url}/${p}`, head).then(r=>r.json().catch(()=>null));
  let rev = await g(`get/${encodeURIComponent(REV_KEY)}`); rev = (rev&&rev.result)||0;
  let state = await g(`get/${encodeURIComponent(STATE_KEY)}`); state = state&&state.result;
  if(!state){
    await fetch(`${ctx.url}/set/${encodeURIComponent(STATE_KEY)}`, { method:"POST", ...headJson, body: JSON.stringify({ value: initial }) });
    await fetch(`${ctx.url}/set/${encodeURIComponent(REV_KEY)}`, { method:"POST", ...headJson, body: JSON.stringify({ value: 1 }) });
    state = initial; rev = 1;
  }
  res.status(200).json({ ok:true, state, rev });
}