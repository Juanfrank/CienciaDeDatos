# apps/shell/src/components — los objetos dibujados

Cada objeto del catalogo se dibuja aqui. `objetos.tsx` tiene un componente por tipo; `Marco`
envuelve a todos con la cabecera, el icono, el subtitulo y los complementos.

| Archivo | Que es |
|---|---|
| `objetos.tsx` | Un render por tipo de objeto, mas `Marco`, `Multiplos` y los ayudantes comunes |
| `Grafico.tsx` | Lee los colores del tema de las variables CSS y monta el lienzo |
| `Lienzo.tsx` | El unico modulo que importa ECharts. Carga diferida |
| `SortableTable.tsx`, `MatrixTable.tsx` | Tabla llana y matriz jerarquica |
| `elementos.tsx`, `Contenedor*.tsx` | Elementos y contenedores, que no consumen datos |
| `editor/` | El editor de modulos |

## El estandar de un objeto nuevo

1. **Respaldo accesible siempre.** Un `<canvas>` no tiene nada que un lector de pantalla pueda
   recorrer. Todo grafico lleva su tabla equivalente, envuelta en `FallbackTable`, que aporta
   `tabIndex`, `role` y nombre accesible.
2. **Filtrado cruzado por raton Y por teclado** (4.4). Las celdas de categoria se dibujan con
   `CategoryCell`, que produce un boton alcanzable con el tabulador.
3. **El color sale del tema**, leido de las variables CSS en `Grafico.tsx`. No se escribe un
   literal.
4. **El alto no depende del contenido.** Lo fija la rejilla; lo que no cabe se desplaza dentro
   de la tarjeta.
5. **Lo que se corta se cuenta y se dice**, como hacen los multiplos con `omitidos`.

## Texto visible

Ninguna cadena que una persona vea se escribe aqui: sale del catalogo de `@app/i18n`. En un
componente de cliente con `useTranslator()`, en uno de servidor con `traductor()` de
`src/server/idioma.ts`. Los numeros y las fechas salen de `t.numero` y `t.fecha`, nunca de
`toLocaleString()` sin idioma.

La migracion del catalogo esta en curso: lo ya migrado no vuelve al componente, y lo nuevo entra
directamente por el catalogo.

## Que NO hacer

- No escribir una cadena visible dentro del componente: va al catalogo.
- No importar ECharts fuera de `Lienzo.tsx`: se rompe la carga diferida.
- No serializar las opciones del grafico a JSON para pasarlas: `JSON.stringify` borra los
  `formatter` y las cifras salen sin formato sin que nada falle.
- No escribir una tabla de respaldo a mano: usa `FallbackTable` y `CategoryCell`.
