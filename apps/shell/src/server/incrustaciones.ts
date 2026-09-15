import { changeRecord } from './audit';
import { leer, mutar } from './almacenCompartido';
import type { EmbedChrome } from './embedding';

/**
 * Codigos de incrustacion — seccion 4.9, con la trazabilidad de 4.10.7.
 *
 * Antes el codigo que se pegaba en un portal ajeno era la URL normal del modulo con `/embed`
 * delante: `/embed/m/{slug}?…`. Cualquiera que supiera el slug la componia a mano, y despues no
 * habia forma de responder las dos preguntas que importan cuando un dato del Poder Judicial
 * aparece en la pagina de otro: QUIEN lo puso ahi, y como se quita.
 *
 * Ahora el codigo es una ENTIDAD. Tiene dueno, fecha, el modulo y la pagina que abre, los filtros
 * con los que se genero, y un estado que se puede revocar. La URL deja de decir nada del modulo:
 * `/embed/{codigo}`. Eso tiene una consecuencia deliberada — quien tenga un codigo de un modulo no
 * puede editarlo para apuntar a otro.
 *
 * Revocar NO borra. Un codigo revocado sigue existiendo y su URL sigue respondiendo, diciendo que
 * el vinculo fue suprimido: un 404 en la pagina de otra institucion se lee como que la aplicacion
 * se cayo, y quien la mantiene no tiene por donde empezar a preguntar.
 */
export interface EmbedCode {
  code: string;
  moduleId: string;
  /** Copia legible del slug, para la tabla del panel. La URL de incrustacion no lo lleva. */
  moduleSlug: string;
  moduleName: string;
  pageSlug?: string;
  chrome: EmbedChrome;
  /** Los filtros congelados al generarlo: es la VISTA que se incrusto, no el modulo entero. */
  filters: Record<string, string[]>;
  createdBy: string;
  createdAt: string;
  revokedBy?: string;
  revokedAt?: string;
  /** Por que se suprimio. Es lo que la pagina revocada ensena a quien la encuentra. */
  reason?: string;
}

export const KEY_EMBEDS = 'app:incrustaciones';

/** Prefijo del codigo. Se ve en la URL y en el registro, y dice de que se esta hablando. */
const PREFIJO = 'inc';

const todos = async (): Promise<EmbedCode[]> => (await leer<EmbedCode[]>(KEY_EMBEDS)) ?? [];

export const embedsList = (): Promise<EmbedCode[]> =>
  todos().then((lista) => [...lista].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export async function embedFind(code: string): Promise<EmbedCode | undefined> {
  return (await todos()).find((e) => e.code === code);
}

export interface NewEmbed {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  pageSlug?: string;
  chrome: EmbedChrome;
  filters: Record<string, string[]>;
  createdBy: string;
}

/** Genera un codigo y lo deja registrado. */
export async function embedCreate(input: NewEmbed): Promise<EmbedCode> {
  const entrada: EmbedCode = {
    ...input,
    code: `${PREFIJO}-${crypto.randomUUID().slice(0, 12)}`,
    createdAt: new Date().toISOString(),
  };

  await mutar<EmbedCode[]>(KEY_EMBEDS, (guardados) => [...(guardados ?? []), entrada]);
  await changeRecord({
    actorId: input.createdBy,
    entityType: 'embed',
    entityId: entrada.code,
    action: 'create',
    after: {
      modulo: entrada.moduleSlug,
      ...(entrada.pageSlug ? { pagina: entrada.pageSlug } : {}),
      cromo: entrada.chrome,
      filtros: Object.keys(entrada.filters).length,
    },
  });

  return entrada;
}

/**
 * Revoca un codigo. No lo borra: su URL sigue respondiendo, y dice que fue suprimido.
 *
 * Revocar dos veces no es un error: la segunda no cambia nada y no vuelve a registrarse, pero
 * devuelve el codigo igual. Quien llama no tiene por que saber si alguien se le adelanto.
 */
export async function embedRevoke(input: {
  code: string;
  actorId: string;
  reason?: string;
}): Promise<EmbedCode | undefined> {
  let revocado: EmbedCode | undefined;

  await mutar<EmbedCode[]>(KEY_EMBEDS, (guardados) =>
    (guardados ?? []).map((e) => {
      if (e.code !== input.code || e.revokedAt) return e;
      revocado = {
        ...e,
        revokedBy: input.actorId,
        revokedAt: new Date().toISOString(),
        ...(input.reason?.trim() ? { reason: input.reason.trim() } : {}),
      };
      return revocado;
    }),
  );

  // Ya estaba revocado, o no existe. En el primer caso se devuelve tal cual; en el segundo,
  // `embedFind` devuelve `undefined` y quien llama responde 404.
  if (!revocado) return embedFind(input.code);

  await changeRecord({
    actorId: input.actorId,
    entityType: 'embed',
    entityId: input.code,
    action: 'delete',
    before: { modulo: revocado.moduleSlug, creadoPor: revocado.createdBy },
    ...(revocado.reason ? { justification: revocado.reason } : {}),
  });

  return revocado;
}
