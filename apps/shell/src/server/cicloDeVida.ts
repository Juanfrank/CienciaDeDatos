import {
  type AppRole,
  type NavNode,
  PermissionError,
  applyTreeOperation,
  assertCan,
  findModulePath,
  isFolder,
  isModule,
} from '@app/access-control';
import {
  MODULE_OPTIONS,
  navigatorProblems,
  type DefaultFilter,
  type PageNavigatorSettings,
  type ModuleDefinition,
  type ModuleDiff,
  type ModuleOption,
  type ModuleStatus,
  type PublishBlocker,
  diffModules,
  findPublishBlockers,
} from '@app/module-model';
import { roleMoreHeightOf } from './admin';
import { navigationFor } from './context';
import { auditList, changeRecord, treeEventRecord } from './audit';
import { governance } from './governance';
import { moduloEncendido, disabledSlugs } from './settings';
import { initialCatalog, bumpInstance } from '@app/ui-components';
import { modules, type PublishedVersion } from './moduleStore';
import { definitionDiagnose } from './data';
import type { ShellSession } from './session';

/** Ciclo de vida de un modulo — seccion 4.1. */

export class CicloDeVidaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'CicloDeVidaError';
  }
}

export interface ModuleActor {
  userId: string;
  role: AppRole;
}

/** Visibilidad por estado — la parte de 4.1 con consecuencias de seguridad. */
export function seeCan(module: ModuleDefinition, actor: ModuleActor): boolean {
  if (module.status === 'publicado') return true;
  if (module.ownerUserId === actor.userId) return true;
  return module.status === 'pendiente-de-aprobacion' && actor.role === 'administrador';
}

/** Modulos que este actor puede ver, ya filtrados por estado. */
export async function visibleModules(actor: ModuleActor): Promise<ModuleDefinition[]> {
  return (await modules.list()).filter((m) => seeCan(m, actor));
}

/** Solo el autor de un borrador lo edita. Tampoco un Administrador. */
function authorshipRequire(module: ModuleDefinition, actor: ModuleActor): void {
  if (module.ownerUserId === actor.userId) return;
  throw new CicloDeVidaError('Ese borrador es de otra persona.', 403);
}

function permission(actor: ModuleActor, capacidad: Parameters<typeof assertCan>[1]): void {
  try {
    assertCan(actor.role, capacidad);
  } catch (error) {
    if (error instanceof PermissionError) {
      throw new CicloDeVidaError(error.message, 403, error.denial);
    }
    throw error;
  }
}

/** Transiciones permitidas. Cualquier otra es un error, no un cambio silencioso. */
const TRANSICIONES: Record<ModuleStatus, ModuleStatus[]> = {
  borrador: ['pendiente-de-aprobacion'],
  'pendiente-de-aprobacion': ['publicado', 'borrador'],
  // Un publicado se puede RETIRAR a borrador. Es la unica salida, y existe porque la
  // alternativa —que un modulo publicado con un fallo no se pueda quitar de la vista de todos
  // sin desplegar codigo— es peor que el riesgo de que alguien lo retire por error, que queda
  // registrado y es reversible.
  publicado: ['borrador'],
};

function transitionRequire(desde: ModuleStatus, hasta: ModuleStatus): void {
  if (!TRANSICIONES[desde].includes(hasta)) {
    throw new CicloDeVidaError(
      `No se puede pasar de '${desde}' a '${hasta}'. Desde '${desde}' solo cabe: ` +
        `${TRANSICIONES[desde].join(', ') || 'ningun otro estado'}.`,
      409,
    );
  }
}

const ahora = (): string => new Date().toISOString();

/** Copia profunda de las paginas: lo restaurado no puede compartir objetos con el historial. */
const clonarPaginas = (paginas: ModuleDefinition['pages']): ModuleDefinition['pages'] =>
  JSON.parse(JSON.stringify(paginas)) as ModuleDefinition['pages'];

export interface CreateDraftInput {
  actor: ModuleActor;
  name: string;
  slug: string;
}

export async function createDraft(input: CreateDraftInput): Promise<ModuleDefinition> {
  permission(input.actor, 'crear-editar-modulos-borrador');

  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  if (!name) throw new CicloDeVidaError('El modulo necesita un nombre.', 400);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new CicloDeVidaError(
      'El slug solo admite minusculas, numeros y guiones: es parte de la URL del modulo (4.11).',
      400,
    );
  }
  if (await modules.bySlug(slug)) {
    throw new CicloDeVidaError('Ya existe un modulo con ese slug.', 409);
  }

  const momento = ahora();
  const modulo: ModuleDefinition = {
    moduleId: `mod-${crypto.randomUUID()}`,
    slug,
    name,
    status: 'borrador',
    ownerUserId: input.actor.userId,
    // Un borrador empieza con una pagina vacia y no con cero paginas: cero paginas no se puede
    // abrir, y el editor tendria que tratar ese caso aparte en cada pantalla.
    pages: [{ pageId: `pag-${crypto.randomUUID()}`, slug: 'general', name: 'General', items: [] }],
    version: 1,
    createdAt: momento,
    updatedAt: momento,
  };

  await modules.save(modulo);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'create',
    after: { slug: modulo.slug, name: modulo.name, status: modulo.status },
  });

  return modulo;
}

