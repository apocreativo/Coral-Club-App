
# Coral Club — Antibomba v3 (con sourcemaps)
- UI/CSS intactos.
- Guards adicionales para propiedades anidadas.
- Build con `sourcemap: true` y `minify: false` → los errores mostrarán líneas reales.

## Pasos
- Sube a GitHub, deploy en Vercel.
- Configura `VITE_KV_REST_API_URL` y `VITE_KV_REST_API_TOKEN` (y opcional `VITE_KV_REST_NAMESPACE`).
- Si hay error, el overlay + sourcemaps te dirán el archivo/línea exacta.
