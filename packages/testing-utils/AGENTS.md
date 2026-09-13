# packages/testing-utils — ayudas de prueba

Constructores de datos y dobles compartidos por las pruebas de varios paquetes.

## Reglas

- **Solo se importa desde pruebas.** Es `type:util` y no depende de nada mas.
- **Un doble se parece al real en lo que la prueba afirma**, no en todo.

## Que NO hacer

- No poner aqui logica que el codigo de produccion necesite.
- No sembrar datos que una prueba de otro paquete de por supuestos.
