# ADR-019 — Como se resume una medida, y a que grano queda un dataset

**Estado:** aceptado · **Fecha:** 2026-09-12

## Contexto

La capa de presentacion sumaba. Siempre, y era la unica operacion que sabia hacer: un `+` escrito
tres veces, en `aggregateBy`, en `toKpi` y en `toMatrix`.

Sobre las 64 filas del dataset de casos, una tarjeta con la columna `DiasPromedioResolucion`
mostraba **10 593 dias**, que es la suma de 64 promedios. El promedio real era **165,5**. No
fallaba, no avisaba, no marcaba nada: devolvia un numero perfectamente plausible y falso, que en
una capa de visualizacion institucional es el peor modo de fallo que hay.

La semantica existia, pero en el unico sitio donde la aplicacion no puede leerla: el **nombre de
la columna**. «DiasPromedio…» se lo decia a quien lo leyera; al codigo, nada.

Y habia una segunda mitad, mas de fondo. `mock-schema.json` definia `FactCasos` **sin clave**, con
`CasosIngresados` ya contados y `DiasPromedioResolucion` ya promediado. Esa es la forma que este
repositorio le estaba enseñando a la capa de analisis como «tabla de hechos»: una tabla ya
agrupada. Sobre esa forma un promedio **no se puede recalcular**, hagas lo que hagas.

## Decision

Cuatro piezas, y ninguna funciona sin las otras.

### 1. La agregacion se declara en el esquema

`SchemaMeasure.aggregation` es **obligatoria**: `suma`, `promedio`, `minimo`, `maximo`, `recuento`,
`recuento-distinto` o `ninguna`. Es el mismo criterio que `securityBindingRationale` del registro
de datasets — una decision que cambia el numero que se muestra no puede quedar implicita.

`ninguna` es el caso del modelo semantico: una medida DAX ya viene calculada por el motor, y la
aplicacion no puede volver a agregarla ni sumandola ni promediandola.

### 2. Quien edita puede cambiarla, por instancia

El chiclet de cada medida lleva su desplegable, como en Power BI. Se guarda **solo lo anulado**:
lo que no se toca se resuelve contra el esquema en cada lectura, asi que si la fuente cambia el
operador de una medida, los modulos que no lo habian anulado lo siguen sin que nadie los edite.
Volver al operador del esquema **borra** la anulacion en vez de copiar el mismo valor.

### 3. El grano se declara en el registro de datasets

`CacheableDataset.grain`, con su `grainRationale` obligatorio:

- **`atomico`** — la consulta trae la CLAVE del hecho entre sus dimensiones, asi que cada fila es
  un hecho y no un grupo. Cualquier agregacion se calcula sobre los atomos y sale bien a cualquier
  grano, con cualquier filtro y **despues del recorte del ambito**, que quita filas una vez leidas
  del cache. Es el modelo de las medidas implicitas. Cuesta tamaño: pesa lo que pese la tabla de
  hechos.
- **`preagregado`** — la consulta ya agrupo. Ocupa una fraccion y sirve igual de bien para lo
  aditivo, pero desde aqui ya no se recalcula un promedio ni un recuento distinto: lo que queda en
  el cache es un resultado, no los datos con los que se obtuvo.

Ninguno es «el correcto». Es un intercambio entre tamaño y que se puede preguntar despues, y por
eso se declara por dataset y con su motivo. Lo que no vale es no haberlo decidido, que es como un
promedio acaba sumandose.

El registro queda con los dos a la vista: `casos-por-distrito-trimestre` agrupado y solo con
medidas aditivas, y `casos-detalle` atomico, con `FactCasos.CasoId` entre sus dimensiones, para los
dias de resolucion.

### 4. Una sola comprobacion, en los dos caminos

Un objeto **colapsa** cuando muestra menos dimensiones de las que trae el dataset: varias filas de
origen caen en el mismo punto. Solo entonces importa el operador:

