# ADR-016 — Panel de filtros

**Estado:** aceptado · **Fecha:** 2026-09-12

## Contexto

El unico objeto de filtro era el **segmentador**: una dimension, una lista de pastillas. Un modulo
que necesitara filtrar por distrito, materia y periodo gastaba tres celdas de la rejilla en tres
objetos identicos salvo por el campo, y las tres se veian distintas de lo que tenian al lado
porque cada una traia su propia cabecera.

Ademas, las pastillas solo sirven para pocos valores. Con doce ocupan media pantalla; con
doscientos son inservibles. Y una fecha no se filtra como un texto: se filtra por un dia o por un
intervalo.

## Decision

Un objeto nuevo, `panel-de-filtros`, de categoria `filtro`, con **de 1 a 10 dimensiones** y el
tipo de selector configurable por dimension:

| Selector | Para |
|---|---|
| `pastillas` | Hasta ~8 valores, seleccion multiple |
| `lista` | Decenas de valores, con casillas y desplazamiento propio |
| `desplegable` | Un solo valor, ocupa una linea |
| `busqueda` | Cientos de valores |
| `calendario` | Un dia. **Solo** sobre dimensiones de fecha |
| `rango-de-fechas` | Desde y hasta. **Solo** sobre dimensiones de fecha |

Tres decisiones que conviene dejar escritas:

1. **El tipo de columna viaja hasta la validacion.** `columnsByDataset` pasaba solo nombres
   —`columns.map(c => c.name)`— porque hasta ahora ninguna validacion necesitaba mas. Un
   calendario sobre una columna de texto es un error de configuracion, y sin el tipo no hay forma
   de distinguirlo de uno correcto. Cuando el tipo es **desconocido** —un dataset que el job aun
   no ha poblado— la validacion **se abstiene**: rechazar ahi bloquearia configuraciones
   correctas en un despliegue recien hecho.

2. **Toda dimension mapeada tiene selector, este o no configurada.** `selectoresEfectivos` pone
   el que corresponde a su tipo. Sin eso, una dimension mapeada y no configurada seria una
   dimension invisible: el peor fallo posible en un filtro, porque quien mira cree que esta
   viendo el total.

3. **Un rango viaja como DOS parametros**, `campo.desde` y `campo.hasta`, no como uno con un
   separador. Un separador obliga a que quien lea la URL conozca el formato para partirlo, y el
   dia que un valor contenga ese caracter el filtro se rompe en silencio.

El segmentador **se queda** en el catalogo y en el modulo de ejemplo, sobre la misma dimension
que el panel. No es un resto: los dos escriben el mismo parametro de la URL, asi que elegir en
cualquiera de ellos mueve al otro sin que ninguno sepa que el otro existe. Es la demostracion de
que 4.11 no es una formalidad, y el sitio donde se notaria si algun dia alguien mete estado local
en un filtro.

## Consecuencias

- Un defecto real que el panel destapo: `useUrlFilters` partia de los `searchParams` del render
  al escribir. Con un segmentador por objeto casi no se notaba —hacian falta dos clics en objetos
  distintos en menos de lo que tarda un render—. Con diez controles juntos, pulsar dos seguidos
  es el gesto normal, y el primer filtro desaparecia sin dejar rastro. Ahora se parte de lo
  ultimo PEDIDO, que se olvida en cuanto el enrutador comprometa algo.
- Un panel de diez dimensiones es un objeto, no diez. La rejilla del modulo respira.
- La seleccion sigue viviendo en la query string: un panel con seis filtros puestos es una
  direccion que se comparte y se marca.
