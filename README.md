
# Coral Club — Build seguro (no se pone negro)
- UI y CSS intactos.
- Sin `/api` ni `@vercel/kv`.
- useKV nunca lanza excepciones; si falla KV, la app sigue funcionando localmente.

## Variables
Configura en Vercel:
- VITE_KV_REST_API_URL  (sin slash final)
- VITE_KV_REST_API_TOKEN
- VITE_KV_REST_NAMESPACE (opcional)

## Dev
npm i
npm run dev
