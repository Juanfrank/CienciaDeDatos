/**
 * Almacen de identidad y gobierno — secciones 4.7.2 y 4.10.7.
 *
 * Base dedicada y de alcance minimo (Azure SQL), separada del Data Warehouse y nunca
 * accesible desde SqlDataConnector. El esquema vive en `prisma/schema.prisma`.
 *
 * Este paquete expone los MAPEADORES entre filas y tipos de dominio, como funciones puras
 * probables sin base de datos. La capa de repositorio que usa el cliente de Prisma es delgada
 * y se limita a leer filas y pasarlas por aqui.
 */
export {
  buildNavTree,
  buildPackageTree,
  buildScopeLookup,
  parseAllowedValues,
  serializeAllowedValues,
  toAccessScope,
  toAppRole,
  toGovernedUser,
  toTeam,
  type ScopeLookup,
} from './mappers';
export type * from './rows';
