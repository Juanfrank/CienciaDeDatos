# ADR-014: Material Design 3 como sistema, y ECharts sobre un respaldo accesible

- **Estado:** aceptada
- **Fecha:** 2026-09-12
- **Contexto:** Requisito de la capa de presentacion: Apache ECharts como libreria de visualizacion, Canvas como renderizador por defecto, SVG cuando resulte tecnicamente conveniente, capa `aria` para accesibilidad, y Material Design 3 como estandar de diseno. Secciones 4.2, 4.3 y 4.9 del contrato de ingenieria.

## Por que MD3 y no una paleta nueva

Material Design 3 no es un conjunto de colores: es un **procedimiento**. De un color de origen se derivan seis paletas tonales en HCT —matiz, croma y tono *percibido*— y cada rol de la interfaz se define como un tono concreto de una de ellas.

Eso resuelve un problema que este repositorio tenia documentado. El tema anterior llevaba una advertencia de varios parrafos sobre el rojo institucional: `#EF3340` da 4.02:1 sobre blanco, asi que pasa el umbral de elemento grafico y no el de texto. El apano era elegir a mano `accent[700]` para el texto en rojo y dejar escrito el motivo para quien viniera despues. En MD3 el rojo entra como **origen** de la paleta `tertiary` y el texto que va encima es `onTertiary`, cuyo tono se calcula para tener contraste. El hecho sobre `#EF3340` sigue siendo cierto —hay prueba que lo fija— pero ya no hay nada que recordar.

La consecuencia practica: la prueba de contraste deja de comprobar unos cuantos pares elegidos a mano y recorre **todos** los roles en los dos modos. Comprueba algo que deberia ser cierto por construccion, en lugar de algo que se espera que nadie rompa.

## Decisiones de color

- **El azul institucional es `primary`; el rojo es `tertiary` Y `error`.** La institucion tiene un rojo y significa "atencion": sirve igual para destacar que para avisar. Inventar un segundo rojo anadiria a la marca un color que la marca no tiene; usar el rojo por defecto de MD3 pondria dos rojos casi iguales en la misma pantalla. Los dos roles se distinguen por **donde** se usan, no por el matiz.
- **Los colores de marca son el ORIGEN, no el resultado.** `primary` es el tono 40 de la paleta del azul, que para `#0050DD` cae a medio tono del color original: imperceptible, y a cambio el par con su `onPrimary` deja de depender de que alguien lo comprobara. Lo que se fija como dato institucional —y tiene prueba— es el origen.
- **El esquema oscuro se genera y se verifica, y no se aplica.** MD3 define los dos modos y generarlos cuesta lo mismo, asi que la prueba de contraste recorre los dos. Encenderlo con `prefers-color-scheme` sin revisar cada pantalla en ese modo seria peor que no tenerlo.
- **La paleta categorica sale de las paletas del tema**, alternando familia antes que tono para que dos series contiguas no sean dos tonos del mismo color. Sus tonos son los que alcanzan 3:1 contra la superficie de su modo: en claro el tono 60 da 3.01, justo en el limite, asi que la banda segura acaba en 55.

## Las cuatro ideas que cambian la hoja de estilo

1. **Los roles, no los colores.** Nada es "azul": es `primary`, `surface-container`, `on-surface-variant`. El par de un color con su texto viene dado, asi que no queda ninguna decision de contraste que tomar en CSS.
2. **Las superficies, no las sombras.** Los cinco niveles de `surface-container` separan planos por tono. Una pantalla con ocho tarjetas y ocho sombras parece un relieve; con ocho tonos se lee como una lista. La sombra queda para lo que flota de verdad: dialogos y menus.
3. **Las capas de estado.** Un control no cambia de color al pasar el raton: se le superpone una capa de su propio color de contenido al 8%. Por eso un boton relleno y uno de texto reaccionan igual sin declarar dos juegos de colores.
4. **Los roles tipograficos.** Un texto no es "14 px en gris": es `body-medium` sobre `on-surface-variant`. Si un titulo queda grande, se baja de rol.

Una desviacion deliberada: **la etiqueta de los campos va siempre visible encima, no flotando dentro**. La etiqueta flotante de Material desaparece cuando el campo tiene contenido, y con ella la unica pista de que dato es; en un formulario de configuracion eso se paga caro.

