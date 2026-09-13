import type { ColorDeTexto } from './contrato';

/** Formato condicional — que el color dependa del DATO, no solo del mapeo. */

export const COMPARADORES = ['mayor', 'mayor-o-igual', 'menor', 'menor-o-igual', 'igual', 'entre'] as const;
export type Comparador = (typeof COMPARADORES)[number];

export interface ReglaDeColor {
  /** A que medida se aplica. Sin ella, a todas. */
  medida?: string;
  comparador: Comparador;
  valor: number;
  /** Solo para `entre`: el otro extremo, incluido. */
  hasta?: number;
  color: ColorDeTexto;
}

export interface FormatoCondicional {
  reglas: ReglaDeColor[];
}

/** Mas de cinco reglas sobre un objeto dejan de ser excepciones y pasan a ser una escala. */
export const MAX_REGLAS = 5;

function cumple(regla: ReglaDeColor, valor: number): boolean {
  switch (regla.comparador) {
    case 'mayor':
      return valor > regla.valor;
    case 'mayor-o-igual':
      return valor >= regla.valor;
    case 'menor':
      return valor < regla.valor;
    case 'menor-o-igual':
      return valor <= regla.valor;
    case 'igual':
      return valor === regla.valor;
    case 'entre':
      // Los dos extremos entran. Y se ordenan: «entre 90 y 30» es el mismo rango que «entre 30 y
      // 90», y rechazarlo por el orden en que alguien escribio dos numeros no ayuda a nadie.
      return (
        regla.hasta !== undefined &&
        valor >= Math.min(regla.valor, regla.hasta) &&
        valor <= Math.max(regla.valor, regla.hasta)
      );
    default:
      return false;
  }
}

/** El color que le toca a un valor, o nada. */
export function colorCondicional(
  condicional: FormatoCondicional | undefined,
  valor: number | null | undefined,
  medida?: string,
): ColorDeTexto | undefined {
  if (!condicional || valor === null || valor === undefined) return undefined;

  for (const regla of condicional.reglas.slice(0, MAX_REGLAS)) {
    if (regla.medida !== undefined && regla.medida !== medida) continue;
    if (cumple(regla, valor)) return regla.color;
  }
  return undefined;
}

/** Texto legible de una regla, para el panel y para el respaldo accesible. */
export function describirRegla(regla: ReglaDeColor): string {
  const nombre: Record<Comparador, string> = {
    mayor: 'mayor que',
    'mayor-o-igual': 'mayor o igual que',
    menor: 'menor que',
    'menor-o-igual': 'menor o igual que',
    igual: 'igual a',
    entre: 'entre',
  };
  const rango =
    regla.comparador === 'entre' ? `${regla.valor} y ${regla.hasta ?? regla.valor}` : String(regla.valor);
  return `${nombre[regla.comparador]} ${rango}`;
}
