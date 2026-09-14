import { fieldKey } from './viewModel';
import type { BindingProblem } from './viewModel';
import { footerReferences } from './attachmentView';
import { DATE_PICKERS } from '../presentation/filtersPanel';
import type {
  AttachedObjectInstance,
  ObjectInstance,
  VisualObjectDefinition,
} from './types';

/** Validacion de objetos adjuntados. */

export type SearchDefinition = (objectId: string) => VisualObjectDefinition | undefined;

/** El identificador de cada complemento que existe. */
export type AttachmentId = AttachedObjectInstance['objectId'];

/**
 * Como nace cada complemento al adjuntarlo.
 *
 * Es un `Record` EXHAUSTIVO sobre la union, y ahi esta su gracia: anadir un complemento al modelo
 * sin decir con que configuracion nace no compila. Antes esto era un `if` de dos ramas en el panel
 * del editor, y un tipo nuevo habria caido en el `else` —naciendo como una tabla de datos— sin que
 * nada se quejara.
 *
 * Todos nacen VALIDOS: un complemento que nace roto obliga a quien lo adjunta a arreglar algo que
 * no ha configurado todavia, y deja el modulo sin poder publicarse por haber pulsado un boton.
 */
export const ATTACHMENT_BY_DEFAULT: {
  [K in AttachmentId]: (contexto: {
    instanceId: string;
    version: string;
    host: ObjectInstance;
  }) => Extract<AttachedObjectInstance, { objectId: K }>;
} = {
  'tooltip-explicativo': ({ instanceId, version, host }) => ({
    instanceId,
    objectId: 'tooltip-explicativo',
    version,
    text: `Que muestra «${host.title ?? host.objectId}».`,
  }),
  // Alcance de objeto: es el unico que vale para cualquier anfitrion. El de subobjeto necesita
  // una dimension mapeada, y la validacion lo rechaza sin ella.
  'tabla-de-datos': ({ instanceId, version }) => ({
    instanceId,
    objectId: 'tabla-de-datos',
    version,
    scope: 'objeto',
  }),
  // Sobre el PRIMER campo mapeado: es el unico que se sabe que existe sin preguntar nada.
  'filtro-de-visualizacion': ({ instanceId, version, host }) => ({
    instanceId,
    objectId: 'filtro-de-visualizacion',
    version,
    fieldName: filterableFields(host)[0] ?? '',
  }),
  'pie-de-pagina': ({ instanceId, version, host }) => ({
    instanceId,
    objectId: 'pie-de-pagina',
    version,
    // Sin medidas mapeadas no se propone una referencia: `{{1}}` no apuntaria a nada y el pie
    // naceria invalido.
    texto: host.binding.measures.length > 0 ? 'Total: {{1}}.' : 'Fuente: Poder Judicial.',
  }),
  'paginado': ({ instanceId, version }) => ({
    instanceId,
    objectId: 'paginado',
    version,
    porPagina: 10,
    selector: true,
    coletilla: 'abajo',
  }),
};

export const ATTACHMENT_IDS = Object.keys(ATTACHMENT_BY_DEFAULT) as AttachmentId[];

/**
 * Los campos por los que un objeto puede filtrarse a si mismo: los que YA mapea.
 *
 * Uno cualquiera del dataset convertiria el complemento en un filtro general disfrazado, y ademas
 * podria acotar por algo que el objeto no ensena — un filtro cuyo efecto no se ve es un filtro que
 * nadie entiende.
 */
export const filterableFields = (instance: ObjectInstance): string[] => [
  ...instance.binding.dimensions.map(fieldKey),
  ...instance.binding.measures,
];

/** Un complemento de tabla con alcance de subobjeto necesita una dimension por la que desglosar. */
function exigeDimension(attachment: AttachedObjectInstance): boolean {
  return attachment.objectId === 'tabla-de-datos' && attachment.scope === 'subobjeto';
}

