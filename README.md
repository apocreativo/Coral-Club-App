
# Coral Club (Vite + React) — listo para GitHub
UI/CSS intactos. Sin carpeta `/api`. Sin dependencias de `@vercel/kv`.
Sincronización por REST directo a Vercel KV/Upstash.

## Pasos
1) Sube este repo a GitHub tal cual.
2) En Vercel, crea el proyecto desde ese repo.
3) En Project → Settings → Environment Variables añade:
   - VITE_KV_REST_API_URL
   - VITE_KV_REST_API_TOKEN
4) `npm i && npm run build` (opcional local).

## Dev local
Copia `.env.example` a `.env` con tus credenciales y corre:
```
npm i
npm run dev
```