## ECharts: el renderizador

**Canvas por defecto**, como pide el requisito: aguanta volumen e interaccion sin degradarse. **SVG en dos casos concretos**, no por gusto:

1. **Al imprimir.** Un canvas impreso es un mapa de bits a la resolucion de la pantalla, o sea borroso; un SVG sale nitido a cualquier tamano. Se cambia de renderizador con el evento de impresion y se vuelve al terminar.
2. **Con pocos elementos** (por debajo de 400 puntos × series). Un SVG ahi no cuesta nada y trae ventajas —se inspecciona, se selecciona—, asi que rasterizar no aporta.

**Carga diferida**: el modulo que importa ECharts se carga con `next/dynamic`. Quien abre un modulo sin graficos no descarga la libreria, y hay prueba de navegador que lo comprueba. Importa porque ECharts pesa mas que el resto de la aplicacion junta.

**La libreria se empaqueta local**, nunca desde un CDN: el principio 1 dice que el navegador solo habla con esta aplicacion, y hay una prueba que lo verifica.

## ECharts: la accesibilidad, que es la parte que decide el diseno

Un `<canvas>` es un mapa de bits. No hay nada dentro que el tabulador alcance ni que un lector de pantalla recorra. Adoptarlo tal cual habria eliminado el filtrado cruzado de 4.4 para quien navega con teclado — y 4.9 dice que la accesibilidad no se pospone.

La solucion son **tres capas, no una**:

- **`aria.enabled`**: ECharts describe el grafico en el contenedor.
- **`aria.decal.show`**: dibuja un patron distinto sobre cada serie. Es lo que cumple WCAG 1.4.1 — el color no puede ser el unico medio de transmitir informacion — y con ocho series deja de ser una formalidad: al imprimir en gris, o para quien no distingue ciertos colores, el patron es lo unico que separa una serie de otra.
- **El respaldo en DOM**, que es la decision de fondo: el grafico en HTML **no se sustituye, se superpone**. Sin JavaScript se ve el respaldo con sus barras y sus botones, y la pagina sigue sirviendo. Con JavaScript se ve el lienzo, y el respaldo pasa a estar oculto *visualmente* pero sigue en el documento y sigue siendo alcanzable con el tabulador. **Al recibir el foco se muestra**, porque un control invisible que recibe el foco desorienta mas que uno que no existe. Al imprimir tambien vuelve: en papel las cifras exactas valen mas que la forma.

El respaldo de una linea es una **tabla**, no unas barras: una serie temporal tiene un valor por punto y por serie, y en cuanto no se puede ver la forma de la curva lo util son las cifras. Dibujar barras ahi seria inventar una lectura que el objeto no propone.

## Consecuencias

- **Las 212 pruebas de navegador anteriores pasaron sin tocarlas.** Es la prueba de que el respaldo es equivalente: los `data-testid` y el filtrado por teclado son los mismos de antes.
- **Los graficos usan el tema leyendo las variables CSS ya resueltas.** No hay una paleta de ECharts que mantener al lado de la de Material. Al cablearlo se leia de `documentElement` en vez de `body` —donde el layout las inyecta—, asi que llegaban vacias y ECharts caia en su propia paleta: el grafico salia con los colores de la libreria y no se notaba, porque un grafico con colores plausibles no parece roto. Hay prueba.
- **El grafico se crea una vez.** Los callbacks y las opciones viajan por referencia mutable, no por las dependencias del efecto: el padre los redefine en cada render, y ponerlos en las dependencias destruia y recreaba el grafico continuamente. Entre una cosa y otra el manejador de clic desaparecia y el filtrado cruzado dejaba de responder sin que nada fallara de forma visible.
- **El nombre de la dimension no se rotula en el eje.** ECharts recortaba `DimTribunal.Distrito` a una letra suelta al borde del grafico: ruido que ademas parecia un fallo. El titulo del objeto ya dice de que va, y la dimension exacta viaja en la descripcion accesible.
- **Las opciones de ECharts se construyen con funciones puras** en `ui-components`, sin tocar el DOM ni importar la libreria. Lo que hay que poder comprobar de un grafico es que los datos y los rotulos que le llegan son los correctos; que ECharts dibuje bien un `bar` no es cosa de este repositorio.
