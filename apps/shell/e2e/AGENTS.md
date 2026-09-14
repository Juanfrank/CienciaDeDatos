# apps/shell/e2e — pruebas de navegador

Cubren los criterios de la seccion 9 que no se pueden comprobar de otra forma: accesibilidad
real con axe, contraste con el tema aplicado, que el navegador no hable fuera del origen, que un
Visor reciba 403 pidiendo `/admin` a mano, y que la aplicacion escale a mas de una instancia.

| Archivo | Que cubre |
|---|---|
| `accesibilidad.spec.ts` | axe sobre cada pagina, teclado, foco visible |
| `contraste-dark.spec.ts` | Las mismas paginas con el tema dark puesto |
| `lienzo.spec.ts`, `graficos.spec.ts` | El editor y el dibujo de cada tipo |
| `editor-completo.spec.ts` | Todo objeto del catalogo se coloca y se configura |
| `contrato-de-objetos.spec.ts` | Lo que el catalogo declara llega al panel |
| `responsivo.spec.ts` | 390, 820 y 1280 px |
| `admin.spec.ts`, `shell.spec.ts` | Gobierno, acceso, filtros, marcadores |

## Como ejecutarlas

```bash
npx nx run shell:e2e            # construye antes; es la forma correcta
npx playwright test --config …  # NO: sirve el `.next` que hubiera, que puede ser anterior
```

`shell:e2e` depende de `shell:build`. Invocar Playwright directamente se salta esa dependencia y
las pruebas miden una version anterior de la aplicacion: fallan o —peor— pasan por lo que ya no
esta en el codigo.

## Como escribirlas

- **Recorre todos los casos, no una muestra.** Se importa el catalogo y se itera: un objeto sin
  prueba no falla, simplemente no tiene prueba.
- **Mide el resultado, no la regla.** Para comprobar una rejilla se leen las cajas con
  `getBoundingClientRect`, no se lee el CSS.
- **Afirma la regla, no el recuento.** «Pintada equivale a pasar del umbral» vale con cualquier
  reparto de datos; «alguna pintada y no todas» falla el dia que el ambito cambia las cifras.
- **Espera al guardado** (`saving-data="no"`) antes de pulsar algo que vuelva a guardar.
- **Espera a que ECharts monte** (`data-montado="si"`) antes de analizar una pagina con graficos.

## Que NO hacer

- No usar `sleep` ni esperas por tiempo.
- No dar por buena una prueba que pasa sin comprobar que falla cuando debe.
- No depender de datos concretos del seed si la afirmacion se puede escribir sobre la regla.
