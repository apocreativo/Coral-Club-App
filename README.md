
# Coral Club — Antibomba v4 (toggle KV)
- UI/CSS intactos. Sin `/api` ni `@vercel/kv`.
- `VITE_DISABLE_KV=1` para forzar modo **local** (descarta todo acceso a KV).
- Console breadcrumbs para ver en qué paso falla si falla.

## Envs
VITE_DISABLE_KV=0   # ó 1 para local
VITE_KV_REST_API_URL=
VITE_KV_REST_API_TOKEN=
# VITE_KV_REST_NAMESPACE=

## Consejo
Si el deploy falla: pon **VITE_DISABLE_KV=1** y redeploy. Confirmas que la UI queda estable.
Luego vuelves a 0 y configuras URL/TOKEN correctos.