export function validateAttachments(
  instance: ObjectInstance,
  search: SearchDefinition,
): BindingProblem[] {
  const problems: BindingProblem[] = [];

  const anfitrion = search(instance.objectId);
  if (anfitrion?.attachable) {
    problems.push({
      slot: instance.objectId,
      kind: 'contrato-incumplido',
      problem:
        `'${anfitrion.name}' es un complemento: se adjunta a otro objeto y no puede colocarse ` +
        'como objeto independiente en la rejilla.',
    });
  }

  const vistos = new Set<string>();

  for (const attachment of instance.attachments ?? []) {
    const definicion = search(attachment.objectId);

    if (!definicion) {
      problems.push({
        slot: attachment.objectId,
        kind: 'campo-inexistente',
        problem: `El complemento '${attachment.objectId}' no existe en el repositorio de objetos.`,
      });
      continue;
    }

    if (!definicion.attachable) {
      problems.push({
        slot: attachment.objectId,
        kind: 'contrato-incumplido',
        problem:
          `'${definicion.name}' no es un complemento: es un objeto independiente y no puede ` +
          'adjuntarse a otro.',
      });
    }

    // Dos tooltips explicativos en el mismo objeto no significan nada, y dos tablas de datos
    // dejarian al anfitrion con dos iconos que abren lo mismo.
    if (vistos.has(attachment.objectId)) {
      problems.push({
        slot: attachment.objectId,
        kind: 'contrato-incumplido',
        problem: `El objeto ya tiene adjunto un '${definicion.name}'. Solo se admite uno de cada tipo.`,
      });
    }
    vistos.add(attachment.objectId);

    if (exigeDimension(attachment) && instance.binding.dimensions.length === 0) {
      problems.push({
        slot: attachment.objectId,
        kind: 'contrato-incumplido',
        problem:
          'El alcance de subobjeto desglosa por una categoria, y este objeto no mapea ninguna ' +
          'dimension: no hay subobjeto por el que desglosar. Use el alcance de objeto.',
      });
    }

    problems.push(...ownProblems(attachment, instance));
  }

  return problems;
}

/**
 * Lo que cada complemento exige de SU PROPIA configuracion.
 *
 * Se comprueba aqui y no al dibujar por lo de siempre: un pie que referencia una medida que no
 * existe, o un paginado de cero registros, no dan error — dan una pantalla que dice algo que no
 * es. Al dibujar ya es tarde; aqui bloquea la publicacion.
 */
function ownProblems(
  attachment: AttachedObjectInstance,
  instance: ObjectInstance,
): BindingProblem[] {
  const problems: BindingProblem[] = [];
  const mal = (problem: string) =>
    problems.push({ slot: attachment.objectId, kind: 'contrato-incumplido' as const, problem });

  switch (attachment.objectId) {
    case 'filtro-de-visualizacion': {
      const posibles = filterableFields(instance);
      if (posibles.length === 0) {
        mal(
          'El filtro de visualizacion acota por un campo que el objeto ya mapea, y este objeto ' +
            'no mapea ninguno.',
        );
      } else if (!posibles.includes(attachment.fieldName)) {
        mal(
          `'${attachment.fieldName}' no esta mapeado en este objeto. El filtro de visualizacion ` +
            `solo puede acotar por lo que el objeto ensena: ${posibles.join(', ')}.`,
        );
      }
      /*
       * Los selectores de fecha NO, todavia.
       *
       * Este complemento compara por valor, asi que un «desde/hasta» quedaria escrito en la URL
       * sin acotar nada: el control se moveria y la visual seguiria igual. Se rechaza al guardar
       * en vez de ofrecerlo y que no haga nada, que es la forma de fallar que no se nota.
       */
      if (attachment.tipo && DATE_PICKERS.includes(attachment.tipo)) {
        mal(
          `El selector '${attachment.tipo}' acota por rango, y el filtro de visualizacion ` +
            'compara por valor. Use un selector de valores.',
        );
      }
      break;
    }

    case 'pie-de-pagina': {
      if (attachment.texto.trim() === '') {
        mal('El pie de pagina no tiene texto: un pie vacio ocupa sitio y no dice nada.');
        break;
      }
      const medidas = instance.binding.measures.length;
      for (const referencia of footerReferences(attachment.texto)) {
        if (referencia < 1 || referencia > medidas) {
          mal(
            `El pie referencia {{${referencia}}} y el objeto mapea ${medidas} medida(s): esa ` +
              'posicion no existe. Las referencias van por orden de mapeo, empezando en 1.',
          );
        }
      }
      break;
    }

    case 'paginado': {
      if (!Number.isInteger(attachment.porPagina) || attachment.porPagina < 1) {
        mal(
          `El paginado se configuro con ${attachment.porPagina} por pagina. Tiene que ser un ` +
            'entero de 1 o mas.',
        );
      }
      if (instance.binding.dimensions.length === 0) {
        mal(
          'El paginado parte por categoria, y este objeto no mapea ninguna dimension: no hay ' +
            'nada que partir. Una cifra sola no se pagina.',
        );
      }
      break;
    }

    default:
      break;
  }

  return problems;
}

/** El complemento de un tipo dado, si el objeto lo tiene adjunto. */
export function attachmentOf<T extends AttachedObjectInstance['objectId']>(
  instance: ObjectInstance,
  objectId: T,
): Extract<AttachedObjectInstance, { objectId: T }> | undefined {
  return (instance.attachments ?? []).find((a) => a.objectId === objectId) as
    | Extract<AttachedObjectInstance, { objectId: T }>
    | undefined;
}
