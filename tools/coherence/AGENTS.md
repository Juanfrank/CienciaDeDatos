# tools/coherence — los dos lados de un contrato que nadie ata

Aqui no se prueba codigo: se comprueba que dos representaciones de la MISMA cosa sigan diciendo
lo mismo. Son contratos entre archivos distintos, a veces entre lenguajes distintos, que ningun
compilador relaciona.

| Archivo | Los dos lados que compara |
|---|---|
| `interfaz.spec.ts` | El `data-*` y el testid que escribe el TSX, contra el selector del CSS y el `getByTestId` de la prueba de navegador |
| `rutas.spec.ts` | La URL que el codigo pide, contra la carpeta que el enrutador sirve |
| `documentacion.spec.ts` | La ruta citada en un `.md`, la carpeta que declara sus reglas y la palabra que se lee en pantalla |
| `i18n.spec.ts` | El texto escrito en el componente contra el catalogo, y el prefijo de una clave armada con plantilla contra las claves que existen |
| `api.spec.ts` | El campo que un `Route Handler` lee por cadena, contra la clave que escribe quien le llama |
| `autorizacion.spec.ts` | La ruta que sirve datos, contra el guardian que deberia cortarla |
| `rutas-de-scripts.spec.ts` | La ruta que nombra un script o un `.json`, contra la carpeta que existe |

## Por que estan juntas

Todas fallan igual: en silencio. El renombrado al ingles movio ciento y pico archivos y cada uno
de estos contratos se partio por la mitad sin que nada dejara de compilar. La regla de estilo
dejaba de aplicarse, la prueba esperaba treinta segundos por un elemento que nadie dibujaba, la
pagina pasaba a ser un 404 —y la prueba de accesibilidad seguia en verde, porque un 404 tambien
es accesible—.

## Reglas

- **Cuesta un segundo, no ocho minutos.** Es el motivo de que existan: lo que aqui se ve leyendo
  archivos, antes solo se veia levantando un navegador.
- **Las entradas del proyecto se declaran en su `project.json`.** Estas pruebas leen el arbol de
  archivos entero, asi que nx no puede deducir de que dependen: si no se declara, `affected` las
  salta cuando cambia justo lo que comprueban.
- **Toda lista de archivos se cuenta antes de compararla, UNA POR UNA.** Una guarda sin entrada
  sale verde siempre: el patron `apps/shell/app/**/*.css` no devolvia ningun archivo —`**` exige
  una carpeta intermedia y `globals.css` cuelga directo de `app`— y la comprobacion de los
  `data-*` llevaba desde el primer dia comparando cero selectores contra el TSX. Cada bloque abre
  con un `it` que afirma que hay algo que revisar.

  Contar el TOTAL no basta, y volvio a pasar por eso: `rutas-de-scripts.spec.ts` juntaba scripts,
  `.json` y flujos de CI en una sola lista y comprobaba que hubiera mas de diez. Los `.json` solos
  pasaban de diez, asi que los cero scripts que devolvia `tools/**/*.sh` no se notaron, y la
  guarda estuvo en verde sin abrir el unico archivo por el que se habia escrito. Se cuenta cada
  lista por separado, y contra cero.
- **Una excepcion se escribe con su motivo.** `documentacion.spec.ts` respeta cuatro sitios donde
  la cita es deliberada —las ADR son un registro fechado— y cada uno lleva escrito por que.

## Que NO hacer

- No anadir aqui una prueba que ejercite codigo: eso va junto al codigo que prueba.
- No relajar una comprobacion para que pase. Si el fallo es un falso positivo, se acota el
  patron y se explica; si es real, se arregla el codigo.
- No leer el arbol con rutas relativas al archivo: se usa la raiz de git, que no depende de
  desde donde se invoque a vitest.