/**
 * Abre una REVISION de un modulo publicado: un borrador aparte, sin tocar lo que se sirve.
 *
 * Es la accion «editar» de la tabla de modulos. Lo que hacia antes era devolver el modulo a
 * borrador, y eso lo retiraba de la navegacion de toda la institucion mientras alguien cambiaba
 * una palabra. Ahora el publicado se queda donde esta y lo que se edita es una copia, que pasa
 * por la misma aprobacion que cualquier otra propuesta (4.1).
 *
 * Solo puede haber UNA revision viva por modulo. Dos serian dos personas editando lo mismo sin
 * saberlo, y la segunda en publicar se llevaria por delante el trabajo de la primera sin que
 * nadie viera el choque.
 */
export async function createRevision(input: {
  actor: ModuleActor;
  moduleId: string;
}): Promise<ModuleDefinition> {
  permission(input.actor, 'crear-editar-modulos-borrador');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  if (modulo.status !== 'publicado') {
    throw new CicloDeVidaError(
      'Solo lo publicado se revisa: un borrador se edita directamente.',
      409,
    );
  }

  const abierta = (await modules.list()).find((m) => m.revisionOf === modulo.moduleId);
  if (abierta) {
    throw new CicloDeVidaError(
      `Ya hay una revision abierta de este modulo, a cargo de ${abierta.ownerUserId ?? 'nadie'}.`,
      409,
    );
  }

  const momento = ahora();
  const revision: ModuleDefinition = {
    ...modulo,
    moduleId: `mod-${crypto.randomUUID()}`,
    // El slug no se sirve mientras es revision —solo se sirve lo publicado—, pero tiene que ser
    // unico igual: es la clave por la que se busca un modulo, y dos iguales harian que
    // `bySlug` devolviera cualquiera de los dos.
    slug: `${modulo.slug}-revision`,
    status: 'borrador',
    ownerUserId: input.actor.userId,
    revisionOf: modulo.moduleId,
    pages: clonarPaginas(modulo.pages),
    createdAt: momento,
    updatedAt: momento,
  };

  await modules.save(revision);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: revision.moduleId,
    action: 'create',
    after: { slug: revision.slug, name: revision.name, revisionDe: modulo.moduleId },
  });

  return revision;
}

export interface SaveDraftInput {
  actor: ModuleActor;
  moduleId: string;
  cambios: Partial<Pick<ModuleDefinition, 'name' | 'icon' | 'pages'>>;
}

/** Guarda cambios en un borrador. */
export async function saveDraft(input: SaveDraftInput): Promise<ModuleDefinition> {
  permission(input.actor, 'crear-editar-modulos-borrador');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);

  // El estado va ANTES que la autoria: un modulo publicado no tiene autor —pertenece a la
  // institucion— y preguntar por su autor primero responderia "es de otra persona", que no es
  // lo que pasa ni dice que hacer.
  if (modulo.status !== 'borrador') {
    throw new CicloDeVidaError(
      `Un modulo '${modulo.status}' no se edita en el sitio. Retirelo a borrador primero.`,
      409,
    );
  }

  authorshipRequire(modulo, input.actor);

  const actualizado: ModuleDefinition = {
    ...modulo,
    ...(input.cambios.name !== undefined ? { name: input.cambios.name.trim() } : {}),
    ...(input.cambios.icon !== undefined ? { icon: input.cambios.icon } : {}),
    ...(input.cambios.pages !== undefined ? { pages: input.cambios.pages } : {}),
    updatedAt: ahora(),
  };

  await modules.save(actualizado);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'update',
    before: { name: modulo.name, paginas: modulo.pages.length },
    after: { name: actualizado.name, paginas: actualizado.pages.length },
  });

  return actualizado;
}

/** Diagnostico del modulo tal como lo veria el editor. */
export async function publicationLocks(module: ModuleDefinition): Promise<PublishBlocker[]> {
  return findPublishBlockers(await definitionDiagnose(module));
}

export interface InputTransition {
  actor: ModuleActor;
  moduleId: string;
  /** Obligatoria al devolver a borrador o retirar: sin motivo, nadie sabe que arreglar. */
  motivo?: string;
  /** Version de la que sale el contenido, cuando la publicacion es una vuelta atras. */
  restoredFrom?: number;
}

