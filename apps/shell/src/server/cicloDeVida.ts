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
import { navigationFor } from './contexto';
import { registrarCambio, registrarEventoDeArbol } from './auditoria';
import { gobierno } from './gobierno';
import { moduloEncendido, slugsApagados } from './configuracion';
import { modulos } from './almacenModulos';
import { diagnosticarDefinicion } from './datos';
import type { SesionShell } from './sesion';

/**
 * Ciclo de vida de un modulo — seccion 4.1.
 *
 *   borrador -> pendiente-de-aprobacion -> publicado
 *
 * Los tres estados estaban tipados desde F2.3 y nunca hubo un flujo que los recorriera: todo
 * modulo nacia 'publicado' porque venia escrito a mano en el codigo. Sin flujo, la distincion
 * entre "lo que alguien esta probando" y "lo que la institucion respalda" no existia.
 *
 * Las dos reglas que ordenan el resto:
 *
 * 1. QUIEN. Crear y editar borradores es de Colaborador y Administrador; publicar a nivel
 *    institucional es solo de Administrador (matriz de 4.10.1). Un Colaborador PROPONE.
 *
 * 2. QUE SE PUEDE PUBLICAR. Un modulo con objetos rotos, disposicion invalida o instancias en
 *    versiones vencidas no se publica. `findPublishBlockers` decidia eso desde F2.3 y hasta
 *    ahora no lo llamaba nadie; esta es la puerta donde sirve.
 */

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

/**
 * Visibilidad por estado — la parte de 4.1 con consecuencias de seguridad.
 *
 * Un borrador es PERSONAL: no lo ve nadie mas que su autor, ni por la navegacion ni escribiendo
 * la URL. Uno pendiente de aprobacion lo ve ademas quien tiene que aprobarlo, porque revisar a
 * ciegas no es revisar. Publicado lo ve quien tenga concedido el nodo, como hasta ahora.
 *
 * Se resuelve aqui y no en la interfaz: ocultar un borrador del arbol y servirlo por API seria
 * el mismo fallo que la seccion 9 manda probar a nivel de backend.
 */
export function puedeVer(module: ModuleDefinition, actor: ActorDeModulo): boolean {
  if (module.status === 'publicado') return true;
  if (module.ownerUserId === actor.userId) return true;
  return module.status === 'pendiente-de-aprobacion' && actor.role === 'administrador';
}

/** Modulos que este actor puede ver, ya filtrados por estado. */
export async function modulosVisibles(actor: ActorDeModulo): Promise<ModuleDefinition[]> {
  return (await modulos.list()).filter((m) => puedeVer(m, actor));
}

