/** Evaluador minimo de recurrencia cron — seccion 6.4. */

export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export class CronParseError extends Error {
  constructor(expression: string, detail: string) {
    super(`Expresion cron invalida '${expression}': ${detail}`);
    this.name = 'CronParseError';
  }
}

export function parseCron(expression: string): CronFields {
  const partes = expression.trim().split(/\s+/);
  if (partes.length !== 5) {
    throw new CronParseError(expression, `se esperaban 5 campos y hay ${partes.length}.`);
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = partes as [string, string, string, string, string];
  return { minute, hour, dayOfMonth, month, dayOfWeek };
}

/** Expande un campo a los valores que admite, dentro de [min, max]. */
function expandField(field: string, min: number, max: number, expression: string): Set<number> {
  const valores = new Set<number>();

  for (const parte of field.split(',')) {
    const [rango, pasoTexto] = parte.split('/');
    const paso = pasoTexto === undefined ? 1 : Number(pasoTexto);
    if (!Number.isInteger(paso) || paso < 1) {
      throw new CronParseError(expression, `paso invalido en '${parte}'.`);
    }

    let desde: number;
    let hasta: number;

    if (rango === '*' || rango === undefined) {
      desde = min;
      hasta = max;
    } else if (rango.includes('-')) {
      const [a, b] = rango.split('-').map(Number);
      if (a === undefined || b === undefined || !Number.isInteger(a) || !Number.isInteger(b)) {
        throw new CronParseError(expression, `rango invalido en '${parte}'.`);
      }
      desde = a;
      hasta = b;
    } else {
      const n = Number(rango);
      if (!Number.isInteger(n)) throw new CronParseError(expression, `valor invalido en '${parte}'.`);
      desde = n;
      // Un valor suelto con paso ('5/10') significa "desde 5, cada 10" hasta el maximo.
      hasta = pasoTexto === undefined ? n : max;
    }

    if (desde < min || hasta > max || desde > hasta) {
      throw new CronParseError(expression, `'${parte}' esta fuera del rango [${min}, ${max}].`);
    }

    for (let v = desde; v <= hasta; v += paso) valores.add(v);
  }

  return valores;
}

/** true si el instante dado cae en la recurrencia. Se evalua en UTC, igual que Azure. */
export function matchesCron(expression: string, date: Date): boolean {
  const campos = parseCron(expression);

  const minuto = expandField(campos.minute, 0, 59, expression).has(date.getUTCMinutes());
  const hora = expandField(campos.hour, 0, 23, expression).has(date.getUTCHours());
  const mes = expandField(campos.month, 1, 12, expression).has(date.getUTCMonth() + 1);
  if (!minuto || !hora || !mes) return false;

  // Convencion de cron: si dia-del-mes y dia-de-la-semana estan ambos restringidos, basta con
  // que se cumpla UNO de los dos. Si solo uno lo esta, ese manda.
  const domRestringido = campos.dayOfMonth !== '*';
  const dowRestringido = campos.dayOfWeek !== '*';
  const dom = expandField(campos.dayOfMonth, 1, 31, expression).has(date.getUTCDate());
  const dow = expandField(campos.dayOfWeek, 0, 6, expression).has(date.getUTCDay());

  if (domRestringido && dowRestringido) return dom || dow;
  if (domRestringido) return dom;
  if (dowRestringido) return dow;
  return true;
}

/** ¿Le toca a este dataset? */
export function isDue(expression: string, lastRunAt: string | undefined, now: Date): boolean {
  if (!lastRunAt) return true;

  const desde = new Date(lastRunAt);
  if (Number.isNaN(desde.getTime())) return true;

  // Se avanza minuto a minuto desde el siguiente al de la ultima ejecucion. El tope de 31 dias
  // evita recorrer un intervalo absurdo si el latido quedo muy atras.
  const MAX_MINUTOS = 31 * 24 * 60;
  const cursor = new Date(desde.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  for (let i = 0; i < MAX_MINUTOS && cursor.getTime() <= now.getTime(); i++) {
    if (matchesCron(expression, cursor)) return true;
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }

  return false;
}
