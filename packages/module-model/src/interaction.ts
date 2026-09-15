import type { DrillThroughTarget, ObjectInstance } from '@app/ui-components';

/** Interactividad — seccion 4.4. */

/*
 * El destino se define con `ObjectInstance`, en `@app/ui-components`, porque es un campo suyo.
 * Se reexporta aqui para que quien trabaja con la interaccion lo encuentre donde lo busca.
 */
export type { DrillThroughTarget };

export type InteractionPattern =
  | 'segmentador'
  | 'filtrado-cruzado'
  | 'drill-through'
  | 'marcador';

export interface InteractionPatternSpec {
  id: InteractionPattern;
  name: string;
  description: string;
  /** Donde vive el estado del patron. En todos: la query string (4.11). */
  stateRepresentation: 'query-string';
  /** replaceState para ajustes incrementales; pushState solo para navegacion deliberada. */
  historyBehavior: 'replaceState' | 'pushState';
  /** Que impide que este patron se convierta en una via de ampliacion de acceso. */
  securityNote: string;
}

export const INTERACTION_PATTERNS: InteractionPatternSpec[] = [
  {
    id: 'segmentador',
    name: 'Segmentador',
    description:
      'Seleccion de valores de una dimension que filtra los objetos del modulo. No se filtra a ' +
      'si mismo, para que siempre se pueda anadir o quitar un valor.',
    stateRepresentation: 'query-string',
    historyBehavior: 'replaceState',
    securityNote:
      'Solo ofrece valores presentes en el dataset ya filtrado por el ambito, asi que no puede ' +
      'revelar la existencia de valores fuera del alcance de quien mira.',
  },
  {
    id: 'filtrado-cruzado',
    name: 'Filtrado cruzado',
    description:
      'Seleccionar una categoria en un objeto filtra los demas objetos del mismo modulo. Se ' +
      'implementa anadiendo el filtro a la URL, no con un estado paralelo.',
    stateRepresentation: 'query-string',
    historyBehavior: 'replaceState',
    securityNote:
      'El filtro pasa por la misma interseccion con el ambito que cualquier parametro de URL: ' +
      'puede restringir, nunca ampliar. Ademas no fragmenta el cache, porque se aplica sobre el ' +
      'dataset ya cacheado al momento de la lectura.',
  },
  {
    id: 'drill-through',
    name: 'Drill-through',
    description:
      'Navegacion desde un objeto a otro modulo llevando el contexto de filtros activo.',
    stateRepresentation: 'query-string',
    historyBehavior: 'pushState',
    securityNote:
      'El contexto viaja como parametros de URL y se interseca con el ambito de quien LLEGA, no ' +
      'con el de quien navego. Si el modulo destino no esta concedido a su equipo, no se abre.',
  },
  {
    id: 'marcador',
    name: 'Marcador',
    description:
      'Una URL CON NOMBRE que captura el estado de filtros de una pagina. No es un mecanismo de ' +
      'guardado de estado aparte: es exactamente la URL que ya representa ese estado.',
    stateRepresentation: 'query-string',
    historyBehavior: 'pushState',
    securityNote:
      'Un marcador guarda FILTROS, nunca datos ni el ambito de quien lo creo. Al abrirlo, los ' +
      'filtros se intersecan con el ambito de quien lo abre, asi que dos personas con ambitos ' +
      'distintos ven datos distintos desde el mismo marcador.',
  },
];

/** Marcador — seccion 4.4. */
export interface Bookmark {
  id: string;
  name: string;
  ownerUserId: string;
  moduleSlug: string;
  pageSlug?: string;
  /** Estado de filtros capturado. Nada mas. */
  filters: Record<string, string[]>;
  createdAt: string;
  /** Si es compartido, aparece para todo el equipo; si no, solo para quien lo creo. */
  sharedWithTeamId?: string;
}

