import type { AppRole, Team } from './Team';

/** La institucion no puede quedarse sin ningun Administrador — seccion 4.10.1. */

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

/** Determina si pasar de `before` a `after` deja la institucion sin ningun Administrador. */
export function wouldLeaveNoAdministrator(
  before: Team[],
  after: Team[],
): LastAdministratorDenial | null {
  const administratorsBefore = administratorsOf(before);
  if (administratorsBefore.length === 0) return null;

  const administratorsAfter = administratorsOf(after);
  if (administratorsAfter.length > 0) return null;

  return {
    before: administratorsBefore,
    reason:
      `El cambio dejaria la aplicacion sin ningun Administrador. Administrar el gobierno exige ` +
      `ese rol y el rol se concede desde el gobierno, asi que nadie podria volver a nombrar a ` +
      `uno: haria falta restituirlo desde la base de datos (ver el procedimiento de acceso de ` +
      `emergencia). Nombre antes a otro Administrador. ` +
      `Ahora mismo administra${administratorsBefore.length === 1 ? '' : 'n'}: ` +
      `${administratorsBefore.join(', ')}.`,
  };
}
