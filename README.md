
# Coral Club — Final 100% KV (con proxy /api/kv)
- UI/CSS intactos (tu golden UI).
- Multiusuario real con Vercel KV, sin exponer tokens (proxy serverless).
- Cliente usa `/api/kv/...` → el servidor reenvía a Upstash.

## Variables (en Vercel → Project → Settings → Environment Variables)
KV_REST_API_URL=   # REST URL de Upstash/Vercel KV (sin slash final)
KV_REST_API_TOKEN= # REST Token

## Scripts locales
npm i
npm run dev
npm run build

## Pruebas de aceptación
- Abrir en 2 navegadores (mover toldo, reservar/confirmar/cancelar).
- Admin → Pagos: "Precio del toldo" (autosave).
