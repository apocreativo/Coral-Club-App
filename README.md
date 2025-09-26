
# Coral Club — Final (con proxy /api/kv)
- UI/CSS intactos (tu golden UI).
- Multiusuario real con Vercel KV vía **proxy serverless** (no se expone el token).
- Cliente llama a `/api/kv/...`; el servidor reenvía a Upstash.

## Variables (en Vercel → Project → Settings → Environment Variables)
KV_REST_API_URL=   # tu REST URL (sin slash final)
KV_REST_API_TOKEN= # tu REST token

## Scripts locales
npm i
npm run dev
npm run build

## Aceptación
- Abre en 2 navegadores → mover/recibir, reservar/confirmar, Admin → Pagos (Precio del toldo).
