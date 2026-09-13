# packages/config — configuracion por capas

Resuelve la configuracion efectiva desde varias fuentes, con precedencia declarada.

| Archivo | Que es |
|---|---|
| `fuentes.ts` | Entorno, App Configuration e instantanea |
| `Resolutor.ts` | La precedencia y el valor efectivo |
| `instantanea.ts` | Copia congelada, para que dos instancias no discrepen |

## Reglas

- **Nadie lee `process.env` por su cuenta.** Se pide aqui, y asi hay un solo sitio donde saber
  de que depende la aplicacion.
- **La configuracion se resuelve una vez y se congela** por arranque.
- **Un valor desconocido cae en el valor por defecto** y se dice, en vez de romper el arranque.

## Que NO hacer

- No leer una variable de entorno nueva desde un componente o una ruta.
- No poner secretos aqui: los secretos vienen de Key Vault.
