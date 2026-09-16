# packages/ui-components — objetos visuales versionados

No es solo React: es el REPOSITORIO de objetos (4.5). Contratos de datos, semver, politica de
deprecacion, modelo de vista y construccion de las opciones de ECharts.

| Carpeta | Que hay |
|---|---|
| `src/registry/` | Catalogo, tipos, semver, proyeccion, modelo de vista y agregacion |
| `src/presentation/` | Claves de presentacion, pozos, elementos, contenedores, iconos, formato |
| `src/charts/` | Opciones de ECharts, orden, pequenos multiplos y los modelos que transforman antes de dibujar: intervalos, cuartiles, rejilla y grafo |

## Las tres listas que no pueden discrepar

1. Lo que el **catalogo declara** que admite una version (`presentation`).
2. Lo que el **dibujo honra** (`src/charts/options.ts`).
3. Lo que el **panel ofrece** (`apps/shell/src/components/editor/Presentation.tsx`).

`src/registry/declaredPresentation.spec.ts` compara las dos primeras con una sonda de
comportamiento; `apps/shell/src/server/format-panel.spec.ts` compara la primera con la
tercera. Una clave que el dibujo honra y el catalogo no declara solo se puede usar escribiendo
la instancia a mano.

## Publicar un objeto o una version

- **Una version publicada no se modifica.** Ni sus limites, ni sus pozos, ni sus notas, ni su
  lista de presentacion: todo eso lo congela la version. Lo que cambie entra en una nueva.
- **Toda version lleva changelog y certificacion.** El registro rechaza publicar sin ellos.
- **Toda version vigente de un objeto de datos declara `pozos` y `notes`.**
- **Todo objeto declara `icono`**, y los que consumen datos declaran ademas `familia`.
- **`presentation` incluye `MIN_PRESENTATION` entera.**

## Lo que el dibujo calcula, lo calcula UNA vez

Un objeto que transforma sus datos antes de dibujarlos —repartirlos en intervalos, sacarles los
cuartiles— pone esa transformacion en su propio modulo de `src/charts/`, y de ahi leen el dibujo Y
el respaldo en DOM. Con dos implementaciones, la tabla y el grafico acaban diciendo cosas distintas
del mismo dato, y nada falla al hacerlo.

## Las funciones de grafico son puras

Reciben modelo de vista y paleta, devuelven el objeto de opciones. No tocan el DOM ni importan
ECharts, y por eso se prueban sin navegador.

## Que NO hacer

- No anadir una clave de presentacion a una lista compartida entre versiones: amplia en silencio
  lo que admiten versiones ya publicadas.
- No leer variables CSS desde aqui: la paleta llega como argumento.
- No escribir un color literal. La unica excepcion documentada es el blanco de las etiquetas del
  mapa de arbol, y esta razonada en el codigo.