/** borrador -> pendiente-de-aprobacion. Lo hace el autor: es una propuesta, no una publicacion. */
export async function sendApproval(input: InputTransition): Promise<ModuleDefinition> {
  permission(input.actor, 'crear-editar-modulos-borrador');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  authorshipRequire(modulo, input.actor);
  transitionRequire(modulo.status, 'pendiente-de-aprobacion');

  // Se comprueba YA, no solo al publicar. Mandar a revisar algo roto gasta el tiempo de quien
  // revisa en encontrar lo que la maquina sabe decir sola.
  const locks = await publicationLocks(modulo);
  if (locks.length > 0) {
    throw new CicloDeVidaError(
      'El modulo tiene problemas que impiden proponerlo para publicacion.',
      422,
      locks,
    );
  }

  const actualizado = { ...modulo, status: 'pendiente-de-aprobacion' as const, updatedAt: ahora() };
  await modules.save(actualizado);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'submit',
    before: { status: modulo.status },
    after: { status: actualizado.status },
  });

  return actualizado;
}

/** pendiente-de-aprobacion -> publicado. Solo un Administrador, y solo sin bloqueos. */
export async function publicar(input: InputTransition): Promise<ModuleDefinition> {
  permission(input.actor, 'publicar-modulo-institucional');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  transitionRequire(modulo.status, 'publicado');

  const locks = await publicationLocks(modulo);
  if (locks.length > 0) {
    throw new CicloDeVidaError(
      'El modulo no se puede publicar con problemas sin resolver.',
      422,
      locks,
    );
  }

  /*
   * Una REVISION se publica SOBRE el modulo que revisa, conservando su `moduleId`.
   *
   * De ese identificador cuelgan el nodo del arbol, lo concedido a cada equipo y a cada persona,
   * los paquetes visuales que lo listan y la personalizacion de quien lo haya tocado. Publicarla
   * como un modulo nuevo dejaria todo eso apuntando a la version vieja, que ademas seguiria
   * publicada: dos modulos iguales, uno de ellos el que todo el mundo tiene concedido.
   *
   * Y el slug que gana es el del ORIGINAL, no el `-revision` con el que nacio la copia: el slug
   * es la URL, y las direcciones que alguien tenga guardadas tienen que seguir valiendo (4.11).
   */
  const revisado = modulo.revisionOf ? await modules.get(modulo.revisionOf) : undefined;
  if (modulo.revisionOf && !revisado) {
    throw new CicloDeVidaError(
      'El modulo que esta revision cambiaba ya no existe, asi que no hay donde publicarla.',
      409,
    );
  }

  const base = revisado ?? modulo;
  const actualizado: ModuleDefinition = {
    ...modulo,
    moduleId: base.moduleId,
    slug: base.slug,
    createdAt: base.createdAt,
    status: 'publicado',
    version: base.version + 1,
    // Un modulo publicado a nivel institucional deja de pertenecer a una persona: pertenece a
    // la institucion (4.1). Conservar el autor haria pensar que sigue siendo suyo y que puede
    // cambiarlo sin pasar por aqui.
    ownerUserId: undefined,
    updatedAt: ahora(),
  };
  delete actualizado.ownerUserId;
  delete actualizado.revisionOf;

  await modules.save(actualizado);
  // La foto se guarda DESPUES de que la publicacion sea firme, y antes de colgar el modulo del
  // arbol: si lo que falla es el arbol, lo publicado ya esta y el historial lo refleja.
  await modules.versionRecord({
    moduleId: actualizado.moduleId,
    version: actualizado.version,
    publishedAt: actualizado.updatedAt,
    publishedBy: input.actor.userId,
    ...(input.restoredFrom === undefined ? {} : { restoredFrom: input.restoredFrom }),
    definition: actualizado,
  });
  // La copia se retira DESPUES de que lo publicado este guardado. Al reves, un fallo al guardar
  // dejaria el trabajo borrado y el modulo sin cambiar.
  if (revisado) await modules.remove(modulo.moduleId);
  await missingIfTreeAttach(actualizado, input.actor);
  await sincronizarRefEnArbol(actualizado, input.actor);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: actualizado.moduleId,
    action: 'publish',
    before: { status: modulo.status, version: modulo.version, autor: modulo.ownerUserId },
    after: {
      status: actualizado.status,
      version: actualizado.version,
      ...(input.restoredFrom === undefined ? {} : { restauradoDe: input.restoredFrom }),
    },
  });

  return actualizado;
}

/**
 * Lo que espera una decision, con lo que hace falta para tomarla.
 *
 * Hoy la aprobacion ocurre en `/editor`, mezclada con los borradores propios de quien mira. Un
 * Administrador que revisa una propuesta tiene que reconocerla entre los suyos, abrirla, y
 * acordarse de como estaba antes. Aqui esta separado y con el cambio delante: quien aprueba sin
 * ver que cambia esta firmando en blanco.
 */
export interface PendingReview {
  module: ModuleDefinition;
  /** Quien la propuso. Sale de la auditoria, que es donde consta el acto de proponer. */
  proposedBy?: string;
  proposedAt?: string;
  /** Contra la ultima version publicada. Ausente si el modulo nunca se publico. */
  diff?: ModuleDiff;
  /** Lo que impide publicarlo hoy, si lo hay. */
  locks: PublishBlocker[];
}