| | `atomico` | `preagregado` |
|---|---|---|
| aditivas (`suma`, `minimo`, `maximo`) | ✔ | ✔ |
| `promedio`, `recuento`, `recuento-distinto` | ✔ | ✘ |
| `ninguna` | ✘ | ✘ |

Se comprueba **al guardar** (`validateModule`) y **al leer** (`leerObjetos`). Las dos, porque el
grano de un dataset se declara en el registro y puede cambiar despues de que un modulo este
publicado: lo que era correcto al guardarlo deja de serlo sin que nadie lo toque. Es el caso de
4.2 —el campo que ya no existe— aplicado al operador en vez de al campo, y la respuesta es la
misma: marcarlo, no dibujar un numero plausible.

Sin informacion del dataset la comprobacion **se abstiene**, igual que el tipo `desconocido` de
las columnas. Inventarse el dato que falta hace que la validacion rechace configuraciones
correctas.

## Consecuencias

- **`null` significa «no hay respuesta», no cero.** Es lo que devuelve `ninguna` sobre un grupo
  colapsado, y un promedio sobre cero filas. Se dibuja como raya —el mismo signo que la matriz ya
  usaba para una celda sin filas— y las alertas **no** lo comparan contra su umbral: evaluarlo
  como cero dispararia toda regla de «por debajo de».
- **Los totales de una matriz se acumulan desde las filas de origen**, no desde las celdas. Con la
  suma daba igual; con un promedio no, porque el promedio de una fila es el de sus registros y no
  el de los promedios de sus celdas, que solo coincide si todas pesan lo mismo.
- **Los operadores se resuelven UNA vez, en el servidor, y viajan con el objeto.** Es lo que impide
  que el grafico en pantalla, el complemento de datos y los cuatro formatos de exportacion resuman
  distinto.
- **Se reordenan por NOMBRE, no por indice.** Los objetos consumen sus medidas por ranura, y una
  tarjeta pide antes la del pozo «valor» que la de «comparacion» aunque en el mapeo esten al
  reves. Casar por posicion le daria a cada medida el operador de la otra — el mismo fallo que las
  ranuras vinieron a quitar del mapeo de campos (ADR-018).
- **Sin esquema en el cache todo cae en `suma`**, como siempre. Un despliegue en el que el job aun
  no ha corrido no puede dejar todos los objetos en blanco. Lo que cambia es que ahora la
  combinacion imposible se rechaza al guardar, asi que el numero falso deja de ser alcanzable
  desde el editor.

## Lo que NO resuelve

**Las medias ponderadas y los ratios de ratios.** Un promedio ponderado no se recompone desde
ningun resultado ya agregado, ni declarando el operador ni nada: hay que cachear el **numerador y
el denominador** y dividir al leer. El grano atomico lo evita en la practica —sobre los hechos
uno a uno, el promedio simple ya es el ponderado—, pero un dataset `preagregado` que quiera servir
un ratio tiene que traer sus componentes. No hay comprobacion automatica para eso todavia.

## Alternativas descartadas

- **Deducir el operador del nombre de la columna.** Es lo que hacia el sistema de facto, y es lo
  que fallo: `DiasPromedioResolucion` decia «promedio» a un humano y nada al codigo.
- **Prohibir las medidas no aditivas.** Era la primera propuesta, y estaba de mas: sobre grano
  atomico un promedio o un distinto se calculan perfectamente, que es como funcionan las medidas
  implicitas de Power BI. El problema nunca fue el promedio; fue agregar sobre lo ya agregado.
- **Un solo grano para todos los datasets.** El atomico obliga a cachear la tabla de hechos entera
  para servir tres sumas; el agrupado impide cualquier promedio. Decidirlo por dataset es lo unico
  que respeta 6.6, que pide cachear «en su forma mas amplia razonable» — y la palabra que hace el
  trabajo ahi es *razonable*.
