# ADR-017 — El editor es el modulo, no un formulario sobre el modulo

**Estado:** aceptado · **Fecha:** 2026-09-12

## Contexto

El editor era una lista de fichas: una por objeto, con desplegables para el dataset y casillas
para los campos. Funcionaba y estaba probado, y tenia un problema que ninguna prueba podia
detectar: **para saber que aspecto tenia lo que se estaba construyendo, habia que publicarlo y
abrirlo**. Quien disenaba un modulo trabajaba sobre una representacion abstracta de el.

La rejilla tenia el mismo problema. La disposicion siempre se guardo en doce columnas y la
validacion siempre rechazo los solapes, pero quien editaba no veia ninguna rejilla: escribia
numeros y descubria el resultado despues. Un contenedor que no se ve es una abstraccion.

## Decision

El editor pasa a ser **un lienzo con el modulo dibujado** y **un panel lateral con pestanas**.

### El lienzo

- Cada bloque se renderiza con **los mismos componentes** que la vista publicada. `ObjetoDeModulo`
  sale de `VistaModulo` para que los dos lo compartan: si el editor tuviera su propia version, las
  dos divergirian en cuanto alguien anadiera un tipo de objeto, y el primero en notarlo seria
  quien publicara algo que no se parece a lo que vio.
- Con **datos reales**, leidos del cache. Vuelven en la MISMA respuesta que el guardado, no en una
  peticion aparte: son el resultado de ese cambio, y pedirlos despues abre una ventana en la que
  lo dibujado no corresponde a lo guardado.
- **La rejilla se ve**: doce guias de columna, y dos filas libres por debajo del contenido para
  que se vea donde cabe lo siguiente.
- Un bloque **no es un boton**. La vista previa lleva sus propios controles, y un boton no puede
  contenerlos. El contenido va `inert` y encima hay un boton transparente que solo selecciona.

### El ambito, que es lo que no se relaja

`cargarModulo` comprueba que el EQUIPO tenga concedido el modulo en el arbol, y un borrador no
esta en el arbol. La vista previa se salta esa comprobacion —la autorizacion para ver un borrador
es «es tuyo», y la hace `moduloVisiblePorSlug`— pero **usa el mismo `leerObjetos` y el mismo
ambito**. Si fuera un camino aparte, crear un borrador seria la forma mas facil de ver datos fuera
del alcance propio, y ninguna prueba de la vista normal lo detectaria.

Como el borrador no esta en el arbol, `resolveEffectiveScope` devuelve su centinela de «no permite
nada»: una restriccion sobre una dimension vacia. Ese centinela es un MARCADOR y no un filtro —el
lector no sabe filtrar por una columna que no existe y lanza—, asi que la vista previa usa la
primera capa de la resolucion: el **ambito general del equipo activo**. No es una ampliacion: es
el ambito propio del equipo de quien edita, y publicar el modulo en cualquier carpeta solo puede
restringirlo mas. La vista previa muestra, como mucho, lo que se vera publicado.

### El panel

Cuatro pestanas, y el corte responde a cuatro preguntas distintas:

| Pestana | Pregunta |
|---|---|
| Visualizaciones | Que quiero poner. **La unica puerta** por la que entra un objeto. |
| Datos | Que mide: dataset y los pozos de campos. |
| Formato | Como se ve: presentacion, y el tamano y la posicion —cuanto ocupa un objeto en la rejilla no cambia lo que mide—. |
| Complementos | Que lo acompana: los objetos adjuntables, que no ocupan celda. |

La lista **crece**: cada tipo nuevo de interaccion anade una. Por eso la barra se desplaza y saca
chevrones estrechos en los extremos solo cuando hay algo fuera de la vista. Encogerlas hasta que
quepan habria cortado los rotulos y dejado una fila de iconos sin nombre.

#### Pozos de campos

«Dimensiones» y «medidas» como dos listas planas no dicen nada de un grafico de barras: la primera
dimension reparte las barras y la segunda las agrupa en series. Cada version de objeto declara sus
ranuras CON NOMBRE —eje X, serie, eje Y; valor, comparacion, detalle— y el editor las pide asi.

Un pozo **no cambia el modelo de datos**: `binding.dimensions` y `binding.measures` siguen siendo
dos arrays ordenados, y un pozo es una particion con nombre sobre uno de ellos. Cambiar el modelo
habria obligado a migrar cada modulo guardado, cada validacion y cada proyeccion para no ganar
nada que el orden no diera ya. La consecuencia a saber: quitar un campo corre los del pozo
siguiente, y por eso los pozos se declaran en el mismo orden en que el objeto consume sus campos.

Los campos ya puestos se ven como chiclets apilados; para anadir hay un `+` que abre un buscador.
La lista de casillas con todos los campos del dataset se lee con cuatro y es inservible con
cuarenta: lo que importa —que hay puesto aqui— quedaba disuelto entre lo que no esta puesto.

Sin nada elegido, Datos y Formato se **deshabilitan en vez de desaparecer**: una barra que cambia
de numero de pestanas obliga a volver a buscar donde estaba cada cosa. Al elegir un bloque, el
panel salta a Datos, que es lo que se quiere hacer justo despues de colocar algo.

### Mover y redimensionar

Con **botones**, no arrastrando. 4.9 dice que la accesibilidad no se pospone, y un lienzo que solo
se ordena arrastrando es un lienzo que solo ordena parte de la gente. Los botones se apagan en el
borde en vez de guardar algo que la validacion rechazara despues. El arrastre puede venir despues
SOBRE ESTAS MISMAS operaciones —no como un segundo camino que pueda divergir—, y sigue anotado en
el punto 2.1 de la hoja de ruta.

## Consecuencias

- `findFreeSlot` por fin se llama. Estaba escrito y probado desde que se escribio la rejilla y no
  lo usaba nadie: el editor apilaba al final, asi que dos objetos de media anchura no se ponian
  nunca uno al lado del otro. Es el septimo caso de codigo construido al que no llamaba nada.
- Un objeto roto se marca **en el lienzo**, que es donde 4.2 quiere que se vea, y la lista de
  problemas en texto se queda para poder leerlos todos de una vez.
- El editor no es optimista: lo que se ve es lo que esta guardado. Es lo que hace que la vista
  previa signifique algo, y el precio es una espera por cambio, que se anuncia.

## Lo que este cambio destapo

- **El `tsconfig` raiz excluye `apps/shell/**`.** `tsc -b` a secas no comprueba la aplicacion
  entera; el script `npm run typecheck` hace una segunda pasada que si. Un error de aridad en una
  llamada vivio hasta que se ejecuto en el navegador.
- **Un 500 sin cuerpo dejaba el editor callado.** `r.json()` lanzaba dentro del `try`, la
  excepcion subia sin capturar y el mensaje de error no llegaba a pintarse.
