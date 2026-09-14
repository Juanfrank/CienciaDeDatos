import { randomUUID } from 'node:crypto';
import { ICON_NAMES, initialCatalog } from '@app/ui-components';
import { PermissionError, assertCan } from '@app/access-control';
import type { Actor } from '@app/access-control';
import { leer, write } from './almacenCompartido';
import { AdminError } from './admin';
import { changeRecord } from './audit';

/**
 * Gobierno SOBRE el catalogo de objetos — seccion 4.5.
 *
 * El catalogo es CODIGO: `initialCatalog` es una constante, y cada version declara pruebas en
 * verde y revision por pares. Eso no es un accidente que haya que corregir, es lo que 4.5 pide, y
 * por eso el permiso del Colaborador es «proponer objetos al repositorio» y no «crear objetos».
 *
 * Lo que el panel gobierna, entonces, no es el objeto: es la DECISION sobre el objeto. Dos cosas,
 * y las dos son metadato que vive aqui y no en el codigo:
 *
 * 1. Que una version propuesta se acepte o se devuelva, con quien lo decidio y por que.
 * 2. Que un objeto certificado deje de ofrecerse en el editor sin desaparecer de los modulos que
 *    ya lo tienen — retirar y romper no son lo mismo.
 */

export const KEY_CATALOG = 'app:catalogo:gobierno';

/**
 * El prefijo con el que un recurso que NO es objeto vive en este almacen.
 *
 * Vive aqui, y no junto a la tabla que lo dibuja, porque el conjunto de deshabilitados vive aqui:
 * poniendolo del otro lado, `recursos.ts` y `catalogo.ts` se importarian el uno al otro.
 */
export const ICON_PREFIX = 'icono:';
export const IMAGE_PREFIX = 'imagen:';

export type ProposalStatus = 'pendiente' | 'aprobada' | 'devuelta';

export interface ResourceProposal {
  id: string;
  /** El objeto al que afecta. Puede no existir todavia: se propone incorporarlo. */
  objectId: string;
  /** La version que se propone certificar. */
  version: string;
  /** Que cambia, en palabras. Es el changelog de 4.5 antes de serlo. */
  summary: string;
  proposedBy: string;
  proposedAt: string;
  status: ProposalStatus;
  decidedBy?: string;
  decidedAt?: string;
  /** Obligatorio al devolver: sin motivo, quien propuso no sabe que arreglar. */
  motivo?: string;
}

interface CatalogGovernance {
  /** Objetos que el editor no ofrece, aunque sigan certificados. */
  disabled: string[];
  proposals: ResourceProposal[];
}

const VACIO: CatalogGovernance = { disabled: [], proposals: [] };

async function leerGobierno(): Promise<CatalogGovernance> {
  const guardado = await leer<CatalogGovernance>(KEY_CATALOG);
  return { ...VACIO, ...guardado };
}

/**
 * Extiende `AdminError` a proposito, no por herencia decorativa.
 *
 * `withAdmin` mapea el `status` de un `AdminError` a la respuesta y todo lo demas a un 400. Un
 * error propio sin ese parentesco convertiria «esa propuesta ya esta decidida» (409) y «no
 * encontrada» (404) en el mismo 400, que es peor que no distinguirlos: dice algo falso.
 */
export class CatalogError extends AdminError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'CatalogError';
  }
}

