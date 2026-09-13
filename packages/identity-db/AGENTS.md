# packages/identity-db — gobierno persistido

Esquema Prisma sobre Azure SQL, los mapeadores de fila a dominio y los datos sembrados.

| Archivo | Que es |
|---|---|
| `prisma/schema.prisma` | El esquema. `npm run verify:schema` lo valida |
| `rows.ts` | La forma de una fila |
| `mappers.ts` | Fila a dominio y vuelta |
| `seedData.ts` | Arbol, equipos, usuarios y paquetes de demostracion |

## Reglas

- **El dominio no conoce la fila.** Todo pasa por los mapeadores, y por eso el almacen de
  gobierno puede ser de memoria hoy y de base manana sin tocar el panel.
- **`seedData` es lo que hace que la aplicacion se pueda correr en local** sin base de datos.
- **La validacion del esquema corre en CI y en local** con la misma URL de validacion, declarada
  en el target de nx.

## Que NO hacer

- No cambiar el esquema sin correr `npm run verify:schema`.
- No poner datos reales de personas en `seedData`.
