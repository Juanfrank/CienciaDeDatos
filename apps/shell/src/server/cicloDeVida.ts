import {
  type AppRole,
  type NavNode,
  PermissionError,
  applyTreeOperation,
  assertCan,
  findModulePath,
  isModule,
} from '@app/access-control';
import {
  type ModuleDefinition,
  type ModuleStatus,
  type PublishBlocker,
  findPublishBlockers,
} from '@app/module-model';
import { rolMasAltoDe } from './admin';
import { navigationFor } from './context';
import { registrarCambio, registrarEventoDeArbol } from './audit';
import { gobierno } from './gobierno';
import { moduloEncendido, slugsApagados } from './settings';
import { modules } from './almacenModulos';
import { diagnosticarDefinicion } from './data';
import type { SesionShell } from './session';

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

export interface ActorDeModulo {
  userId: string;
  role: AppRole;
}

/** Visibilidad por estado — la parte de 4.1 con consecuencias de seguridad. */
export function puedeVer(module: ModuleDefinition, actor: ActorDeModulo): boolean {
  if (module.status === 'publicado') return true;
  if (module.ownerUserId === actor.userId) return true;
  return module.status === 'pendiente-de-aprobacion' && actor.role === 'administrador';
}

/** Modulos que este actor puede ver, ya filtrados por estado. */
export async function visibleModules(actor: ActorDeModulo): Promise<ModuleDefinition[]> {
  return (await modules.list()).filter((m) => puedeVer(m, actor));
}

/** Solo el autor de un borrador lo edita. Tampoco un Administrador. */
function exigirAutoria(module: ModuleDefinition, actor: ActorDeModulo): void {
  if (module.ownerUserId === actor.userId) return;
  throw new CicloDeVidaError('Ese borrador es de otra persona.', 403);
}

function permiso(actor: ActorDeModulo, capacidad: Parameters<typeof assertCan>[1]): void {
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

function exigirTransicion(desde: ModuleStatus, hasta: ModuleStatus): void {
  if (!TRANSICIONES[desde].includes(hasta)) {
    throw new CicloDeVidaError(
      `No se puede pasar de '${desde}' a '${hasta}'. Desde '${desde}' solo cabe: ` +
        `${TRANSICIONES[desde].join(', ') || 'ningun otro estado'}.`,
      409,
    );
  }
}

const ahora = (): string => new Date().toISOString();

export interface CrearBorradorInput {
  actor: ActorDeModulo;
  name: string;
  slug: string;
}

export async function crearBorrador(input: CrearBorradorInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'crear-editar-modulos-borrador');

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
  await registrarCambio({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'create',
    after: { slug: modulo.slug, name: modulo.name, status: modulo.status },
  });

  return modulo;
}

export interface GuardarBorradorInput {
  actor: ActorDeModulo;
  moduleId: string;
  cambios: Partial<Pick<ModuleDefinition, 'name' | 'icon' | 'pages'>>;
}

