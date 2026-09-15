# ADR-015 — Estandar minimo de personalizacion de objetos

**Estado:** aceptado · **Fecha:** 2026-09-12

## Contexto

Cada objeto visual habia crecido con las opciones que su autor necesito el dia que lo escribio.
La tarjeta KPI no podia llevar icono, las barras no podian ocultar la leyenda, y ninguno tenia
subtitulo. Desde el editor no se podia cambiar nada de eso, asi que «la misma tarjeta pero en
rojo, con otro rotulo y con la cifra en porcentaje» era una peticion de desarrollo: tocar codigo
y desplegar.

La salida evidente —una bolsa de opciones libre por objeto— reintroduce justo lo que cierra la
seccion 4.3. Si una instancia puede declarar `color: '#ff0000'`, el color deja de salir de los
roles del tema y la puerta de contraste no garantiza nada sobre lo que se ve; si puede declarar
una ruta SVG, entra contenido sin revisar en el documento.

## Decision

Un contrato de presentacion **cerrado**, comun a todo objeto visual, con tres propiedades:

1. **Conjunto cerrado de claves.** `icono`, `acento`, `resaltado`, `subtitulo`, `formato`,
   `leyenda`, `datumLabels`. No hay una octava que alguien pueda anadir desde un JSON.
2. **Conjunto cerrado de valores.** El acento es un ROL del tema (`primario`, `secundario`,
   `terciario`, `neutro`), no un color; el icono es un nombre del catalogo, no una ruta. Los dos
   se resuelven contra el tema, que ya tiene un par de contraste comprobado para cada rol.
3. **Cada objeto declara que admite.** `ObjectVersion.presentation` lista sus claves. Una tabla
   no admite `leyenda`, y el editor no la ofrece.

**El minimo son cuatro claves** —`icono`, `acento`, `resaltado`, `subtitulo`— porque no dependen
de lo que el objeto dibuje: cualquier cosa que ocupe una celda tiene cabecera. Las otras tres
dependen del tipo y por eso se declaran.

Lo que convierte esto en un estandar y no en una intencion escrita en un comentario esta en
`contrato.spec.ts`: una prueba recorre **todas las versiones de todos los objetos del catalogo**
y falla si alguna no admite las cuatro. Un objeto nuevo no se puede publicar sin ellas.

La presentacion se valida en `validateModule`, junto al mapeo y a los complementos, y por el
mismo motivo: es configuracion, y 4.2 pide validarla antes de guardar. Sin eso, el estandar seria
un tipo de TypeScript —cierto mientras nadie edite el JSON de un modulo a mano, que es justo lo
que hace el panel de administracion—.

## Consecuencias

- Armar una visual parecida a otra deja de necesitar codigo. El editor ofrece los controles que
  el objeto admite y nada mas.
- El marco comun (`Marco`) dibuja la presentacion, no cada objeto. El segmentador se pintaba su
  propia cabecera a mano y quedaba fuera; se migro. Un objeto nuevo la hereda por existir, y no
  hay forma de dibujar uno sin pasar por ahi.
- `formatterOf` es el unico sitio donde se formatea una cifra de instancia, asi que la tarjeta,
  la etiqueta del grafico, la tabla y el archivo exportado no pueden divergir.
- **No se puede elegir un color.** Es el limite, y es deliberado. Quien necesite un color que no
  esta en los cuatro roles necesita cambiar el TEMA, que pasa por la puerta de contraste, y no
  una instancia.

## Alternativas descartadas

- **Bolsa libre `Record<string, unknown>`.** El error solo aparece al dibujar, y 4.2 pide lo
  contrario. Ademas abre la puerta al color y a la ruta SVG.
- **Un objeto publicado por variante** («tarjeta-kpi-roja»). Multiplica el catalogo por el numero
  de combinaciones y convierte cada peticion de estilo en una version nueva que certificar.
- **Estilo por CSS en el modulo.** Seria SQL libre con otro nombre: contenido arbitrario escrito
  por quien edita, dentro del documento, sin nada que lo valide.
