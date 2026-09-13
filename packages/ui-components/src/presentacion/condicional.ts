import type { ColorDeTexto } from './contrato';

/**
 * Formato condicional — que el color dependa del DATO, no solo del mapeo.
 *
 * Es la diferencia entre un grafico que se mira y uno que avisa. Hoy, el color de una barra lo
 * decide en que serie esta; con esto lo puede decidir cuanto vale, que es lo que permite que «por
 * encima de 90 dias» salte a la vista sin que nadie tenga que leer el eje.
 *
 * Las reglas se evaluan EN ORDEN y gana la primera que case. No se combinan ni se busca la «mas
 * especifica»: con dos reglas que se solapan, quien edita decide cual manda subiendola, y eso se
 * puede razonar mirando la lista. Una resolucion por especificidad obligaria a simular el
 * algoritmo de cabeza para saber de que color va a salir una barra.
 *
 * El color es un ROL del tema, por lo mismo que el acento: un color suelto no tiene par de
 * contraste comprobado contra la superficie donde acabe ni sigue al tema oscuro (4.3).
 */

export const COMPARADORES = ['mayor', 'mayor-o-igual', 'menor', 'menor-o-igual', 'igual', 'entre'] as const;
export type Comparador = (typeof COMPARADORES)[number];

export interface ReglaDeColor {
  /**
   * A que medida se aplica. Sin ella, a todas.
   *
   * Hace falta porque un objeto con «Casos» y «Dias» en la misma tarjeta tiene dos escalas
   * distintas: «mayor que 90» significa una cosa en una y un disparate en la otra.
   */
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

/**
 * El color que le toca a un valor, o nada.
 *
 * `null` NO entra en ninguna regla, ni siquiera en «menor que». `null` es «no hay respuesta», no
 * un numero pequeno: tratarlo como cero lo pintaria de rojo en cuanto alguien escriba «menor que
 * 10», y eso es afirmar algo sobre un dato que no existe.
 */
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