export async function pendingReviews(actor: ModuleActor): Promise<PendingReview[]> {
  permission(actor, 'publicar-modulo-institucional');

  const esperando = (await modules.list()).filter(
    (m) => m.status === 'pendiente-de-aprobacion',
  );
  const eventos = await auditList();

  return Promise.all(
    esperando.map(async (module) => {
      // El evento de propuesta mas reciente de ESTE modulo. Se busca del final hacia atras
      // porque un modulo puede haberse propuesto, devuelto y vuelto a proponer.
      const propuesta = [...eventos]
        .reverse()
        .find((e) => e.entityId === module.moduleId && e.action === 'submit');

      /*
       * Una REVISION se compara con el modulo que revisa, no consigo misma.
       *
       * Su historial esta vacio: nacio hace un rato y nunca se publico. Quien aprueba veria «sin
       * cambios» delante de una propuesta que cambia medio tablero, y firmaria en blanco — que es
       * justo lo que esta pantalla existe para impedir.
       */
      const historial = await modules.history(module.revisionOf ?? module.moduleId);
      const ultima = historial[0];

      return {
        module,
        ...(propuesta ? { proposedBy: propuesta.actorId, proposedAt: propuesta.timestamp } : {}),
        ...(ultima ? { diff: diffModules(ultima.definition, module) } : {}),
        locks: await publicationLocks(module),
      };
    }),
  );
}

/**
 * Sube todas las instancias de un objeto dentro de un modulo a otra version — seccion 4.5.
 *
 * Lo que se conserva y lo que no lo decide `bumpInstance`, que es donde vive la regla: lo
 * configurado se queda, y solo lo que la version nueva anade cae a su defecto. Aqui lo unico que
 * se anade es el CAMINO: un modulo publicado no se modifica, se publica otra version. Un
 * borrador, en cambio, se guarda y ya — todavia no lo ve nadie.
 */
export interface BumpReport {
  module: ModuleDefinition;
  /** Cuantas instancias se subieron. */
  instancias: number;
  /** Claves de presentacion que se conservaron, sin repetir. */
  preserved: string[];
  /** Las que la version nueva ya no admite, con el objeto en el que estaban. */
  retiradas: { instanceId: string; clave: string; valor: unknown }[];
  /** Las que la version nueva anade y quedan en su valor por defecto. */
  nuevas: string[];
}

export async function bumpObjectInModule(input: {
  actor: ModuleActor;
  moduleId: string;
  objectId: string;
  hasta: string;
}): Promise<BumpReport> {
  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);

  // Subir la version de lo que TODA la institucion ve es publicar. Sobre un borrador propio basta
  // con poder editarlo.
  if (modulo.status === 'publicado') permission(input.actor, 'publicar-modulo-institucional');
  else {
    permission(input.actor, 'crear-editar-modulos-borrador');
    authorshipRequire(modulo, input.actor);
  }

  const definicion = initialCatalog.find((o) => o.objectId === input.objectId);
  if (!definicion) {
    throw new CicloDeVidaError(`El catalogo no tiene ningun objeto '${input.objectId}'.`, 404);
  }

  const preserved = new Set<string>();
  const nuevas = new Set<string>();
  const retiradas: BumpReport['retiradas'] = [];
  let instancias = 0;

  const paginas = modulo.pages.map((pagina) => ({
    ...pagina,
    items: pagina.items.map((item) => {
      if (item.instance.objectId !== input.objectId) return item;
      if (item.instance.version === input.hasta) return item;

      const r = bumpInstance(item.instance, definicion, input.hasta);
      instancias += 1;
      r.preserved.forEach((c) => preserved.add(c));
      r.nuevas.forEach((c) => nuevas.add(c));
      r.retiradas.forEach((x) =>
        retiradas.push({ instanceId: item.instance.instanceId, clave: x.clave, valor: x.valor }),
      );
      return { ...item, instance: r.instance };
    }),
  }));

  if (instancias === 0) {
    throw new CicloDeVidaError(
      `Ese modulo no tiene ninguna instancia de '${input.objectId}' por debajo de '${input.hasta}'.`,
      409,
    );
  }

  const subido: ModuleDefinition = { ...modulo, pages: paginas, updatedAt: ahora() };

  // Se comprueba ANTES de tocar el almacen, igual que al restaurar: una version nueva puede
  // exigir ranuras que este modulo no mapea, y descubrirlo despues de guardar dejaria lo que
  // esta vivo reemplazado por algo que no se puede publicar.
  const locks = await publicationLocks(subido);
  if (locks.length > 0) {
    throw new CicloDeVidaError(
      `Subir a '${input.hasta}' dejaria el modulo con problemas sin resolver.`,
      422,
      locks,
    );
  }

  const comun = {
    instancias,
    preserved: [...preserved].sort(),
    retiradas,
    nuevas: [...nuevas].sort(),
  };

  if (modulo.status !== 'publicado') {
    await modules.save(subido);
    await changeRecord({
      actorId: input.actor.userId,
      entityType: 'module',
      entityId: modulo.moduleId,
      action: 'update',
      before: { objeto: input.objectId },
      after: { objeto: input.objectId, version: input.hasta, instancias },
    });
    return { module: subido, ...comun };
  }

  await modules.save({ ...subido, status: 'pendiente-de-aprobacion' });
  try {
    const publicado = await publicar({ actor: input.actor, moduleId: input.moduleId });
    return { module: publicado, ...comun };
  } catch (error) {
    await modules.save(modulo);
    throw error;
  }
}

