# ADR-020 — Objetos: elementos y contenedores

## Estado

Aceptado.

## Contexto

Hasta aqui, todo lo que se podia colocar en un modulo leia datos. La consecuencia no era una
carencia de funciones sueltas: era que un modulo largo se leia como una lista plana de tarjetas.
No habia forma de decir donde empieza una seccion, separar dos bloques, poner una nota, senalar
que un cuadro alimenta a otro, ni agrupar seis objetos que van juntos.

Tampoco habia forma de meter mas contenido del que cabe en una pantalla sin ampliar el modulo:
la unica unidad de composicion era la celda de la rejilla.

## Decision

Dos familias nuevas de objetos, publicadas en el MISMO catalogo versionado que los graficos:

- **Elementos** — cuadro de texto, titulo de seccion, linea divisoria, formas y conexiones.
- **Contenedores** — simple, desplazable, ampliable y con pestanas.

### Se publican como objetos, no como un mecanismo aparte

Llevan version fijada (§4.5), se colocan con el mismo arrastre, se validan con la misma
comprobacion y se personalizan con los mismos textos. Un mecanismo paralelo habria significado un
segundo sitio donde arreglar cada cosa, y la personalizacion habria vuelto a depender de que clase
de objeto se selecciono.

### «No consume datos» se DEDUCE del contrato

Un objeto cuyo contrato admite cero dimensiones y cero medidas no necesita dataset. No hay un
interruptor `sinDatos`: seria una segunda fuente de verdad sobre lo mismo, y el dia que discrepara
del contrato la validacion pediria un dataset a un objeto que no tiene donde ponerlo, o dejaria
pasar un grafico sin cache poblada.

Lo consultan los tres sitios que antes daban por hecho que todo objeto se enlaza a algo: la
validacion de modulo, la lista de datasets consumidos y el lector del cache.

### Los contenedores tienen su propia rejilla

Los hijos se posicionan contra la rejilla del contenedor, no contra la del modulo. Si fuera al
reves, mover el contenedor obligaria a recolocar todo lo que lleva dentro, y «agrupar» no
significaria nada.

Se cargan por el MISMO camino recursivo que lo de fuera: el ambito, los filtros y la agregacion
tienen una sola implementacion. Con una carga propia del contenedor, un grafico dentro y uno fuera
podrian acabar dando cifras distintas.

### Tres reglas que el modelo hace cumplir, no recomienda

1. **Un solo eje de desplazamiento.** El tipo `Eje` es `'x' | 'y'`; «ambos» no existe. El eje que
   no se eligio queda en `overflow: hidden` explicito y no en `auto`, porque con `auto` la segunda
   barra apareceria sola en cuanto un filtro alargara el contenido.
2. **Cambiar de pestana no cambia el contenedor.** Ni posicion, ni dimensiones, ni espacio
   ocupado. Los paneles inactivos se ocultan en lugar de desmontarse, y el alto lo sigue mandando
   la rejilla.

### Un conector guarda ids, nunca coordenadas

`desde` y `hasta` son ids de objetos; el trazado se recalcula en cada render a partir de la caja
de los dos. Guardar puntos es el fallo clasico de los diagramas de las herramientas de oficina:
mover un extremo deja la flecha apuntando al aire. Asi sigue pegado por construccion.

## Consecuencias

- Anadir un elemento o un contenedor nuevo es una entrada de catalogo, un caso en
  `initialSettings` y una rama de render. La tienda del editor lo recoge sola, porque agrupa
  por la categoria que el objeto ya declara.
- La geometria del conector vive en el paquete y no junto al componente: es una funcion pura de
  dos cajas, y se prueba sin navegador.
- Las conexiones se configuran escribiendo el id de cada extremo. Es la limitacion honesta de esta
  version: el editor de configuracion no conoce los demas objetos del modulo.

## Revision — se retira el contenedor lateral

Se publico y se retiro sin llegar a usarse. Dos motivos, y el segundo es el que decide:

- **Se solapaba con un carril que ya existe.** La aplicacion ya tiene dos carriles de pantalla
  completa —el arbol de navegacion a la izquierda y el panel de objetos del editor a la derecha—
  y un objeto anclado a un borde competia con ellos por el mismo sitio y el mismo gesto.
- **Era el unico objeto que salia de la rejilla.** Todo lo demas ocupa celdas y se valida contra
  la disposicion; este no, y por eso necesitaba su propia regla («uno por lado») que ninguna otra
  cosa necesita. Una excepcion estructural para un objeto es cara de mantener.

De paso desaparece una colision que estaba latente: sus estilos usaban `.lateral`, que es la clase
del arbol de navegacion desde mucho antes.
