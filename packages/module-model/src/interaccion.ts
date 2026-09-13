/** Interactividad — seccion 4.4. */

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

export const PATRONES_DE_INTERACCION: InteractionPatternSpec[] = [
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
  for (const [campo, valores] of Object.entries(bookmark.filters)) {
    for (const valor of valores) params.append(campo, valor);
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

/** Destino de drill-through declarado en un objeto del modulo. */
export interface DrillThroughTarget {
  /** Modulo al que se navega. */
  moduleSlug: string;
  pageSlug?: string;
  /**
   * Dimensiones cuyo valor se lleva al destino. Si se omite, se llevan todos los filtros
   * activos. Acotarlo es lo habitual: llevarlo todo suele arrastrar filtros sin sentido alla.
   */
  carryDimensions?: string[];
  label?: string;
}

/** Construye la URL de destino de un drill-through desde el estado actual. */
export function drillThroughUrl(
  target: DrillThroughTarget,
  filtrosActuales: Record<string, string[]>,
  seleccion?: { campo: string; valor: string },
): string {
  const filters: Record<string, string[]> = {};

  for (const [campo, valores] of Object.entries(filtrosActuales)) {
    if (target.carryDimensions && !target.carryDimensions.includes(campo)) continue;
    if (valores.length > 0) filters[campo] = valores;
  }

  // La seleccion que origino el drill-through sustituye a lo que hubiera para esa dimension:
  // el gesto fue "ver el detalle de ESTE valor".
  if (seleccion) filters[seleccion.campo] = [seleccion.valor];

  return bookmarkToUrl({
    moduleSlug: target.moduleSlug,
    ...(target.pageSlug ? { pageSlug: target.pageSlug } : {}),
    filters,
  });
}