/**
 * El historial de versiones publicadas de un modulo.
 *
 * Pide el mismo permiso que publicar, y no el de ver el modulo. El historial dice QUIEN publico
 * cada version y cuando: es informacion de gobierno, de la misma familia que el registro de
 * auditoria, no parte de lo que un modulo muestra. Quien puede verlo es quien administra.
 */
export async function historialDe(
  actor: ModuleActor,
  moduleId: string,
): Promise<PublishedVersion[]> {
  permission(actor, 'publicar-modulo-institucional');
  return modules.history(moduleId);
}

/**
 * Vuelve a publicar el contenido de una version anterior.
 *
 * No modifica la version vieja ni la «reactiva»: publica una version NUEVA con su contenido, y
 * deja dicho de cual salio. Es lo que pide 4.5 —un objeto publicado no se toca— y ademas es lo
 * unico que deja el historial legible: una vuelta atras que reescribiera el pasado haria que el
 * registro dejara de explicar lo que la gente vio.
 *
 * Lo que se restaura es el CONTENIDO —paginas y objetos—, no el estado ni el autor: el modulo
 * sigue siendo institucional y el ciclo de vida no retrocede.
 */
export async function restaurarVersion(input: {
  actor: ModuleActor;
  moduleId: string;
  version: number;
}): Promise<ModuleDefinition> {
  permission(input.actor, 'publicar-modulo-institucional');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);

  const historial = await modules.history(input.moduleId);
  const anterior = historial.find((v) => v.version === input.version);
  if (!anterior) {
    throw new CicloDeVidaError(
      `El modulo no tiene ninguna version publicada con el numero ${input.version}.`,
      404,
    );
  }
  if (anterior.version === modulo.version) {
    throw new CicloDeVidaError('Esa version es la que esta publicada ahora mismo.', 409);
  }

  const restaurado: ModuleDefinition = {
    ...modulo,
    pages: clonarPaginas(anterior.definition.pages),
    name: anterior.definition.name,
    ...(anterior.definition.icon === undefined ? {} : { icon: anterior.definition.icon }),
    // Queda a un paso de publicarse, no en borrador: el estado intermedio existe para que
    // `publicar` acepte la transicion, y quien restaura es quien aprueba de todas formas.
    status: 'pendiente-de-aprobacion',
    updatedAt: ahora(),
  };

  /*
   * Se comprueba ANTES de tocar el almacen.
   *
   * Una version vieja puede no poder publicarse hoy: basta con que el esquema haya retirado un
   * campo que uno de sus objetos mapea. Guardar primero y descubrirlo despues dejaria el modulo
   * VIVO reemplazado por una definicion vieja y ademas rota, que es peor que no haber restaurado.
   */
  const locks = await publicationLocks(restaurado);
  if (locks.length > 0) {
    throw new CicloDeVidaError(
      `La version ${input.version} no se puede republicar: tiene problemas sin resolver.`,
      422,
      locks,
    );
  }

  await modules.save(restaurado);
  try {
    // Se publica por el MISMO camino que cualquier otra publicacion: mismas cerraduras, misma
    // auditoria, mismo historial. Dos caminos hacia «publicado» acabarian divergiendo.
    return await publicar({
      actor: input.actor,
      moduleId: input.moduleId,
      restoredFrom: input.version,
    });
  } catch (error) {
    // Y si aun asi falla, el modulo vuelve a ser lo que era. Sin esto, un fallo a mitad deja
    // publicado algo que nadie eligio publicar.
    await modules.save(modulo);
    throw error;
  }
}

/**
 * El nodo del arbol guarda una COPIA del nombre, el slug y el icono. Aqui se vuelve a cuadrar.
 *
 * `moduleRef` no es estado independiente: es una proyeccion de la definicion, y el menu lateral
 * se dibuja con ella —el rotulo sale de `moduleRef.name` y el enlace de `moduleRef.slug`—. Si no
 * se refresca, renombrar un modulo deja el menu diciendo el nombre viejo, y cambiarle el slug
 * deja el enlace apuntando a una direccion que ya no existe.
 *
 * No se notaba porque hasta ahora renombrar algo publicado era raro: habia que despublicarlo. Con
 * la revision es el camino normal, asi que lo que era un caso de esquina pasa a ser el caso.
 *
 * Se escribe solo si algo cambio, para no dejar un evento de auditoria por cada publicacion que
 * no toco el nombre.
 */
