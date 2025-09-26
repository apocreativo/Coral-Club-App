
# Coral Club — Fresh Build (UI intacta)
- React + Vite. Sin rutas `/api`. Sin `@vercel/kv`.
- Estado compartido vía REST a Vercel KV/Upstash.
- Si faltan envs, funciona local (sin persistir) sin romper UI.
- Incluye: tentPrice, total con tent seleccionado, hold 15m, auto-expire, polling de REV, cache-busting ?v=${rev}.

## Envs en Vercel
VITE_KV_REST_API_URL= (sin slash final)
VITE_KV_REST_API_TOKEN=
VITE_KV_REST_NAMESPACE= (opcional)

## Scripts
npm i
npm run dev
npm run build