/**
 * Solo el autor de un borrador lo edita. Tampoco un Administrador.
 *
 * Tener el permiso de "crear y editar modulos borrador" no es tener permiso sobre el borrador DE
 * OTRO: si lo fuera, cualquier Colaborador podria reescribir el trabajo en curso de un companero.
 *
 * Y administrar tampoco lo concede, por coherencia con `puedeVer`: un Administrador no ve los
 * borradores ajenos, asi que permitirle editarlos seria dejarle cambiar algo que no puede leer.
 * Su intervencion empieza cuando el modulo se propone; para uno abandonado tiene el borrado
 * definitivo, que no exige leerlo.
 */
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
  if (await modulos.bySlug(slug)) {
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

  await modulos.save(modulo);
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

/**
 * Guarda cambios en un borrador.
 *
 * Solo sobre un BORRADOR. Editar en el sitio un modulo publicado seria cambiar bajo los pies de
 * todos los equipos que lo estan viendo, sin que nadie lo aprobara; el principio 8 dice lo mismo
 * de los objetos compartidos. Para cambiar uno publicado hay que retirarlo primero.
 */
export async function guardarBorrador(input: GuardarBorradorInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'crear-editar-modulos-borrador');

  const modulo = await modulos.get(input.moduleId);
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

  await modulos.save(actualizado);
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

/**
 * Diagnostico del modulo tal como lo veria el editor.
 *
 * Se calcula contra el esquema REAL que el job dejo en el cache, no contra el conector: el
 * principio 2 vale tambien dentro del editor, que es justo donde seria tentador saltarselo para
 * "comprobar de verdad" que existe un campo.
 */
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

  const modulo = await modulos.get(input.moduleId);
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
  await modulos.save(actualizado);
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

/**
 * pendiente-de-aprobacion -> publicado. Solo un Administrador, y solo sin bloqueos.
 *
 * Al publicar sube la `version`: lo que se publica es una version nueva de la definicion, no una
 * mutacion de la anterior.
 */
export async function publicar(input: TransicionInput): Promise<ModuleDefinition> {
  permiso(input.actor, 'publicar-modulo-institucional');

  const modulo = await modulos.get(input.moduleId);
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

  await modulos.save(actualizado);
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

/**
 * Al publicar, el modulo tiene que existir en la ORGANIZACION GENERAL.
 *
 * Sin nodo en el arbol no hay ambito que resolver (4.10.4 lo dice expresamente: un modulo
 * ausente del arbol general no debe poder mostrarse), asi que un modulo publicado y sin colgar
 * de ningun sitio no lo ve NADIE. Publicar algo que nadie puede abrir no es publicar.
 *
 * Se cuelga en la RAIZ, que es el sitio mas restrictivo que existe —no hereda ambito de ninguna
 * carpeta— y desde el que un Administrador lo mueve a donde toque con el editor de arbol, viendo
 * antes como cambia el acceso. Colocarlo automaticamente dentro de una carpeta existente seria
 * concederle el ambito de esa carpeta sin que nadie lo decidiera.
 */
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

/**
 * Vuelta a borrador: rechazo de una propuesta, o retirada de algo publicado.
 *
 * Exige motivo en los dos casos. Un rechazo sin motivo deja a quien lo propuso adivinando, y una
 * retirada sin motivo deja a los equipos que lo usaban sin saber si volvera.
 */
export async function devolverABorrador(input: TransicionInput): Promise<ModuleDefinition> {
  const modulo = await modulos.get(input.moduleId);
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

  await modulos.save(actualizado);
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

  const modulo = await modulos.get(input.moduleId);
  if (!modulo) throw new CicloDeVidaError('Modulo no encontrado.', 404);
  if (modulo.status === 'publicado') {
    throw new CicloDeVidaError(
      'Un modulo publicado no se borra de golpe: retirelo primero, para que la retirada quede ' +
        'registrada y los equipos que lo usaban dejen de verlo por un cambio explicito.',
      409,
    );
  }

  await modulos.remove(input.moduleId);
  await registrarCambio({
    actorId: input.actor.userId,
    entityType: 'module',
    entityId: modulo.moduleId,
    action: 'delete',
    before: { slug: modulo.slug, name: modulo.name, status: modulo.status },
  });
}

/**
 * El modulo de un slug, SOLO si este actor puede verlo.
 *
 * Es la funcion que deben usar los caminos que sirven un modulo a una persona —paginas, API de
 * modulos, exportacion, alertas—. `findModuleBySlug` devuelve tambien borradores, porque el
 * editor los necesita; usarla sin mas en un camino de lectura serviria el trabajo en curso de
 * otra persona como si fuera contenido oficial.
 *
 * Devuelve undefined tanto si el modulo no existe como si existe y no se puede ver, para no
 * distinguir "no hay" de "no puedes": 4.11 pide lo mismo de los parametros de URL, y por la
 * misma razon —saber que algo existe ya es informacion—.
 */
export async function moduloVisiblePorSlug(
  slug: string,
  actor: ActorDeModulo,
): Promise<ModuleDefinition | undefined> {
  const modulo = await modulos.bySlug(slug);
  if (!modulo) return undefined;
  return puedeVer(modulo, actor) ? modulo : undefined;
}

/**
 * Visible Y ENCENDIDO — la puerta de los caminos que SIRVEN un modulo (3.4).
 *
 * Son dos preguntas distintas y por eso son dos funciones:
 *
 *   - `moduloVisiblePorSlug` responde al CICLO DE VIDA: existe, y su estado permite que esta
 *     persona lo abra. Es la que usan el editor y el panel de administracion.
 *   - esta responde ademas a la bandera de App Configuration: si el modulo esta apagado en
 *     produccion, no se sirve a nadie.
 *
 * La distincion importa en la direccion que no es obvia: un modulo apagado TIENE que seguir
 * abriendose en el editor. Apagarlo es lo que se hace cuando esta dando cifras malas, y si el
 * interruptor cerrara tambien la puerta de arreglarlo, la unica salida seria volver a encenderlo
 * en produccion para poder tocarlo.
 */
export async function moduloServiblePorSlug(
  slug: string,
  actor: ActorDeModulo,
): Promise<ModuleDefinition | undefined> {
  const modulo = await moduloVisiblePorSlug(slug, actor);
  if (!modulo) return undefined;
  return (await moduloEncendido(modulo.slug)) ? modulo : undefined;
}

/**
 * Poda del arbol de navegacion por estado del modulo.
 *
 * Un modulo publicado que se RETIRA sigue colgando de su carpeta en la organizacion general: el
 * arbol describe donde vive cada cosa, no si esta publicada. Sin esta poda seguiria apareciendo
 * en la navegacion de todo el mundo despues de retirarlo, y al pulsarlo daria 404 — peor que no
 * aparecer, porque parece una averia.
 *
 * Las carpetas que se quedan sin nada dentro tambien se retiran: una carpeta vacia en el arbol
 * no lleva a ningun sitio.
 */
export async function podarPorEstado(nodos: NavNode[], actor: ActorDeModulo): Promise<NavNode[]> {
  const definiciones = new Map((await modulos.list()).map((m) => [m.moduleId, m]));
  /*
   * Los apagados se leen UNA VEZ para todo el arbol.
   *
   * Con una consulta por nodo, pintar la barra lateral de un equipo con ocho modulos serian ocho
   * resoluciones de configuracion. Y ademas todas las decisiones de este arbol tienen que salir
   * de la MISMA foto: si a mitad de la poda venciera el TTL, media rama se podaria con una
   * configuracion y la otra media con otra.
   */
  const apagados = new Set(await slugsApagados());

  const podar = (lista: NavNode[]): NavNode[] =>
    lista.flatMap((nodo): NavNode[] => {
      if (isModule(nodo)) {
        const definicion = definiciones.get(nodo.moduleRef.moduleId);
        // Un nodo sin definicion se deja pasar: es el caso del arbol que referencia un modulo
        // que aun no existe, y de eso ya avisa `dangling` al Administrador con su propio
        // mensaje. Ocultarlo aqui haria desaparecer el sintoma sin arreglar la causa.
        if (!definicion) return [nodo];
        if (apagados.has(definicion.slug)) return [];
        return puedeVer(definicion, actor) ? [nodo] : [];
      }

      const hijos = podar(nodo.children);
      return hijos.length > 0 ? [{ ...nodo, children: hijos }] : [];
    });

  return podar(nodos);
}

/**
 * Actor a partir de la sesion.
 *
 * El rol es el de APLICACION —el mas alto entre los equipos de la persona—, no el del equipo
 * activo: administrar no es un permiso por equipo (4.10.1). El ambito de DATOS sigue siendo el
 * del equipo activo, que es otra cosa y se resuelve en otro sitio.
 */
export async function actorDe(sesion: SesionShell): Promise<ActorDeModulo> {
  return { userId: sesion.userId, role: await rolMasAltoDe(sesion.userId) };
}

/**
 * Navegacion de una sesion: lo concedido al equipo activo Y publicado.
 *
 * Existe para que la poda por estado no haya que acordarse de hacerla en cada sitio. Antes de
 * esta funcion habia tres llamadas sueltas a `navigationFor` —el arbol lateral, la redireccion
 * de la raiz y la API—, y bastaba olvidar una para que un modulo retirado siguiera apareciendo
 * justo en la pantalla que no se reviso.
 */
export async function navegacionDe(sesion: SesionShell) {
  const vista = await navigationFor(sesion.activeTeamId);
  return { ...vista, tree: await podarPorEstado(vista.tree, await actorDe(sesion)) };
}

/**
 * Como `moduloVisiblePorSlug`, resolviendo el rol a partir del usuario.
 *
 * Para los caminos que no tienen una sesion a mano: la exportacion y la evaluacion de alertas
 * corren en el trabajador de fondo, fuera del ciclo de una solicitud (5.3), y solo guardan de
 * quien es el trabajo. Que pasen por aqui es lo que impide que una alerta creada sobre un modulo
 * siga evaluandose —y notificando— despues de que ese modulo se retirara.
 */
export async function moduloVisibleParaUsuario(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return moduloVisiblePorSlug(slug, { userId, role: await rolMasAltoDe(userId) });
}

/**
 * Como `moduloServiblePorSlug`, resolviendo el rol a partir del usuario.
 *
 * La usan la exportacion y la evaluacion de alertas, que corren en el trabajador de fondo. Apagar
 * un modulo tiene que parar tambien lo que sigue produciendo a su nombre sin que nadie mire: una
 * alerta que sigue notificando sobre un modulo apagado es peor que el modulo encendido, porque
 * nadie puede ir a comprobar de donde sale la cifra.
 */
export async function moduloServibleParaUsuario(
  slug: string,
  userId: string,
): Promise<ModuleDefinition | undefined> {
  return moduloServiblePorSlug(slug, { userId, role: await rolMasAltoDe(userId) });
}
