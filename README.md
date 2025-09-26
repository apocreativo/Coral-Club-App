
# Coral Club — Antibomba v2
- UI/CSS intactos. Sin `/api` ni `@vercel/kv`.
- Polyfill `crypto.randomUUID` para WebViews viejos.
- ErrorBoundary que solo aparece si ocurre un error (para evitar “pantalla negra”).

## Env en Vercel
VITE_KV_REST_API_URL= (sin slash final)
VITE_KV_REST_API_TOKEN=
# VITE_KV_REST_NAMESPACE= (opcional)