/** Reconstruye la URL de un marcador. Es su unica representacion: no hay un formato interno. */
export function bookmarkToUrl(bookmark: Pick<Bookmark, 'moduleSlug' | 'pageSlug' | 'filters'>): string {
  const base = bookmark.pageSlug
    ? `/m/${bookmark.moduleSlug}/${bookmark.pageSlug}`
    : `/m/${bookmark.moduleSlug}`;

  const params = new URLSearchParams();
  for (const [fieldName, valores] of Object.entries(bookmark.filters)) {
    for (const valor of valores) params.append(fieldName, valor);
  }

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

/** Captura el estado actual de filtros como marcador. */
export function captureBookmark(input: {
  id: string;
  name: string;
  ownerUserId: string;
  moduleSlug: string;
  pageSlug?: string;
  /** Filtros tal como estan en la URL en este momento. */
  searchParams: URLSearchParams | Record<string, string | string[]>;
  createdAt: string;
  sharedWithTeamId?: string;
}): Bookmark {
  const filters: Record<string, string[]> = {};

  if (input.searchParams instanceof URLSearchParams) {
    for (const clave of new Set(input.searchParams.keys())) {
      filters[clave] = input.searchParams.getAll(clave);
    }
  } else {
    for (const [clave, valor] of Object.entries(input.searchParams)) {
      filters[clave] = Array.isArray(valor) ? valor : [valor];
    }
  }

  return {
    id: input.id,
    name: input.name,
    ownerUserId: input.ownerUserId,
    moduleSlug: input.moduleSlug,
    ...(input.pageSlug ? { pageSlug: input.pageSlug } : {}),
    filters,
    createdAt: input.createdAt,
    ...(input.sharedWithTeamId ? { sharedWithTeamId: input.sharedWithTeamId } : {}),
  };
}

/**
 * Construye la URL de destino de un drill-through desde el estado actual.
 *
 * Lo que viaja es el CONTEXTO DE FILTROS, y no hay un segundo canal para «el valor que se
 * pulso»: en esta aplicacion el estado visible vive en la URL, asi que pulsar una categoria ya
 * la deja escrita como filtro. Un parametro aparte para la seleccion seria una segunda fuente de
 * verdad sobre lo mismo, y las dos se contradirian el dia que una se olvidara de actualizarse.
 */
export function drillThroughUrl(
  target: DrillThroughTarget,
  currentFilters: Record<string, string[]>,
): string {
  const filters: Record<string, string[]> = {};

  for (const [fieldName, valores] of Object.entries(currentFilters)) {
    if (target.carryDimensions && !target.carryDimensions.includes(fieldName)) continue;
    if (valores.length > 0) filters[fieldName] = valores;
  }

  return bookmarkToUrl({
    moduleSlug: target.moduleSlug,
    ...(target.pageSlug ? { pageSlug: target.pageSlug } : {}),
    filters,
  });
}

/**
 * Lo que impide que un salto declarado lleve a alguna parte.
 *
 * Se comprueba porque el camino de lectura lo DESCARTA EN SILENCIO: un destino que ya no existe
 * —o que apunta a la pagina en la que uno ya esta— no se dibuja, y quien lo configuro ve un
 * objeto normal sin forma de enterarse de que su salto no esta. Es la peor manera de fallar,
 * porque no parece un fallo.
 *
 * Que el destino este CONCEDIDO no se comprueba aqui y es a proposito: eso depende de quien
 * mire, no de como este configurado el modulo. Un salto a un modulo que existe pero que no es
 * de tu equipo no es un error del modulo; sencillamente a ti no se te ofrece.
 */
export function drillProblems(
  instance: Pick<ObjectInstance, 'drillThrough'>,
  contexto: { moduleSlug: string; slugsExistentes: readonly string[] },
): string[] {
  const destinos = instance.drillThrough ?? [];
  if (destinos.length === 0) return [];

  const problemas: string[] = [];
  const existentes = new Set(contexto.slugsExistentes);
  const vistos = new Set<string>();

  for (const destino of destinos) {
    const clave = `${destino.moduleSlug}/${destino.pageSlug ?? ''}`;

    if (destino.moduleSlug.trim() === '') {
      problemas.push('Hay un salto sin modulo destino: asi no lleva a ninguna parte.');
      continue;
    }
    if (!existentes.has(destino.moduleSlug)) {
      problemas.push(
        `El salto apunta a «${destino.moduleSlug}», que no es ningun modulo. Si se renombro su ` +
          'direccion, hay que apuntar a la nueva.',
      );
    }
    if (destino.moduleSlug === contexto.moduleSlug && !destino.pageSlug) {
      problemas.push(
        'El salto lleva al modulo en el que ya se esta. Para ir a otra pagina del mismo modulo ' +
          'hay que decir cual.',
      );
    }
    if (vistos.has(clave)) {
      problemas.push(`El salto a «${clave.replace(/\/$/, '')}» esta declarado dos veces.`);
    }
    vistos.add(clave);
  }

  return problemas;
}
