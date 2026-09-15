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
npm run affected          # lint y pruebas de los proyectos afectados
npm run verify:affected   # lo mismo, mas typecheck, navegador y las dos verificaciones globales
```

Por partes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run e2e`,
`npm run verify:boundaries`, `npm run verify:schema`, `npm run verify:infra` (necesita Bicep).

`affected` elige los PROYECTOS por los archivos que cambiaron; lo que decide si la tarea se
ejecuta o sale de cache son los `inputs` de `nx.json`. El input `pruebas` excluye los `.md`, asi
que tocar una especificacion marca el proyecto como afectado y la tarea acierta en cache: un
cambio de documentacion no ejecuta ni una prueba.

Las pruebas de navegador van en dos targets porque dependen de cosas distintas. `shell:e2e` es
la suite general. `shell:e2e-catalog` son las 58 que comprueban lo MISMO objeto a objeto —que
cada pagina de objetos pasa axe, que pasa el contraste en oscuro, que no desborda en movil, que
cada objeto ofrece en el panel las claves que declara—: el 22% del tiempo de la suite, y no
dependen de nada que se toque a diario. Sus entradas son el repositorio de objetos, los temas y
los modulos, asi que se crea o se edita un objeto y corren enteras; se toca el shell y aciertan
en cache. No se borran: la cobertura objeto a objeto la exigen 4.2 y 4.9.

Dentro de `shell:e2e` hay a su vez dos pases. El paralelo reparte por archivo entre varios
workers, cada uno con su propia pareja de instancias y su propio almacen. El secuencial corre con
un worker las seis suites que tocan la semilla de identidad y gobierno —crean cuentas, bloquean
usuarios, mueven carpetas, amplian ambitos, cambian roles— contra la que el resto inicia sesion.

Ninguna tarea necesita `--skip-nx-cache`: las entradas y salidas de cada target estan
declaradas, y `shell:e2e` construye antes de arrancar.

## Como se corre en local

```bash
nvm use && npm ci
npm run populate     # puebla .cache-datos con el conector mock
npm run dev        # http://localhost:4300
```

En Windows, `nvm use` pide la version: `nvm install 22` y `nvm use 22`. `nvm-windows` no lee
`.nvmrc`, y encadenado con `&&` el fallo se lleva por delante el `npm ci` de al lado — lo que deja
`nx` y `tsx` sin instalar y las ordenes de despues diciendo «no se reconoce como un comando».

No hace falta Azure, ni SQL Server, ni Docker. Usuarios sembrados:
`u-ana@poderjudicial.gob.do` (colaborador), `u-admin@…` (administrador), `u-beto@…` (visor);
clave `Demostracion-2026!` y TOTP del secreto `JBSWY3DPEHPK3PXP`.

`npm start` si exige `AUTH_PEPPER`: `next build` pone `NODE_ENV=production` y la aplicacion se
niega a arrancar con la pimienta de desarrollo. `npm run e2e` necesita
`npx playwright install --with-deps chromium`.

## Antes de buscar: el mapa de dependencias

Para cualquier pregunta **estructural** —donde se define `X`, quien importa `Y`, a que arrastra
tocar este archivo— se consulta `.claude/depgraph.json` en vez de recorrer el repositorio con
`grep`. Es un indice de imports, exports, definiciones y referencias por archivo; el repositorio
pasa de los 350 archivos, y leerlos para responder «donde esta esto» cuesta mucho mas que
preguntarselo al mapa.

Se usa con la habilidad **`depgraph`**, cuyas reglas valen aqui tal cual:

```bash
# Actualizar: solo vuelve a leer los archivos cuyo hash cambio.
python scripts/build_depgraph.py --update --root . --out .claude/depgraph.json

# Consultar en estrecho, nunca volcar el mapa entero.
python scripts/build_depgraph.py --who-imports <modulo> --out .claude/depgraph.json
python scripts/build_depgraph.py --defines <nombre>  --out .claude/depgraph.json
python scripts/build_depgraph.py --file <ruta>       --out .claude/depgraph.json
```

- **Se regenera cuando el arbol se movio**, no en cada turno: `--update` es incremental y barato;
  `--rebuild` solo si el mapa falta o esta corrupto.
- **Se consulta la rebanada que hace falta.** Volcar el mapa entero al contexto cuesta mas que
  leer los archivos, que es justo lo que se venia a evitar.
- **El mapa dice DONDE mirar, no QUE dice el codigo.** Antes de cambiar nada se abre el archivo
  de verdad: el mapa es una pista, no la fuente de verdad.
- **Para uno o dos archivos, se saltan el mapa y se leen.** Se amortiza en preguntas de varios
  archivos, no en una edicion puntual.

Si el mapa esta desfasado y la pregunta no depende de que sea exacto, sale mas barato un `grep`
acotado que bloquear el trabajo regenerandolo.

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

### El codigo en ingles, los comentarios en espanol

**Todo identificador se escribe en ingles. SIEMPRE.** Variables, funciones, metodos, clases,
tipos, propiedades, parametros, constantes, archivos, carpetas, clases CSS, atributos `data-*`,
identificadores de prueba, claves de un objeto que viaja por HTTP y ramas de git.

**Todo comentario se escribe en espanol sin acentos.** El comentario es para quien mantiene esto;
el identificador es para quien lo lee desde fuera. Las respuestas al equipo, con acentos.

```ts
/** Recorta las filas al ambito de quien mira. */
export function applyScope(rows: Row[], scope: AccessScope): Row[] {
```

Lo unico que no se traduce es **el texto que una persona lee en pantalla**, que va en espanol y
sale del catalogo de `@app/i18n`, nunca del componente. Hay una prueba que falla si una palabra
inglesa se cuela en el texto visible de un JSX.

Un nombre en espanol en el codigo es un error, no una preferencia: `tools/rename/AGENTS.md` tiene
el glosario y las trampas del renombrado.

### Los comentarios dicen QUE hace el codigo, no su historia

Un comentario declara el **proposito**: que resuelve este archivo, que garantiza esta funcion.
Nada mas.

**Lo que NO va en un comentario:**

- Que habia antes, que fallo, que se arreglo ni cuando.
- Por que se eligio la opcion X y se descarto la Y.
- El numero de una prueba, de un commit o de una tarea.
- Repetir en prosa lo que la linea de al lado ya dice.

**Donde va cada cosa:** lo que cambio y por que, en el **mensaje del commit**; lo que cambio de
cara a quien usa la aplicacion, en **`CHANGELOG.md`**; una decision de arquitectura con sus
alternativas, en una **ADR de `docs/adr`**, que para eso es un registro fechado.

Un bloque de contexto por archivo, arriba. En linea, solo cuando el codigo no se explica solo.
Si hace falta un parrafo para justificar una linea, casi siempre sobra el parrafo y falta un
nombre mejor.

### Lo demas

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
| `tools/coherence` | Las pruebas que comparan los dos lados de un contrato que nadie ata |
| `infra` | Plantillas Bicep |
| `.claude/depgraph.json` | Mapa de imports y definiciones; se consulta antes de buscar a mano |
