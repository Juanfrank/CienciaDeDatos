# packages/export — exportar lo que se ve

Un documento comun del que salen los cuatro formatos, para que un PDF y un Excel del mismo
objeto digan lo mismo.

| Archivo | Que es |
|---|---|
| `document.ts` | El documento exportable: hojas, objetos, textos y notas |
| `formats.ts` | CSV y XLSX |
| `binarios.ts` | PDF |
| `heading.ts` | Marca institucional de cada salida |
| `queue.ts` | Exportacion como operacion encolada (4.9, 5.3) |

## Reglas

- **Un solo documento, cuatro formatos.** Si un formato necesita algo, se anade al documento, no
  al formato.
- **Los numeros van como numeros** en CSV y XLSX; el texto formateado, en PDF.
- **Las notas viajan con el objeto**: una regla de color o un formato de medida se explican en la
  exportacion, no se pierden.
- **Exportar no bloquea la peticion**: se encola y se informa del estado.

## Que NO hacer

- No generar un formato leyendo el DOM.
- No exportar mas filas de las que el ambito de quien pide permite ver.
