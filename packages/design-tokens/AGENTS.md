# packages/design-tokens — tema y contraste

El tema institucional expresado en Material Design 3, y la puerta de contraste que ningun modulo
puede publicarse sin pasar (4.3).

| Archivo | Que es |
|---|---|
| `material3.ts` | Generacion del esquema desde los colores de origen |
| `material3Tokens.ts` | Tipografia, forma, elevacion y emision de variables CSS |
| `temaInstitucional.ts` | Los colores de la marca y los temas light y dark |
| `contrast.ts` | Razon de contraste WCAG 2.1 y la puerta de publicacion |
| `identity.ts` | Nombre y emblema de la institucion |

## Reglas

- **El azul `#0050dd` y el rojo `#ef3340` son un dato de la institucion**, no una preferencia de
  diseno. Entran como origen de las paletas tonales; hay prueba que los fija.
- **Un color es siempre un ROL**, nunca un valor suelto: asi tiene par de contraste comprobado y
  sigue al tema dark.
- **Los dos modos emiten las mismas variables** con valores distintos. Encender el dark es
  redefinir, nunca anadir.
- **El rojo de marca no admite texto pequeno encima** (4.02:1 sobre blanco). El sistema lo
  resuelve con `onTertiary` y `onTertiaryContainer`, no una nota al pie.

## Que NO hacer

- No anadir una variable que solo exista en un modo.
- No relajar un umbral para que una combinacion pase: silenciar la puerta es peor que no tenerla.
- No exportar un color para que alguien lo escriba a mano en un componente.
