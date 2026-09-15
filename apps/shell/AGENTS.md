# apps/shell — la aplicacion

Next.js con App Router. Es lo unico que ve una persona: paginas de modulo, editor, panel de
administracion y la API que los sirve.

## Estructura

| Carpeta | Que hay |
|---|---|
| `app/` | Rutas: paginas, layouts y Route Handlers. `globals.css` es la hoja de estilo entera |
| `src/server/` | Todo lo que corre en el servidor: sesion, datos, gobierno, exportaciones |
| `src/components/` | Los objetos visuales dibujados, el marco de la tarjeta y el editor |
| `src/hooks/` | Hooks de cliente |
| `e2e/` | Pruebas de navegador con Playwright |

## Reglas

- **El estado visible vive en la URL.** Filtros, pagina activa y seleccion van en la query
  string, no en estado local. Un enlace tiene que reproducir lo que se esta viendo.
- **Cada pagina exige su sesion.** Que la cabecera no se dibuje no protege nada; la proteccion
  es de servidor y hay pruebas que piden las rutas a mano sin sesion.
- **El shell no consulta la fuente.** Lee del cache a traves de `src/server/data.ts`.
- **El tema se inyecta en `layout.tsx`** como variables CSS, los dos juegos desde el mismo modo.
  Ningun componente escribe un color literal.

## Como se prueba

```bash
npx nx run shell:test     # unitarias
npx nx run shell:e2e      # navegador (construye antes, no hace falta `next build` a mano)
```

## Que NO hacer

- No guardar estado de vista en `localStorage` ni en un contexto global si deberia estar en la URL.
- No anadir `<link>` ni `<script>` a un dominio externo: rompe el principio 1 y hay prueba.
- No proteger una ruta solo escondiendo el enlace.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