async function sincronizarRefEnArbol(module: ModuleDefinition, actor: ModuleActor): Promise<void> {
  const arbol = await governance.getTree();

  let cambio: string | null = null;
  const refrescar = (nodos: NavNode[]): NavNode[] =>
    nodos.map((nodo) => {
      if (isFolder(nodo)) return { ...nodo, children: refrescar(nodo.children) };
      if (nodo.moduleRef.moduleId !== module.moduleId) return nodo;

      const ref = nodo.moduleRef;
      if (ref.name === module.name && ref.slug === module.slug && ref.icon === module.icon) {
        return nodo;
      }
      cambio = `Actualizado a '${module.name}' (/${module.slug}).`;
      return {
        ...nodo,
        moduleRef: {
          moduleId: module.moduleId,
          slug: module.slug,
          name: module.name,
          ...(module.icon ? { icon: module.icon } : {}),
        },
      };
    });

  const nodes = refrescar(arbol.nodes);
  if (cambio === null) return;

  await governance.setTree({ ...arbol, nodes });
  await treeEventRecord({
    actorId: actor.userId,
    action: 'renombrar',
    nodeId: `nodo-${module.moduleId}`,
    detail: cambio,
  });
}

/** Al publicar, el modulo tiene que existir en la ORGANIZACION GENERAL. */
async function missingIfTreeAttach(
  module: ModuleDefinition,
  actor: ModuleActor,
): Promise<void> {
  const arbol = await governance.getTree();
  if (findModulePath(arbol.nodes, module.moduleId) !== null) return;

  const resultado = applyTreeOperation(
    arbol,
    {
      type: 'create-module',
      parentId: null,
      id: `nodo-${module.moduleId}`,
      moduleRef: {
        moduleId: module.moduleId,
        slug: module.slug,
        name: module.name,
        ...(module.icon ? { icon: module.icon } : {}),
      },
    },
    actor,
  );

  if (!resultado.ok) {
    throw new CicloDeVidaError(
      'No se pudo colocar el modulo en la organizacion general.',
      500,
      'denial' in resultado ? resultado.denial : resultado.error,
    );
  }

  await governance.setTree(resultado.tree);
  for (const evento of resultado.audit) await treeEventRecord(evento);
}

/** Vuelta a borrador: rechazo de una propuesta, o retirada de algo publicado. */
export async function revertDraft(input: InputTransition): Promise<ModuleDefinition> {
  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  transitionRequire(modulo.status, 'borrador');

  const motivo = input.motivo?.trim();
  if (!motivo) {
    throw new CicloDeVidaError(
      'Hace falta un motivo: es lo unico que le dice a quien lo propuso que tiene que cambiar.',
      400,
    );
  }

  // Retirar algo PUBLICADO afecta a todos los equipos que lo ven, asi que es de Administrador.
  // Retirar la propia propuesta, en cambio, lo puede hacer quien la hizo.
  if (modulo.status === 'publicado') {
    permission(input.actor, 'publicar-modulo-institucional');
  } else {
    // Rechazar una propuesta es cosa de quien aprueba; retirarla, de quien la hizo.
    if (input.actor.role !== 'administrador') authorshipRequire(modulo, input.actor);
    permission(input.actor, 'crear-editar-modulos-borrador');
  }

  const actualizado: ModuleDefinition = {
    ...modulo,
    status: 'borrador',
    // Quien lo retira se queda a cargo del borrador si no tenia autor —un publicado no lo tiene—,
    // para que no quede un borrador sin dueño que nadie pueda editar.
    ownerUserId: modulo.ownerUserId ?? input.actor.userId,
    updatedAt: ahora(),
  };

  await modules.save(actualizado);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'withdraw',
    before: { status: modulo.status },
    after: { status: actualizado.status },
    justification: motivo,
  });

  return actualizado;
}

/** Borrado definitivo: solo Administrador, y solo de lo que no esta publicado. */
export async function deleteModule(input: InputTransition): Promise<void> {
  permission(input.actor, 'borrar-definitivamente');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  if (modulo.status === 'publicado') {
    throw new CicloDeVidaError(
      'Un modulo publicado no se borra de golpe: retirelo primero, para que la retirada quede ' +
        'registrada y los equipos que lo usaban dejen de verlo por un cambio explicito.',
      409,
    );
  }

  await modules.remove(input.moduleId);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'delete',
    before: { slug: modulo.slug, name: modulo.name, status: modulo.status },
  });
}

/** El modulo de un slug, SOLO si este actor puede verlo. */
export async function visibleModuleSlug(
  slug: string,
  actor: ModuleActor,
): Promise<ModuleDefinition | undefined> {
  const modulo = await modules.bySlug(slug);
  if (!modulo) return undefined;
  return seeCan(modulo, actor) ? modulo : undefined;
}

