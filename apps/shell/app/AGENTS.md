# apps/shell/app — rutas

App Router. Cada carpeta es una ruta; los grupos entre parentesis no aparecen en la URL.

| Ruta | Que es |
|---|---|
| `(modulos)/m/[slug]` | Una pagina de modulo, con sus objetos |
| `(incrustado)/incrustar/m/[slug]` | El mismo modulo para incrustar en otro portal |
| `editor`, `editor/[slug]` | El editor de modulos |
| `admin/*` | Panel de administracion (4.10.8), separado de los modulos de negocio |
| `acceso`, `restablecer` | Autenticacion, sin sesion |
| `api/*` | Route Handlers |
| `health` | Estado del servicio |

## globals.css

Es la hoja de estilo completa, sin modulos CSS ni utilidades. Reglas:

- **Ningun color literal.** Solo `var(--md-sys-color-*)` o `var(--color-*)`. Hay una prueba que
  compara las variables que el CSS lee con las que el tema emite.
- **Las variables que rellena un componente** (`--rejilla-columnas`, `--col-movil`,
  `--color-de-resaltado`, `--multiplos-columnas`) se declaran en la lista de excepciones de esa
  prueba; anadir una sin declararla es una regla que no hace nada.
- **`font:` abreviado** usa `var(--md-sys-typescale-<rol>)`, que el tema emite completo.

## Que NO hacer

- No poner logica de acceso en el componente de pagina sin repetirla en el Route Handler.
- No anadir una media query de tema: el modo de color lo decide `src/server/tema.ts`.
