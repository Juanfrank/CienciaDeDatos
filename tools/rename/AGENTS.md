# tools/rename — renombrado del espanol al ingles

Traduce identificadores declarados, no palabras. Tres piezas:

| Archivo | Que es |
|---|---|
| `glosario.json` | Mapa palabra a palabra, mas la clasificacion en verbos, adjetivos y singulares |
| `segmentos.mjs` | Escaner que parte un archivo en `codigo`, `comentario` y `cadena` |
| `renombrar.mjs` | `--traducir <id>`, `--proponer <ruta>`, `--aplicar <plan.json>` |
| `prefijos-de-prueba.mjs` | Los testids que se construyen con plantilla, que el mapa normal no ve |

Cada zona recibe una regla distinta: en codigo se sustituye todo, en comentario solo lo
compuesto —una palabra suelta es indistinguible de prosa en espanol— y en cadena solo lo que es
contrato de interfaz, es decir testids y clases CSS.

## Reglas

- **`unir(segmentar(x)) === x`, siempre.** Si la reconstruccion falla, la herramienta corrompe
  archivos en vez de renombrarlos. Es lo unico que no admite matices.
- **`--proponer` solo mira los sitios de DECLARACION.** Tomar cualquier palabra del archivo mete
  en el mapa el `texto` de trescientos comentarios.
- **Lo que `--proponer` retiene se mira a mano.** `colisiones` (dos origenes al mismo destino),
  `ocupados` (el destino ya se declara en ese archivo) y `ambiguos` (el identificador tambien es
  miembro de una union de cadenas) no se resuelven solos.
- **`nx run verificacion:typecheck --skip-nx-cache`.** Sin `--skip-nx-cache`, nx repitio un
  resultado cacheado sobre un arbol ya roto.
- **Despues de cada pasada: typecheck, `vitest run`, lint y `nx run shell:e2e`.** El lint es el
  que ve un `id.get(id)` que compila y esta mal.

## Lo que ya rompio una vez

Cada caso de esta lista tiene hoy una guarda en la herramienta o una prueba en el repositorio.

| Caso | Como se manifesto | Guarda |
|---|---|---|
| Palabra reservada | `nueva` → `new` | `RESERVADAS` |
| Colision en el mismo archivo | `porId` → `id`, y quedo `id.get(id)` | `ocupados` |
| Expresion regular leida como codigo | `/no existe el esquema/` paso a comprobar un texto que el servidor nunca dice | Las expresiones regulares cuentan como `cadena` |
| `return /re/` | La barra paso por division y la comilla de dentro abrio una cadena | `PALABRAS_ANTES` |
| Rutas aplicadas a toda cadena | «La exportacion esta en queue» | Solo en especificadores que empiezan por `./` o `../` |
| Import sin destino | El archivo ya estaba movido, no habia nada que mover, y el especificador se quedo en espanol | `especificadoresRotos()` tras aplicar |
| Nombre de argumento ICU | Se renombro la clave del objeto y no el `{campo}` del mensaje | Los nombres ICU van en `PROTEGIDOS` |
| Campo que cruza la API | `body['clave']` es cadena y la clave del emisor es codigo: el acceso devolvio 400 | Pendiente de una pasada dedicada al contrato HTTP |
| Id de ranura | `ranuras: { filas: … }` paso a `dataRows` y el objeto salio marcado como roto | `apps/shell/src/server/modules.spec.ts` |
| Texto de un JSX | `<h1>Editor de modulos</h1>` quedo diciendo «Editor de modules» | La zona `prosa` de `segmentarJsx`, y `tools/texto-visible.spec.ts` |
| Atributo `data-*` | El TSX escribia `data-axis` y el CSS seguia buscando `data-eje` | `apps/shell/src/server/atributos-de-datos.spec.ts` |
| Ruta en una prueba | `theme.spec.ts` abria `components/Rejilla.tsx`, ya movido | `especificadoresRotos()` compara por nombre de archivo |
| Nombre de archivo de dos letras | `catalogo/es.ts` iba a pasar a `catalogo/is.ts` | Un nombre de tres letras o menos no se traduce |
| Nombre que ya esta en ingles | `datasetId` paso a `idDataset` al invertir dos sustantivos | Si toda palabra se traduce a si misma, no hay traduccion |
| Testid construido con plantilla | El componente pone `anadir-${id}` y la prueba busca `add-bars` | Se renombra aparte, solo en posicion de testid |
| Literal de union | `icono: 'texto'` con la clave ya renombrada a `content` | El typecheck, si el union esta tipado |

## Que NO hacer

- No aplicar un plan sin haber leido sus `colisiones` y sus `ambiguos`.
- No renombrar un nombre que viaja por HTTP sin renombrar los dos lados a la vez: el
  `body['campo']` del receptor y la clave del objeto que envia el emisor.
- No confiar en que el typecheck vea un id de ranura o una clave de mensaje: son cadenas, y el
  compilador no las relaciona con nada.
- No ampliar `PROTEGIDOS` para tapar un fallo que una prueba puede detectar. Proteger `filas`
  impide tambien renombrar las propiedades internas que si deben cambiar.
- No esperar que renombre CARPETAS: solo mueve archivos. El directorio se cambia con `git mv` y
  sus especificadores a mano; el comprobador de imports avisa de los que queden apuntando a nada.
- No renombrar las rutas de `apps/shell/app`: son las URL de la aplicacion, y la aplicacion habla
  espanol.
- No sustituir un prefijo de testid por su posicion en la cadena. `titulo-` tambien empieza el
  objectId `titulo-de-seccion` y `equipo-` los ids del seed: hay que anclar en `data-testid=`,
  `prueba=`, `getByTestId(` o el selector `[data-testid=`, y en ningun otro sitio.