/** Guarda cambios en un borrador. */
export async function guardarBorrador(input: GuardarBorradorInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'crear-editar-modulos-borrador');

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

  exigirAutoria(modulo, input.actor);

  const actualizado: ModuleDefinition = {
    ...modulo,
    ...(input.cambios.name !== undefined ? { name: input.cambios.name.trim() } : {}),
    ...(input.cambios.icon !== undefined ? { icon: input.cambios.icon } : {}),
    ...(input.cambios.pages !== undefined ? { pages: input.cambios.pages } : {}),
    updatedAt: ahora(),
  };

  await modules.save(actualizado);
  await registrarCambio({
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
export async function bloqueosDePublicacion(module: ModuleDefinition): Promise<PublishBlocker[]> {
  return findPublishBlockers(await diagnosticarDefinicion(module));
}

export interface TransicionInput {
  actor: ActorDeModulo;
  moduleId: string;
  /** Obligatoria al devolver a borrador o retirar: sin motivo, nadie sabe que arreglar. */
  motivo?: string;
}

/** borrador -> pendiente-de-aprobacion. Lo hace el autor: es una propuesta, no una publicacion. */
export async function enviarAAprobacion(input: TransicionInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'crear-editar-modulos-borrador');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  exigirAutoria(modulo, input.actor);
  exigirTransicion(modulo.status, 'pendiente-de-aprobacion');

  // Se comprueba YA, no solo al publicar. Mandar a revisar algo roto gasta el tiempo de quien
  // revisa en encontrar lo que la maquina sabe decir sola.
  const bloqueos = await bloqueosDePublicacion(modulo);
  if (bloqueos.length > 0) {
    throw new CicloDeVidaError(
      'El modulo tiene problemas que impiden proponerlo para publicacion.',
      422,
      bloqueos,
    );
  }

  const actualizado = { ...modulo, status: 'pendiente-de-aprobacion' as const, updatedAt: ahora() };
  await modules.save(actualizado);
  await registrarCambio({
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
export async function publicar(input: TransicionInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'publicar-modulo-institucional');

  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  exigirTransicion(modulo.status, 'publicado');

  const bloqueos = await bloqueosDePublicacion(modulo);
  if (bloqueos.length > 0) {
    throw new CicloDeVidaError(
      'El modulo no se puede publicar con problemas sin resolver.',
      422,
      bloqueos,
    );
  }

  const actualizado: ModuleDefinition = {
    ...modulo,
    status: 'publicado',
    version: modulo.version + 1,
    // Un modulo publicado a nivel institucional deja de pertenecer a una persona: pertenece a
    // la institucion (4.1). Conservar el autor haria pensar que sigue siendo suyo y que puede
    // cambiarlo sin pasar por aqui.
    ownerUserId: undefined,
    updatedAt: ahora(),
  };
  delete actualizado.ownerUserId;

  await modules.save(actualizado);
  await colgarDelArbolSiFalta(actualizado, input.actor);
  await registrarCambio({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'publish',
    before: { status: modulo.status, version: modulo.version, autor: modulo.ownerUserId },
    after: { status: actualizado.status, version: actualizado.version },
  });

  return actualizado;
}

/** Al publicar, el modulo tiene que existir en la ORGANIZACION GENERAL. */
async function colgarDelArbolSiFalta(
  module: ModuleDefinition,
  actor: ActorDeModulo,
): Promise<void> {
  const arbol = await gobierno.getTree();
  if (findModulePath(arbol.nodes, module.moduleId) !== null) return;

  const resultado = applyTreeOperation(
    arbol,
    {
      type: 'crear-modulo',
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

  await gobierno.setTree(resultado.tree);
  for (const evento of resultado.audit) await registrarEventoDeArbol(evento);
}

/** Vuelta a borrador: rechazo de una propuesta, o retirada de algo publicado. */
export async function devolverABorrador(input: TransicionInput): Promise<ModuleDefinition> {
  const modulo = await modules.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  exigirTransicion(modulo.status, 'borrador');

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
    permiso(input.actor, 'publicar-modulo-institucional');
  } else {
    // Rechazar una propuesta es cosa de quien aprueba; retirarla, de quien la hizo.
    if (input.actor.role !== 'administrador') exigirAutoria(modulo, input.actor);
    permiso(input.actor, 'crear-editar-modulos-borrador');
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
  await registrarCambio({
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
export async function borrarModulo(input: TransicionInput): Promise<void> {
  permiso(input.actor, 'borrar-definitivamente');

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
  await registrarCambio({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'delete',
    before: { slug: modulo.slug, name: modulo.name, status: modulo.status },
  });
}

/** El modulo de un slug, SOLO si este actor puede verlo. */
export async function moduloVisiblePorSlug(
  slug: string,
  actor: ActorDeModulo,
): Promise<ModuleDefinition | undefined> {
  const modulo = await modules.bySlug(slug);
  if (!modulo) return undefined;
  return puedeVer(modulo, actor) ? modulo : undefined;
}

/** Visible Y ENCENDIDO — la puerta de los caminos que SIRVEN un modulo (3.4). */
export async function moduloServiblePorSlug(
  slug: string,
  actor: ActorDeModulo,
): Promise<ModuleDefinition | undefined> {
  const modulo = await moduloVisiblePorSlug(slug, actor);
  if (!modulo) return undefined;
  return (await moduloEncendido(modulo.slug)) ? modulo : undefined;
}

/** Poda del arbol de navegacion por estado del modulo. */
export async function podarPorEstado(nodos: NavNode[], actor: ActorDeModulo): Promise<NavNode[]> {
  const definiciones = new Map((await modules.list()).map((m) => [m.moduleId, m]));
  /*
   * Los apagados se leen UNA VEZ para todo el arbol.
   */
  const apagados = new Set(await slugsApagados());

  const podar = (lista: NavNode[]): NavNode[] =>
    lista.flatMap((node): NavNode[] => {
      if (isModule(node)) {
        const definicion = definiciones.get(node.moduleRef.moduleId);
        // Un nodo sin definicion se deja pasar: es el caso del arbol que referencia un modulo
        // que aun no existe, y de eso ya avisa `dangling` al Administrador con su propio
        // mensaje. Ocultarlo aqui haria desaparecer el sintoma sin arreglar la causa.
        if (!definicion) return [node];
        if (apagados.has(definicion.slug)) return [];
        return puedeVer(definicion, actor) ? [node] : [];
      }

      const hijos = podar(node.children);
      return hijos.length > 0 ? [{ ...node, children: hijos }] : [];
    });

  return podar(nodos);
}

/** Actor a partir de la sesion. */
export async function actorDe(sesion: SesionShell): Promise<ActorDeModulo> {
  return { userId: sesion.userId, role: await rolMasAltoDe(sesion.userId) };
}

/** Navegacion de una sesion: lo concedido al equipo activo Y publicado. */
export async function navigationOf(sesion: SesionShell) {
  const vista = await navigationFor(sesion.activeTeamId);
  return { ...vista, tree: await podarPorEstado(vista.tree, await actorDe(sesion)) };
}

/** Como `moduloVisiblePorSlug`, resolviendo el rol a partir del usuario. */
export async function visibleModuleUser(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return moduloVisiblePorSlug(slug, { userId, role: await rolMasAltoDe(userId) });
}

/** Como `moduloServiblePorSlug`, resolviendo el rol a partir del usuario. */
export async function moduloServibleParaUsuario(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return moduloServiblePorSlug(slug, { userId, role: await rolMasAltoDe(userId) });
}
