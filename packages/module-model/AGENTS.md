# packages/module-model — que es un modulo

La definicion de un modulo: rejilla, instancias de objeto, validacion contra el esquema,
interaccion y salud.

| Archivo | Que resuelve |
|---|---|
| `ModuleDefinition.ts` | La forma de un modulo: paginas, celdas e instancias |
| `grid.ts` | Rejilla de doce columnas, colisiones y limites |
| `validation.ts` | Que un mapeo case con el esquema real ANTES de guardar |
| `interaccion.ts` | Filtrado cruzado, drill-through y marcadores |
| `personalization.ts` | La vista propia de cada persona (4.6) |
| `salud.ts` | Si un modulo se puede componer o queda apagado |

## Reglas

- **Se valida antes de guardar, no al dibujar** (4.2). Un objeto con un campo retirado se marca
  como roto y se dibuja el aviso; no desaparece ni rompe la pagina.
- **Lo que se corta se cuenta y se dice.** Nada se omite en silencio.
- **Un modulo roto no tumba a los demas.** La salud se evalua por modulo y el despliegue apaga
  solo el que falla.

## Que NO hacer

- No dar por buena una instancia sin comprobar su version contra el registro.
- No permitir que dos instancias se solapen en la rejilla sin decirlo.
