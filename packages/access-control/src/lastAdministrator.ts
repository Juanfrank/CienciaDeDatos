import type { AppRole, Team } from './Team';

/**
 * La institucion no puede quedarse sin ningun Administrador — seccion 4.10.1.
 *
 * El modelo de permisos es circular por diseno, y es correcto que lo sea: administrar el
 * gobierno exige el rol Administrador, y el rol Administrador se concede desde el gobierno. La
 * consecuencia es que si el ultimo Administrador pierde su rol, NADIE puede devolverselo ni
 * nombrar a otro: el panel exige ser Administrador para entrar.
 *
 * La matriz de 4.10.1 comprueba el permiso de QUIEN hace el cambio. Esta comprobacion es de otra
 * naturaleza —mira el ESTADO EN QUE QUEDA el sistema, no quien lo propone— y por eso vive aqui
 * al lado de `wouldExpand`, que hace lo mismo con el ambito: las dos responden a "¿que pasa si
 * guardo esto?" y no a "¿puede esta persona guardar algo?".
 *
 * Que sea una funcion pura sobre el resultado propuesto es lo que permite comprobarla antes de
 * escribir, en vez de descubrir el problema cuando ya nadie puede entrar.
 */

const ADMINISTRADOR: AppRole = 'administrador';

/** Personas con rol Administrador en CUALQUIER equipo. Administrar no es por equipo (4.10.1). */
export function administratorsOf(teams: Team[]): string[] {
  return [
    ...new Set(
      teams.flatMap((t) => t.members.filter((m) => m.role === ADMINISTRADOR).map((m) => m.userId)),
    ),
  ].sort();
}

export interface LastAdministratorDenial {
  /** Quienes administraban antes del cambio. Siempre al menos uno, o no habria denegacion. */
  before: string[];
  reason: string;
}

/**
 * Determina si pasar de `before` a `after` deja la institucion sin ningun Administrador.
 *
 * Recibe los dos estados, y no solo el propuesto, por una razon que importa: si el sistema YA
 * esta sin Administradores —tras una restauracion de emergencia, o con una semilla que no
 * declara ninguno— denegar todo cambio dejaria el gobierno bloqueado para siempre, incluido el
 * cambio que lo arregla. La comprobacion no es "el resultado tiene Administradores" sino "este
 * cambio SE LLEVA al ultimo".
 */
export function wouldLeaveNoAdministrator(
  before: Team[],
  after: Team[],
): LastAdministratorDenial | null {
  const antes = administratorsOf(before);
  if (antes.length === 0) return null;

  const despues = administratorsOf(after);
  if (despues.length > 0) return null;

  return {
    before: antes,
    reason:
      `El cambio dejaria la aplicacion sin ningun Administrador. Administrar el gobierno exige ` +
      `ese rol y el rol se concede desde el gobierno, asi que nadie podria volver a nombrar a ` +
      `uno: haria falta restituirlo desde la base de datos (ver el procedimiento de acceso de ` +
      `emergencia). Nombre antes a otro Administrador. ` +
      `Ahora mismo administra${antes.length === 1 ? '' : 'n'}: ${antes.join(', ')}.`,
  };
}
