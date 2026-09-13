# apps/shell/src/components/editor — el editor de modulos

Construye un modulo sin escribir codigo (4.2). Cuatro pestanas, cada una con una pregunta:

| Pestana | Pregunta | Archivo |
|---|---|---|
| Objetos | que quiero poner | `PanelLateral.tsx` (`Tienda`) |
| Datos | que mide | `PanelLateral.tsx` (`Datos`) + `Pozo.tsx` |
| Formato | como se ve | `Presentacion.tsx` |
| Complementos | que lo acompana | `PanelLateral.tsx` |

## Reglas

- **El panel solo ofrece lo que la version del objeto declara.** El guardia es
  `admite("<clave>")`, y `controles.ts` mapea cada clave de presentacion a su identificador de
  prueba. Anadir una clave sin control falla en `panel-de-formato.spec.ts`.
- **Las secciones son `<details>`**, con el estado inicial en `abierta` y el filtro del buscador
  por contexto (`ProveedorDeFiltro`). Un `<details>` es no controlado: si hay que abrirlo desde
  React cuando el usuario ya lo toco, hay que escribir `open` en el DOM por referencia.
- **Los campos de texto confirman al perder el foco**, no en cada pulsacion.
- **Un objeto recien colocado llega ya mapeado** a la primera medida del dataset.

## Que NO hacer

- No anadir un control que la validacion vaya a rechazar al guardar.
- No poner un `ProveedorDeFiltro` envolviendo secciones cuyo titulo no case con lo que se busca:
  desapareceran al filtrar.
- No usar `check()` de Playwright sobre una casilla que dispara guardado: pulsa y afirma despues.