/** Visible Y ENCENDIDO — la puerta de los caminos que SIRVEN un modulo (3.4). */
export async function slugServableModule(
  slug: string,
  actor: ModuleActor,
): Promise<ModuleDefinition | undefined> {
  const modulo = await visibleModuleSlug(slug, actor);
  if (!modulo) return undefined;
  return (await moduloEncendido(modulo.slug)) ? modulo : undefined;
}

/** Poda del arbol de navegacion por estado del modulo. */
export async function statusPrune(nodos: NavNode[], actor: ModuleActor): Promise<NavNode[]> {
  const definiciones = new Map((await modules.list()).map((m) => [m.moduleId, m]));
  /*
   * Los apagados se leen UNA VEZ para todo el arbol.
   */
  const disabled = new Set(await disabledSlugs());

  const prune = (lista: NavNode[]): NavNode[] =>
    lista.flatMap((node): NavNode[] => {
      if (isModule(node)) {
        const definicion = definiciones.get(node.moduleRef.moduleId);
        // Un nodo sin definicion se deja pasar: es el caso del arbol que referencia un modulo
        // que aun no existe, y de eso ya avisa `dangling` al Administrador con su propio
        // mensaje. Ocultarlo aqui haria desaparecer el sintoma sin arreglar la causa.
        if (!definicion) return [node];
        if (disabled.has(definicion.slug)) return [];
        return seeCan(definicion, actor) ? [node] : [];
      }

      const hijos = prune(node.children);
      return hijos.length > 0 ? [{ ...node, children: hijos }] : [];
    });

  return prune(nodos);
}

/** Actor a partir de la sesion. */
export async function actorDe(sesion: ShellSession): Promise<ModuleActor> {
  return { userId: sesion.userId, role: await roleMoreHeightOf(sesion.userId) };
}

/** Navegacion de una sesion: lo concedido al equipo activo Y publicado. */
export async function navigationOf(sesion: ShellSession) {
  const view = await navigationFor(sesion.activeTeamId, sesion.userId);
  return { ...view, tree: await statusPrune(view.tree, await actorDe(sesion)) };
}

/** Como `visibleModuleSlug`, resolviendo el rol a partir del usuario. */
export async function visibleModuleUser(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return visibleModuleSlug(slug, { userId, role: await roleMoreHeightOf(userId) });
}

/** Como `slugServableModule`, resolviendo el rol a partir del usuario. */
export async function userServableModule(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return slugServableModule(slug, { userId, role: await roleMoreHeightOf(userId) });
}

export interface ModuleSettings {
  name: string;
  slug: string;
  description: string;
  options: Partial<Record<ModuleOption, boolean>>;
  defaultFilters: DefaultFilter[];
  /**
   * Como se navega entre sus paginas. Obligatorio en cuanto hay mas de una.
   *
   * `null` significa «ninguno» explicitamente, y por eso no es `undefined`: ausente querria decir
   * «no se toca», que es lo que hace falta cuando el formulario manda solo una parte. Se distingue
   * a proposito para que quitar un navegador sea posible y no solo ponerlo.
   */
  navigator?: PageNavigatorSettings | null;
  /** Renombrar una pagina y darle icono. Solo llegan las que cambian. */
  pages?: { pageId: string; name?: string; icon?: string | null }[];
}

/**
 * Configuracion de un modulo: como se llama, donde vive y que ofrece — secciones 4.1 y 4.11.
 *
 * Es distinto de `saveDraft` a proposito, y no una opcion mas suya. `saveDraft` edita el
 * CONTENIDO de un borrador y por eso exige que sea un borrador y que sea tuyo; esto edita lo que
 * el modulo ES, y un modulo publicado tambien se renombra y tambien se le apaga la exportacion sin
 * que eso sea una version nueva de su contenido. Son dos permisos distintos y dos condiciones
 * distintas: mezclarlos habria dejado la configuracion de lo publicado fuera de alcance.
 */
