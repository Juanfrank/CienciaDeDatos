# `identity-db` — almacen de identidad y gobierno

Secciones 4.7.2 y 4.10.7 del contrato de ingenieria. Base **Azure SQL dedicada y de alcance
minimo**, separada del Data Warehouse.

> Este paquete no figura en la estructura obligatoria de la seccion 3.2. Se añade porque el
> documento exige un almacen de identidad separado (4.7.2) que ademas guarda el modelo de
> gobierno (4.10.7), y no hay en 3.2 un lugar previsto para el. Ver `docs/adr/ADR-003`.

## El aislamiento no depende de disciplina de codigo

`SqlDataConnector` **nunca** debe poder leer esta base. Eso no se consigue con una convencion,
se consigue con permisos: la Managed Identity que el conector usa para alcanzar el Data
Warehouse no recibe ningun rol sobre este servidor. Ver `/infra`.

Una prueba comprueba ademas que el esquema no declara ningun modelo `Fact*` ni `Dim*`: si
alguien empezara a mezclar tablas del Data Warehouse aqui, CI se pone rojo.

## Capas

| Archivo | Que es | Se prueba |
|---|---|---|
| `prisma/schema.prisma` | El esquema. Fuente de verdad de la estructura. | `nx run identity-db:prisma-validate` |
| `src/rows.ts` | Formas de fila, escritas a mano. | Prueba de coherencia contra el esquema |
| `src/mappers.ts` | Fila -> tipo de dominio. Funciones **puras**. | Pruebas unitarias, sin base de datos |
| `src/seedData.ts` | Datos de arranque de staging. | Pasan por los mapeadores reales |
| `prisma/seed.ts` | Escribe `seedData` en la base. | Requiere base viva |

Los tipos de fila se escriben a mano en vez de usar los generados por Prisma para que los
mapeadores se prueben sin cliente ni motor de consulta. El riesgo de esa decision —que el
esquema cambie y las formas no— lo cubre una prueba de coherencia en `mappers.spec.ts`.

## Decisiones que conviene conocer antes de tocar esto

- **Los `AccessScope` no se borran en cascada.** Todas sus relaciones son `NoAction`. Un ambito
  es configuracion referenciada y auditada: borrar un equipo no puede llevarse por delante el
  ambito que otros nodos usan. Ademas, SQL Server rechaza los caminos de cascada multiples.
- **La papelera no es un borrado.** `NavNode.deletedAt` saca el nodo del arbol vigente pero lo
  conserva para restaurarlo (4.1). Un nodo cuyo ancestro esta en papelera **no** se recuelga de
  la raiz: hacerlo lo sacaria de una carpeta restrictiva y ampliaria su ambito en silencio.
- **Una fila de restriccion corrupta se trata como restriccion vacia**, nunca como ausencia de
  restriccion. Lo primero no deja ver nada; lo segundo ampliaria el acceso sin que nadie lo note.
- **Un rol desconocido cae a `visor`**, el minimo privilegio, no al intermedio.
- **Una excepcion de ampliacion revocada deja de ampliar** y el ambito vuelve a restringir.

## Puesta en marcha

```bash
export IDENTITY_DATABASE_URL="sqlserver://...;database=identidad;..."
npx prisma validate --schema packages/identity-db/prisma/schema.prisma
npx prisma migrate dev --schema packages/identity-db/prisma/schema.prisma --name init
npx prisma db seed --schema packages/identity-db/prisma/schema.prisma
```

El seed crea la organizacion general de arranque —tres niveles de carpetas anidadas— y **dos
equipos con ambitos distintos**, que es el entregable que exige la seccion 8.1:

| Equipo | Nodos concedidos | Ambito general |
|---|---|---|
| Equipo Distrito Norte | carpeta `Regional` completa | Materia en Penal, Civil |
| Equipo Distrito Este | solo carpeta `Distrito Este` | sin restriccion propia |

Ana pertenece a los dos, para poder comprobar que el ambito depende del **equipo activo** y no
de la union implicita de todos sus equipos.

## Pendiente

- Capa de repositorio con cliente de Prisma que implemente los puertos de `@app/auth`
  (`ILocalIdentityStore`, `ISessionStore`, `IAuditLog`). Se escribe junto al shell, que es
  quien la consume, para no añadir el cliente de Prisma a un paquete que hoy no lo necesita.
- Migracion inicial (`prisma migrate`), que requiere una base viva contra la que generarla.
