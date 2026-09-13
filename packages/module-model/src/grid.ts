/** Sistema de cuadricula responsivo — seccion 4.2. */

export const GRID_COLUMNS = 12;

export interface GridPosition {
  /** Columna inicial, desde 0. */
  x: number;
  /** Fila inicial, desde 0. */
  y: number;
  /** Ancho en columnas. */
  w: number;
  /** Alto en filas. */
  h: number;
}

export type Breakpoint = 'movil' | 'tableta' | 'escritorio';

/** Columnas efectivas por tamano de pantalla. */
export const COLUMNS_BY_BREAKPOINT: Record<Breakpoint, number> = {
  movil: 1,
  tableta: 6,
  escritorio: GRID_COLUMNS,
};

export interface GridProblem {
  kind: 'fuera-de-rejilla' | 'tamano-invalido' | 'solapamiento';
  itemIds: string[];
  problem: string;
}

const ocupa = (p: GridPosition): { x1: number; x2: number; y1: number; y2: number } => ({
  x1: p.x,
  x2: p.x + p.w,
  y1: p.y,
  y2: p.y + p.h,
});

/** Si dos posiciones se pisan. */
export const seSolapan = (a: GridPosition, b: GridPosition): boolean => {
  const ra = ocupa(a);
  const rb = ocupa(b);
  return ra.x1 < rb.x2 && rb.x1 < ra.x2 && ra.y1 < rb.y2 && rb.y1 < ra.y2;
};

/** Valida una disposicion. */
export function validateLayout(items: { id: string; position: GridPosition }[]): GridProblem[] {
  const problems: GridProblem[] = [];

  for (const item of items) {
    const { x, y, w, h } = item.position;
    if (w < 1 || h < 1 || !Number.isInteger(w) || !Number.isInteger(h)) {
      problems.push({
        kind: 'tamano-invalido',
        itemIds: [item.id],
        problem: `El objeto '${item.id}' declara un tamano invalido (${w}x${h}). Minimo 1x1, en enteros.`,
      });
      continue;
    }
    if (x < 0 || y < 0 || !Number.isInteger(x) || !Number.isInteger(y)) {
      problems.push({
        kind: 'fuera-de-rejilla',
        itemIds: [item.id],
        problem: `El objeto '${item.id}' tiene una posicion invalida (${x},${y}).`,
      });
      continue;
    }
    if (x + w > GRID_COLUMNS) {
      problems.push({
        kind: 'fuera-de-rejilla',
        itemIds: [item.id],
        problem:
          `El objeto '${item.id}' se sale de la rejilla: empieza en la columna ${x} y ocupa ${w}, ` +
          `pero solo hay ${GRID_COLUMNS} columnas.`,
      });
    }
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!a || !b) continue;
      if (seSolapan(a.position, b.position)) {
        problems.push({
          kind: 'solapamiento',
          itemIds: [a.id, b.id],
          problem: `Los objetos '${a.id}' y '${b.id}' se solapan y uno ocultaria al otro.`,
        });
      }
    }
  }

  return problems;
}

/** Deriva la disposicion para un tamano de pantalla. */
export function layoutForBreakpoint<T extends { id: string; position: GridPosition }>(
  items: T[],
  breakpoint: Breakpoint,
): (T & { position: GridPosition })[] {
  const columnas = COLUMNS_BY_BREAKPOINT[breakpoint];
  if (columnas === GRID_COLUMNS) return [...items];

  // Orden de lectura de la disposicion guardada: es lo que preserva la intencion de quien la
  // diseno cuando la rejilla se estrecha.
  const ordenados = [...items].sort(
    (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
  );

  if (columnas === 1) {
    return ordenados.map((item, i) => ({
      ...item,
      position: { x: 0, y: i, w: 1, h: item.position.h },
    }));
  }

  let x = 0;
  let y = 0;
  let altoDeFila = 0;
  return ordenados.map((item) => {
    const w = Math.max(1, Math.min(columnas, Math.round((item.position.w / GRID_COLUMNS) * columnas)));
    if (x + w > columnas) {
      x = 0;
      y += altoDeFila;
      altoDeFila = 0;
    }
    const position: GridPosition = { x, y, w, h: item.position.h };
    x += w;
    altoDeFila = Math.max(altoDeFila, item.position.h);
    return { ...item, position };
  });
}

/** Alto efectivo de un objeto para un tamano de pantalla. */
export function rowSpanForBreakpoint(h: number, breakpoint: Breakpoint): number | null {
  return COLUMNS_BY_BREAKPOINT[breakpoint] === 1 ? null : h;
}

/** Las tres disposiciones a la vez, indexadas por id. */
export function layoutsForAllBreakpoints<T extends { id: string; position: GridPosition }>(
  items: T[],
): Record<Breakpoint, Map<string, GridPosition>> {
  const porTamano = (breakpoint: Breakpoint) =>
    new Map(layoutForBreakpoint(items, breakpoint).map((i) => [i.id, i.position]));

  return {
    movil: porTamano('movil'),
    tableta: porTamano('tableta'),
    escritorio: porTamano('escritorio'),
  };
}

/** Orden de lectura de la disposicion guardada: arriba a abajo, izquierda a derecha. */
export function readingOrder<T extends { position: GridPosition }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
}

/** Primera posicion libre para insertar un objeto nuevo del ancho indicado. */
export function findFreeSlot(
  items: { position: GridPosition }[],
  w: number,
  h: number,
): GridPosition {
  const ancho = Math.max(1, Math.min(GRID_COLUMNS, w));
  const alto = Math.max(1, h);
  const maxY = items.reduce((m, i) => Math.max(m, i.position.y + i.position.h), 0);

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x + ancho <= GRID_COLUMNS; x++) {
      const candidata: GridPosition = { x, y, w: ancho, h: alto };
      if (!items.some((i) => seSolapan(i.position, candidata))) return candidata;
    }
  }
  return { x: 0, y: maxY, w: ancho, h: alto };
}
