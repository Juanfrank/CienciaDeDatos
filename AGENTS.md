# Capa de visualizacion institucional — especificacion para agentes

Reporting institucional sobre Azure App Service, en sustitucion de Power BI. Este archivo es
el contrato que debe leer cualquier IA antes de tocar el repositorio. Cada carpeta relevante
tiene su propio `AGENTS.md` con las reglas locales; este fija las que valen en todas.

## Los cuatro principios

1. **El navegador solo habla con esta aplicacion.** Ninguna peticion del cliente sale del
   origen: ni a un CDN, ni a fonts.googleapis.com, ni a la fuente de datos. Hay una prueba de
   navegador que falla si alguna lo hace.
2. **Un modulo nunca consulta la fuente.** Los objetos reciben filas ya leidas del cache y ya
   recortadas por el ambito de quien mira. `IDataConnector.query()` solo lo invoca el job de
   poblacion. Lo garantiza una regla de lint, no la disciplina.
3. **El ambito solo puede restringir.** Cualquier combinacion de capas de acceso resulta mas
   restrictiva o igual, nunca mas permisiva. Ampliar exige marcarlo como excepcion y
   justificarlo por escrito, y queda en auditoria.
4. **La accesibilidad no se pospone.** WCAG 2.1 AA verificado con axe sobre la aplicacion
   real. El color nunca es el unico portador de informacion.

## Reglas que no se negocian

| Regla | Donde vive | Como falla si se rompe |
|---|---|---|
| Un objeto publicado no se modifica: se publica una version nueva | `packages/ui-components/src/registry` | Prueba del catalogo |
| La version de una instancia es exacta, nunca un rango | `ObjectInstance.version` | Tipo |
| El color es siempre un rol del tema, nunca un valor suelto | `packages/design-tokens` | Puerta de contraste |
| El texto visible sale del catalogo, no del componente | `packages/i18n` | Prueba de catalogo y de navegador |
| El estado visible vive en la URL | `apps/shell` | Prueba de navegador |
| El alto de un objeto no depende de su contenido | `globals.css` + rejilla | Prueba de navegador |
| Lo que se corta se cuenta y se dice | validacion y proyeccion | Pruebas unitarias |

## Como se verifica

```bash
npm run verify     # typecheck, lint, pruebas unitarias, limites, esquema y navegador
```

Mientras se trabaja, lo normal es correr SOLO lo que el cambio toca:

```bash
npm run afectado          # lint y pruebas de los proyectos afectados
npm run verify:afectado   # lo mismo, mas typecheck, navegador y las dos verificaciones globales
```

Por partes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run e2e`,
`npm run verify:boundaries`, `npm run verify:schema`, `npm run verify:infra` (necesita Bicep).

`affected` elige los PROYECTOS por los archivos que cambiaron; lo que decide si la tarea se
ejecuta o sale de cache son los `inputs` de `nx.json`. El input `pruebas` excluye los `.md`, asi
que tocar una especificacion marca el proyecto como afectado y la tarea acierta en cache: un
cambio de documentacion no ejecuta ni una prueba.

Ninguna tarea necesita `--skip-nx-cache`: las entradas y salidas de cada target estan
declaradas, y `shell:e2e` construye antes de arrancar.

## Como se corre en local

```bash
nvm use && npm ci
npm run poblar     # puebla .cache con el conector mock
npm run dev        # http://localhost:4300
```

No hace falta Azure, ni SQL Server, ni Docker. Usuarios sembrados:
`u-ana@poderjudicial.gob.do` (colaborador), `u-admin@…` (administrador), `u-beto@…` (visor);
clave `Demostracion-2026!` y TOTP del secreto `JBSWY3DPEHPK3PXP`.

`npm start` si exige `AUTH_PEPPER`: `next build` pone `NODE_ENV=production` y la aplicacion se
niega a arrancar con la pimienta de desarrollo. `npm run e2e` necesita
`npx playwright install --with-deps chromium`.

## Limites de dependencia

Los impone `@nx/enforce-module-boundaries` sobre las etiquetas de cada `project.json`:

```
type:module      -> ui, contract-types, lib, util
type:ui          -> contract-types, util
type:lib         -> contract-types, ui, util
type:util        -> util
type:server      -> server, contract-types, lib, util
type:server-data -> contract-types, util
type:app         -> module, ui, contract-types, lib, util, server
type:job         -> server-data, server, contract-types, lib, util
```

`type:server-data` es el unico que puede tocar la fuente. Un modulo que lo importe es un error
de lint, y `npm run verify:boundaries` comprueba que esa regla sigue mordiendo.

## Estilo

- **Codigo y comentarios en espanol sin acentos.** Las respuestas al equipo, con acentos.
- **Los comentarios explican el codigo, no su historia.** Un bloque de contexto por archivo;
  en linea solo cuando el codigo no se explica solo. No se escribe que habia antes, que fallo
  ni por que se descarto la otra opcion.
- **Las pruebas recorren todos los casos, no una muestra.** Un objeto sin prueba no falla:
  simplemente no tiene prueba.
- **Una sola fuente de verdad.** Dos listas que describen lo mismo acaban discrepando; si no
  se pueden unificar, se comparan en una prueba.

## Que NO hacer

- No anadir peticiones del navegador a terceros, ni fuentes ni iconos externos.
- No llamar a `IDataConnector` desde un modulo, un componente o una ruta de la aplicacion.
- No modificar una version publicada de un objeto visual.
- No escribir colores literales: solo roles del tema. La unica excepcion documentada es el
  blanco de las etiquetas del mapa de arbol.
- No escribir una cadena visible dentro de un componente: va al catalogo de `@app/i18n`.
- No encender la negociacion de idioma por `Accept-Language`: el idioma de la aplicacion es el
  espanol y solo lo cambia una eleccion explicita.
- No desactivar, saltar ni marcar como pendiente una prueba para poner algo en verde.
- No inventar cifras, fechas ni citas en contenido institucional.

## Mapa del repositorio

| Carpeta | Que hay |
|---|---|
| `apps/shell` | La aplicacion Next.js: paginas, editor, panel de administracion, API |
| `apps/cache-populator` | El job que lee la fuente y deja el resultado en el cache |
| `apps/modules` | Modulos de negocio; solo consumen objetos y datos ya leidos |
| `packages/*` | Librerias compartidas, una por responsabilidad |
| `packages/i18n` | Catalogos ICU y traductor. El idioma se elige con la cookie `idioma` |
| `tools` | Scripts de verificacion y utilidades de desarrollo |
| `tools/coherencia` | Las pruebas que comparan los dos lados de un contrato que nadie ata |
| `infra` | Plantillas Bicep |
| `.claude/depgraph.json` | Mapa de imports y definiciones, para consultas estructurales |
