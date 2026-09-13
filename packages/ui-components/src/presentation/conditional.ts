import type { TextColor } from './contract';

/** Formato condicional — que el color dependa del DATO, no solo del mapeo. */

export const COMPARATORS = ['mayor', 'mayor-o-igual', 'menor', 'menor-o-igual', 'igual', 'entre'] as const;
export type Comparator = (typeof COMPARATORS)[number];

export interface ColorRule {
  /** A que medida se aplica. Sin ella, a todas. */
  medida?: string;
  comparator: Comparator;
  valor: number;
  /** Solo para `entre`: el otro extremo, incluido. */
  hasta?: number;
  color: TextColor;
}

export interface ConditionalFormat {
  rules: ColorRule[];
}

/** Mas de cinco reglas sobre un objeto dejan de ser excepciones y pasan a ser una escala. */
export const MAX_RULES = 5;

function cumple(colorRule: ColorRule, valor: number): boolean {
  switch (colorRule.comparator) {
    case 'mayor':
      return valor > colorRule.valor;
    case 'mayor-o-igual':
      return valor >= colorRule.valor;
    case 'menor':
      return valor < colorRule.valor;
    case 'menor-o-igual':
      return valor <= colorRule.valor;
    case 'igual':
      return valor === colorRule.valor;
    case 'entre':
      // Los dos extremos entran. Y se ordenan: «entre 90 y 30» es el mismo rango que «entre 30 y
      // 90», y rechazarlo por el orden en que alguien escribio dos numeros no ayuda a nadie.
      return (
        colorRule.hasta !== undefined &&
        valor >= Math.min(colorRule.valor, colorRule.hasta) &&
        valor <= Math.max(colorRule.valor, colorRule.hasta)
      );
    default:
      return false;
  }
}

/** El color que le toca a un valor, o nada. */
export function conditionalColor(
  condicional: ConditionalFormat | undefined,
  valor: number | null | undefined,
  medida?: string,
): TextColor | undefined {
  if (!condicional || valor === null || valor === undefined) return undefined;

  for (const colorRule of condicional.rules.slice(0, MAX_RULES)) {
    if (colorRule.medida !== undefined && colorRule.medida !== medida) continue;
    if (cumple(colorRule, valor)) return colorRule.color;
  }
  return undefined;
}

/** Texto legible de una regla, para el panel y para el respaldo accesible. */
export function describirRegla(colorRule: ColorRule): string {
  const nombre: Record<Comparator, string> = {
    mayor: 'mayor que',
    'mayor-o-igual': 'mayor o igual que',
    menor: 'menor que',
    'menor-o-igual': 'menor o igual que',
    igual: 'igual a',
    entre: 'entre',
  };
  const rango =
    colorRule.comparator === 'entre' ? `${colorRule.valor} y ${colorRule.hasta ?? colorRule.valor}` : String(colorRule.valor);
  return `${nombre[colorRule.comparator]} ${rango}`;
}