export async function saveSettings(input: {
  actor: ModuleActor;
  moduleId: string;
  settings: ModuleSettings;
}): Promise<ModuleDefinition> {
  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);

  // Configurar lo PUBLICADO afecta a todos los equipos que lo ven; configurar el borrador propio
  // no. Es la misma division que ya hace `revertDraft`.
  if (modulo.status === 'publicado') {
    permission(input.actor, 'publicar-modulo-institucional');
  } else {
    if (input.actor.role !== 'administrador') authorshipRequire(modulo, input.actor);
    permission(input.actor, 'crear-editar-modulos-borrador');
  }

  const name = input.settings.name.trim();
  if (!name) throw new CicloDeVidaError('El modulo necesita un nombre.', 400);

  const slug = input.settings.slug.trim().toLowerCase();
  /*
   * El slug es la URL publica y estable de 4.11: se valida, no se sanea en silencio.
   *
   * Corregirlo por detras dejaria a quien lo escribio con una direccion que no es la que puso, y
   * enterandose el dia que la comparte.
   */
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new CicloDeVidaError(
      `'${input.settings.slug}' no sirve como URL: minusculas, numeros y guiones, sin empezar ni acabar en guion.`,
      400,
    );
  }
  const ocupado = (await modules.list()).find((m) => m.slug === slug && m.moduleId !== modulo.moduleId);
  if (ocupado) {
    throw new CicloDeVidaError(`La URL '/m/${slug}' ya es la de '${ocupado.name}'.`, 409);
  }

  // Solo se guarda lo APAGADO. El valor por defecto —encendido— vive en un sitio, en
  // `moduleOptionOn`, y no repetido en cada modulo del almacen.
  const options = Object.fromEntries(
    MODULE_OPTIONS.filter((opcion) => input.settings.options[opcion] === false).map((opcion) => [
      opcion,
      false,
    ]),
  );

  const defaultFilters = input.settings.defaultFilters
    .map((f) => ({ field: f.field.trim(), values: f.values.filter((v) => v.trim() !== '') }))
    .filter((f) => f.field !== '' && f.values.length > 0);

  const description = input.settings.description.trim();

  /*
   * El navegador se VALIDA antes de guardarlo, no al publicar.
   *
   * La puerta de publicacion tambien lo mira, y las dos hacen falta: la de publicacion impide que
   * salga un modulo de seis paginas del que solo se ve una, y esta impide guardar un tipo o un
   * comportamiento que no existe — que no se descubriria hasta intentar dibujarlo.
   */
  const navigator =
    input.settings.navigator === undefined ? modulo.navigator : (input.settings.navigator ?? undefined);
  const problemasDeNavegacion = navigatorProblems({ pages: modulo.pages, ...(navigator ? { navigator } : {}) });
  if (navigator && problemasDeNavegacion.length > 0) {
    throw new CicloDeVidaError(problemasDeNavegacion.join(' '), 400);
  }

  /*
   * Renombrar una pagina y darle icono.
   *
   * El SLUG no se toca desde aqui: es la direccion de la pagina (4.11), y cambiarlo al renombrar
   * romperia en silencio los enlaces que alguien tenga guardados. Renombrar cambia el rotulo; la
   * direccion es otra decision.
   */
  const cambiosDePagina = new Map((input.settings.pages ?? []).map((p) => [p.pageId, p]));
  const pages = modulo.pages.map((pagina) => {
    const cambio = cambiosDePagina.get(pagina.pageId);
    if (!cambio) return pagina;
    const siguiente = { ...pagina };
    if (cambio.name !== undefined && cambio.name.trim() !== '') siguiente.name = cambio.name.trim();
    if (cambio.icon !== undefined) {
      if (cambio.icon === null || cambio.icon === '') delete siguiente.icon;
      else siguiente.icon = cambio.icon;
    }
    return siguiente;
  });

  const actualizado: ModuleDefinition = {
    ...modulo,
    name,
    slug,
    pages,
    ...(description ? { description } : {}),
    ...(Object.keys(options).length > 0 ? { options } : {}),
    ...(defaultFilters.length > 0 ? { defaultFilters } : {}),
    ...(navigator ? { navigator } : {}),
    updatedAt: ahora(),
  };
  if (!navigator) delete actualizado.navigator;
  // Un campo que se vacia se BORRA, no se guarda como cadena vacia: `description: ''` obligaria a
  // cada lector a distinguir «sin descripcion» de «descripcion vacia», que son lo mismo.
  if (!description) delete actualizado.description;
  if (Object.keys(options).length === 0) delete actualizado.options;
  if (defaultFilters.length === 0) delete actualizado.defaultFilters;

  await modules.save(actualizado);
  await changeRecord({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'update',
    before: {
      name: modulo.name,
      slug: modulo.slug,
      ...(modulo.description ? { descripcion: modulo.description } : {}),
      ...(modulo.options ? { opciones: modulo.options } : {}),
      ...(modulo.defaultFilters ? { filtros: modulo.defaultFilters } : {}),
      ...(modulo.navigator ? { navegador: modulo.navigator } : {}),
      paginas: modulo.pages.map((p) => ({ slug: p.slug, name: p.name, icon: p.icon ?? null })),
    },
    after: {
      name: actualizado.name,
      slug: actualizado.slug,
      ...(actualizado.description ? { descripcion: actualizado.description } : {}),
      ...(actualizado.options ? { opciones: actualizado.options } : {}),
      ...(actualizado.defaultFilters ? { filtros: actualizado.defaultFilters } : {}),
      ...(actualizado.navigator ? { navegador: actualizado.navigator } : {}),
      paginas: actualizado.pages.map((p) => ({ slug: p.slug, name: p.name, icon: p.icon ?? null })),
    },
  });

  return actualizado;
}