function permiso(actor: Actor, capacidad: Parameters<typeof assertCan>[1]): void {
  try {
    assertCan(actor.role, capacidad);
  } catch (error) {
    if (error instanceof PermissionError) throw new CatalogError(error.message, 403);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Deshabilitar un recurso
// ---------------------------------------------------------------------------

export async function disabledResources(): Promise<Set<string>> {
  return new Set((await leerGobierno()).disabled);
}

/**
 * Los identificadores que se pueden deshabilitar.
 *
 * Dos espacios de nombres en el mismo conjunto. Un objeto del catalogo va por su `objectId` a
 * secas; un icono o una imagen —que no son objetos, se usan DENTRO de uno— llevan prefijo. El
 * prefijo no es decorativo: sin el, un icono llamado `tabla` y el objeto `tabla` serian la misma
 * clave, y deshabilitar uno apagaria el otro.
 */
function recursoConocido(id: string): boolean {
  if (id.startsWith(ICON_PREFIX)) {
    return (ICON_NAMES as readonly string[]).includes(id.slice(ICON_PREFIX.length));
  }
  if (id.startsWith(IMAGE_PREFIX)) return id.length > IMAGE_PREFIX.length;
  return initialCatalog.some((o) => o.objectId === id);
}

/**
 * Deja de ofrecer un objeto en el editor, sin tocar los modulos que ya lo tienen.
 *
 * Es la diferencia entre retirar y romper. Un objeto que se deshabilita deja de aparecer en la
 * paleta —nadie coloca uno nuevo— y los veinte modulos que lo llevan siguen dibujandose igual.
 * Borrarlo del catalogo los dejaria rotos a todos a la vez, y sin aviso.
 */
export async function setResourceDisabled(
  actor: Actor,
  objectId: string,
  disabled: boolean,
): Promise<void> {
  permiso(actor, 'proponer-objetos-al-repositorio');
  if (!recursoConocido(objectId)) {
    throw new CatalogError(`El catalogo no tiene ningun recurso '${objectId}'.`, 404);
  }

  const gobierno = await leerGobierno();
  const actuales = new Set(gobierno.disabled);
  if (disabled) actuales.add(objectId);
  else actuales.delete(objectId);

  await write(KEY_CATALOG, { ...gobierno, disabled: [...actuales] });
  await changeRecord({
    actorId: actor.userId,
    entityType: 'object',
    entityId: objectId,
    action: disabled ? 'disable' : 'enable',
    before: { deshabilitado: gobierno.disabled.includes(objectId) },
    after: { deshabilitado: disabled },
  });
}

// ---------------------------------------------------------------------------
// Propuestas
// ---------------------------------------------------------------------------

export async function listProposals(): Promise<ResourceProposal[]> {
  const { proposals } = await leerGobierno();
  // Lo que espera decision va primero: es lo unico accionable de la lista.
  return [...proposals].sort(
    (a, b) =>
      Number(b.status === 'pendiente') - Number(a.status === 'pendiente') ||
      b.proposedAt.localeCompare(a.proposedAt),
  );
}

export async function proposeResource(
  actor: Actor,
  entrada: { objectId: string; version: string; summary: string },
): Promise<ResourceProposal> {
  permiso(actor, 'proponer-objetos-al-repositorio');

  const summary = entrada.summary.trim();
  if (!summary) {
    // El changelog es obligatorio por version (4.5). Una propuesta sin el no se puede revisar.
    throw new CatalogError('La propuesta necesita decir que cambia.', 400);
  }
  if (!/^\d+\.\d+\.\d+$/.test(entrada.version)) {
    throw new CatalogError(`'${entrada.version}' no es una version MAYOR.MENOR.PARCHE.`, 400);
  }

  const gobierno = await leerGobierno();
  const repetida = gobierno.proposals.find(
    (p) =>
      p.status === 'pendiente' && p.objectId === entrada.objectId && p.version === entrada.version,
  );
  if (repetida) {
    throw new CatalogError('Ya hay una propuesta pendiente para ese objeto y esa version.', 409);
  }

  const propuesta: ResourceProposal = {
    id: randomUUID(),
    objectId: entrada.objectId,
    version: entrada.version,
    summary,
    proposedBy: actor.userId,
    proposedAt: new Date().toISOString(),
    status: 'pendiente',
  };

  await write(KEY_CATALOG, { ...gobierno, proposals: [...gobierno.proposals, propuesta] });
  await changeRecord({
    actorId: actor.userId,
    entityType: 'object',
    entityId: entrada.objectId,
    action: 'submit',
    after: { version: entrada.version, resumen: summary },
  });
  return propuesta;
}

export async function decideProposal(
  actor: Actor,
  id: string,
  decision: 'aprobar' | 'devolver',
  motivo?: string,
): Promise<ResourceProposal> {
  // Certificar es publicar: el mismo permiso que publicar un modulo institucional.
  permiso(actor, 'publicar-modulo-institucional');

  const gobierno = await leerGobierno();
  const propuesta = gobierno.proposals.find((p) => p.id === id);
  if (!propuesta) throw new CatalogError('Propuesta no encontrada.', 404);
  if (propuesta.status !== 'pendiente') {
    throw new CatalogError('Esa propuesta ya esta decidida.', 409);
  }
  if (decision === 'devolver' && !motivo?.trim()) {
    throw new CatalogError('Devolver exige un motivo.', 400);
  }

  const decidida: ResourceProposal = {
    ...propuesta,
    status: decision === 'aprobar' ? 'aprobada' : 'devuelta',
    decidedBy: actor.userId,
    decidedAt: new Date().toISOString(),
    ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
  };

  await write(KEY_CATALOG, {
    ...gobierno,
    proposals: gobierno.proposals.map((p) => (p.id === id ? decidida : p)),
  });
  await changeRecord({
    actorId: actor.userId,
    entityType: 'object',
    entityId: propuesta.objectId,
    action: decision === 'aprobar' ? 'publish' : 'withdraw',
    before: { estado: propuesta.status },
    after: {
      estado: decidida.status,
      version: propuesta.version,
      ...(decidida.motivo ? { motivo: decidida.motivo } : {}),
    },
  });
  return decidida;
}
