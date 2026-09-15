import { randomUUID } from 'node:crypto';
import { ICON_NAMES, initialCatalog, validatePresentation } from '@app/ui-components';
import type { ObjectPresentation, PresentationKey } from '@app/ui-components';
import { PermissionError, assertCan } from '@app/access-control';
import type { Actor } from '@app/access-control';
import { leer, mutar } from './almacenCompartido';
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
 * 3. Con QUE presentacion nace un objeto recien colocado.
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
  /**
   * La presentacion con la que NACE cada objeto colocado, por `objectId`.
   *
   * Es una decision de la institucion, no de cada persona que edita: si aqui todas las barras
   * llevan la leyenda abajo y sin rejilla, eso se decide UNA vez y no quince, una por cada quien
   * que coloque un grafico y se acuerde. Lo que no hace es congelar nada — quien edita sigue
   * cambiandolo objeto por objeto; esto solo mueve el punto de partida.
   */
  defaults: Record<string, ObjectPresentation>;
}

const VACIO: CatalogGovernance = { disabled: [], proposals: [], defaults: {} };

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

  // Bajo turno: el gobierno del catalogo es UN valor, y deshabilitar dos objetos a la vez
  // significaba que el segundo en escribir devolvia el primero a habilitado.
  const gobierno = await leerGobierno();
  await mutar<CatalogGovernance>(KEY_CATALOG, (guardado) => {
    const actual = guardado ?? VACIO;
    const actuales = new Set(actual.disabled);
    if (disabled) actuales.add(objectId);
    else actuales.delete(objectId);
    return { ...actual, disabled: [...actuales] };
  });
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
// La presentacion de salida de cada objeto
// ---------------------------------------------------------------------------

/**
 * Las claves que la ULTIMA version del objeto admite.
 *
 * Del catalogo y no del registro de `context.ts`, que importa de aqui: pedirlo del otro lado
 * cerraria el ciclo entre los dos modulos. Es la misma lectura que ya hace `recursoConocido`.
 */
function admitidasDe(objectId: string): PresentationKey[] | undefined {
  const definicion = initialCatalog.find((o) => o.objectId === objectId);
  return definicion?.versions[definicion.versions.length - 1]?.presentation;
}

export async function defaultPresentations(): Promise<Record<string, ObjectPresentation>> {
  return (await leerGobierno()).defaults;
}

/**
 * Fija con que presentacion nace un objeto recien colocado.
 *
 * Se valida contra lo que la version declara admitir, y no por formalidad: una clave que el objeto
 * no ensena se guardaria sin que el panel la dibujara nunca, y entonces no habria por donde
 * quitarla. Guardar `{}` es borrar el predeterminado, que es como se vuelve atras.
 */
export async function setDefaultPresentation(
  actor: Actor,
  objectId: string,
  presentation: ObjectPresentation,
): Promise<ObjectPresentation> {
  permiso(actor, 'proponer-objetos-al-repositorio');

  const admitidas = admitidasDe(objectId);
  if (!admitidas) {
    throw new CatalogError(`El catalogo no tiene ningun objeto '${objectId}'.`, 404);
  }
  const problemas = validatePresentation(presentation, admitidas);
  if (problemas.length > 0) {
    throw new CatalogError(
      `La presentacion no vale para '${objectId}': ` +
        problemas.map((p) => `${p.clave} — ${p.issue}`).join(' '),
      400,
    );
  }

  // Vacio BORRA la entrada en vez de dejar un `{}` guardado: un objeto sin predeterminado y un
  // objeto con un predeterminado que no dice nada son lo mismo, y guardar los dos hace que la
  // tabla ensene «configurado» sobre algo que no configura nada.
  const vacia = Object.keys(presentation).length === 0;
  const gobierno = await leerGobierno();
  await mutar<CatalogGovernance>(KEY_CATALOG, (guardado) => {
    const actual = { ...VACIO, ...guardado };
    const defaults = { ...actual.defaults };
    if (vacia) delete defaults[objectId];
    else defaults[objectId] = presentation;
    return { ...actual, defaults };
  });

  await changeRecord({
    actorId: actor.userId,
    entityType: 'object',
    entityId: objectId,
    action: 'update',
    before: { predeterminado: gobierno.defaults[objectId] ?? null },
    after: { predeterminado: vacia ? null : presentation },
  });

  return presentation;
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

  const propuesta: ResourceProposal = {
    id: randomUUID(),
    objectId: entrada.objectId,
    version: entrada.version,
    summary,
    proposedBy: actor.userId,
    proposedAt: new Date().toISOString(),
    status: 'pendiente',
  };

  // La comprobacion de duplicado va DENTRO del turno. Fuera, dos envios simultaneos del mismo
  // objeto y la misma version la pasaban los dos, y el catalogo acababa con dos propuestas
  // pendientes identicas que habria que decidir por separado.
  let repetida = false;
  await mutar<CatalogGovernance>(KEY_CATALOG, (guardado) => {
    const actual = guardado ?? VACIO;
    repetida = actual.proposals.some(
      (p) =>
        p.status === 'pendiente' &&
        p.objectId === entrada.objectId &&
        p.version === entrada.version,
    );
    return repetida ? actual : { ...actual, proposals: [...actual.proposals, propuesta] };
  });
  if (repetida) {
    throw new CatalogError('Ya hay una propuesta pendiente para ese objeto y esa version.', 409);
  }
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

  if (decision === 'devolver' && !motivo?.trim()) {
    throw new CatalogError('Devolver exige un motivo.', 400);
  }

  /*
   * Encontrar la propuesta, comprobar que sigue pendiente y decidirla van en el MISMO turno.
   *
   * Separados, dos revisores que abren la lista a la vez pueden decidir la misma propuesta: los
   * dos la leen pendiente, los dos pasan la comprobacion, y la que queda escrita es la del que
   * llegue el ultimo. Quedaria decidida por quien no fue y con el motivo del otro.
   */
  let propuesta: ResourceProposal | undefined;
  let yaDecidida = false;
  let decidida: ResourceProposal | undefined;

  await mutar<CatalogGovernance>(KEY_CATALOG, (guardado) => {
    const actual = guardado ?? VACIO;
    propuesta = actual.proposals.find((p) => p.id === id);
    if (!propuesta) return actual;
    if (propuesta.status !== 'pendiente') {
      yaDecidida = true;
      return actual;
    }
    decidida = {
      ...propuesta,
      status: decision === 'aprobar' ? 'aprobada' : 'devuelta',
      decidedBy: actor.userId,
      decidedAt: new Date().toISOString(),
      ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
    };
    const ya = decidida;
    return { ...actual, proposals: actual.proposals.map((p) => (p.id === id ? ya : p)) };
  });

  if (!propuesta) throw new CatalogError('Propuesta no encontrada.', 404);
  if (yaDecidida || !decidida) throw new CatalogError('Esa propuesta ya esta decidida.', 409);
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
