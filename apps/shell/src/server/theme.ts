import { cookies } from 'next/headers';
import {
  CONTRAST_PAIRS,
  INSTITUTIONAL_THEME,
  SEMANTIC_ROLES,
  SHADOW_SHAPES,
  SHAPE_SCALES,
  SOURCE_ROLES,
  TYPEFACES,
  TYPE_SCALES,
  type ColorMode,
  type ContrastCheck,
  type MaterialTheme,
  type SemanticRole,
  type ThemeDefinition,
  asThemeTokens,
  findContrastFailures,
  institutionalContrastChecks,
  materialVariables,
  sourceColorIs,
  themeVersion,
  themeVersions,
  toCssVariables,
} from '@app/design-tokens';
import { type Actor, assertCan } from '@app/access-control';
import { governance } from './governance';
import { AdminError } from './admin';
import { changeRecord } from './audit';

/**
 * El tema de un modo, como variables CSS.
 *
 * El tema ACTIVO y el modo son dos cosas distintas: el tema es la decision de la institucion
 * —cual de los suyos se sirve— y el modo es la preferencia de quien mira. De ahi que la version
 * se pida con los dos: todo tema tiene su claro y su oscuro, derivados del mismo origen.
 *
 * Vive aqui y no en la disposicion raiz porque hay una pantalla que NO sigue la preferencia de
 * quien mira —la de acceso, que se dibuja siempre en oscuro—, y para pedir sus variables hacia
 * falta la misma funcion desde dos sitios.
 */
export function themeVariables(
  definicion: ThemeDefinition,
  mode: ColorMode,
): Record<string, string> {
  const theme = themeVersion(definicion, mode);
  return { ...materialVariables(theme), ...toCssVariables(asThemeTokens(theme)) };
}

/** En que modo de color se dibuja la aplicacion — seccion 4.3. */
export const THEME_COOKIE = 'tema';

export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark'];

export function colorModeIs(valor: string | undefined): valor is ColorMode {
  return valor === 'light' || valor === 'dark';
}

/** El modo pedido, o el claro. */
export async function colorMode(): Promise<ColorMode> {
  const valor = (await cookies()).get(THEME_COOKIE)?.value;
  return colorModeIs(valor) ? valor : 'light';
}

/*
 * ---- Temas de la institucion (4.3) ----
 *
 * Un tema son TRES colores de origen y un nombre; Material Design 3 deriva de ellos los tokens de
 * cada modo. Los dos modos —claro y oscuro— salen del mismo origen, asi que no son dos temas:
 * son las dos versiones del mismo. Antes la pantalla los listaba como si fueran temas distintos, y
 * con eso no habia forma de tener un segundo tema sin tener cuatro entradas.
 */

/**
 * Un eje de estilo, si su valor es uno de los que existen; nada, si no.
 *
 * Silenciosa a proposito: un identificador que no esta en el conjunto es el que manda un cliente
 * viejo o un cuerpo escrito a mano, y para eso «se queda con el institucional» es mejor que un
 * 400. Lo que NO puede pasar es que entre: el valor termina en una variable CSS, y una cadena
 * cualquiera ahi es inyeccion. Por eso se comprueba contra el conjunto y no contra el tipo, que
 * aqui no sabe nada —esto llega de `JSON.parse`—.
 */
function enConjunto<K extends string, V extends string>(
  clave: K,
  valor: V | undefined,
  conjunto: Record<string, unknown>,
): Partial<Record<K, V>> {
  return valor !== undefined && Object.hasOwn(conjunto, valor)
    ? ({ [clave]: valor } as Partial<Record<K, V>>)
    : {};
}

/**
 * Todo lo que una version de un tema tiene que superar. Dos listas, porque miran cosas distintas.
 *
 * `institutionalContrastChecks` mira la forma aplanada del tema: las combinaciones concretas que
 * la aplicacion dibuja —el enlace sobre la superficie, las ocho series sobre la tarjeta—. No
 * llega a lo semantico, porque en esa forma hay un `danger` suelto y ni siquiera un hueco donde
 * poner el verde y el ambar.
 *
 * Las parejas de MD3 miran el esquema completo, cada `onX` sobre su `X`. Ahi si entran el exito y
 * la advertencia, y con su color de texto derivado, que es la unica comparacion que significa
 * algo: lo que se lee en pantalla no es el verde, es lo que se escribe encima.
 *
 * Es una sola funcion y la usan las DOS puertas —la de guardar y la que la pantalla ensena— para
 * que el numero que se lee ahi sea el numero que de verdad se exige. Con dos listas distintas, la
 * pantalla prometeria una cosa y el servidor comprobaria otra.
 */
export function contrastChecksFor(version: MaterialTheme): ContrastCheck[] {
  return [
    ...institutionalContrastChecks(asThemeTokens(version)),
    ...CONTRAST_PAIRS.map(([frente, fondo]) => ({
      label: `${frente} sobre ${fondo}`,
      foreground: version.color[frente],
      background: version.color[fondo],
    })),
  ];
}

/**
 * Guarda un tema, comprobando el CONTRASTE de sus dos versiones antes de dejarlo entrar.
 *
 * Conviene decir exactamente que protege esta comprobacion, porque no es lo que parece. Hoy NO
 * puede rechazar nada que venga de esta pantalla: Material Design 3 no usa el color de origen tal
 * cual, lo convierte en una paleta tonal y elige los tonos por su luminancia, asi que las parejas
 * que `institutionalContrastChecks` mira salen AA sea cual sea el color que alguien escriba. Se
 * probo con amarillo palido, con gris medio, con casi blanco y con negro: ninguno falla.
 *
 * Eso es justo lo que hace valiosa la comprobacion y lo que impide quitarla. La promesa de 4.9 no
 * se sostiene sobre que nadie elija mal, se sostiene sobre esa derivacion; y la derivacion es
 * codigo nuestro, que alguien puede cambiar —otro croma, otro tono para `onSurfaceVariant`, una
 * pareja mas en la lista de comprobaciones—. El dia que un cambio asi rompa la garantia, esto lo
 * para aqui en vez de dejar que la aplicacion entera incumpla AA hasta que alguien mire la
 * pantalla de temas. Es un cable trampa, no un filtro de gustos, y por eso el mensaje dice que
 * pareja fallo.
 *
 * Se comprueban LAS DOS versiones: una garantia que solo valiera en claro dejaria el fallo
 * esperando a que alguien cambie de modo.
 */
export async function saveTheme(
  actor: Actor,
  definicion: ThemeDefinition,
): Promise<ThemeDefinition> {
  assertCan(actor.role, 'gestionar-temas');

  const nombre = definicion.name.trim();
  if (!nombre) throw new ThemeError('El tema necesita un nombre.', 400);

  for (const rol of SOURCE_ROLES) {
    const valor = definicion.source[rol];
    if (!sourceColorIs(valor)) {
      throw new ThemeError(
        `El color «${rol}» tiene que ser hexadecimal de seis digitos, como #0050dd. Llego «${valor}».`,
        400,
      );
    }
  }

  /*
   * Los semanticos solo se validan si VIENEN: ausentes, salen de su respaldo, que es lo normal.
   *
   * Vacio cuenta como ausente y no como error. La pantalla manda cadena vacia cuando alguien
   * borra el campo, y «lo he dejado en blanco» es exactamente pedir el de por defecto.
   */
  const semanticos: Partial<Record<SemanticRole, string>> = {};
  for (const rol of SEMANTIC_ROLES) {
    const valor = definicion.source[rol]?.trim();
    if (valor === undefined || valor === '') continue;
    if (!sourceColorIs(valor)) {
      throw new ThemeError(
        `El color «${rol}» tiene que ser hexadecimal de seis digitos, como #ef3340. Llego «${valor}».`,
        400,
      );
    }
    semanticos[rol] = valor.toLowerCase();
  }

  const limpio: ThemeDefinition = {
    id: definicion.id,
    name: nombre,
    source: {
      primario: definicion.source.primario.trim().toLowerCase(),
      acento: definicion.source.acento.trim().toLowerCase(),
      neutro: definicion.source.neutro.trim().toLowerCase(),
      ...semanticos,
    },
    ...(definicion.description?.trim() ? { description: definicion.description.trim() } : {}),
    /*
     * Los cinco ejes de estilo se conservan al guardar.
     *
     * Sin esto, copiar un tema y cambiarle el nombre devolvia un tema con sus colores y la letra
     * de otro: el campo se perdia en el saneado, que es la clase de fallo que no da error y solo
     * se ve mirando la pantalla con atencion. Se comprueba que el valor este en su conjunto
     * cerrado, y no basta con que el tipo lo diga: esto llega de un cuerpo JSON, que para el
     * compilador es `unknown` por mucho que la firma prometa otra cosa.
     */
    ...enConjunto('typeface', definicion.typeface, TYPEFACES),
    ...enConjunto('typeScale', definicion.typeScale, TYPE_SCALES),
    ...enConjunto('cornerRadius', definicion.cornerRadius, SHAPE_SCALES),
    ...enConjunto('shadowShape', definicion.shadowShape, SHADOW_SHAPES),
    ...enConjunto('shadowTint', definicion.shadowTint, { neutra: 1, 'de-marca': 1 }),
  };

  const versiones = themeVersions(limpio);
  for (const modo of COLOR_MODES) {
    const version = versiones[modo];
    if (!version) continue;
    const fallos = findContrastFailures(contrastChecksFor(version));
    if (fallos.length > 0) {
      throw new ThemeError(
        `En su version ${modo === 'light' ? 'clara' : 'oscura'} no alcanza el contraste que exige ` +
          `4.9: ${fallos.map((f) => f.label).join(', ')}.`,
        422,
        fallos,
      );
    }
  }

  const anterior = await governance.getTheme(limpio.id);
  if (anterior?.builtIn) {
    throw new ThemeError('El tema de fabrica no se edita: se copia y se cambia la copia.', 409);
  }

  await governance.upsertTheme(limpio);
  await changeRecord({
    actorId: actor.userId,
    entityType: 'theme',
    entityId: limpio.id,
    action: anterior ? 'update' : 'create',
    ...(anterior ? { before: anterior } : {}),
    after: limpio,
  });

  return limpio;
}

/** Cual se sirve. Cambiarlo repinta la aplicacion entera, asi que consta en auditoria. */
export async function activateTheme(actor: Actor, themeId: string): Promise<void> {
  assertCan(actor.role, 'gestionar-temas');

  const tema = await governance.getTheme(themeId);
  if (!tema) throw new ThemeError(`El tema '${themeId}' no existe.`, 404);

  const antes = await governance.getActiveTheme();
  if (antes === themeId) return;

  await governance.setActiveTheme(themeId);
  await changeRecord({
    actorId: actor.userId,
    entityType: 'theme',
    entityId: themeId,
    action: 'update',
    before: { activo: antes },
    after: { activo: themeId },
  });
}

export async function deleteTheme(actor: Actor, themeId: string): Promise<void> {
  assertCan(actor.role, 'gestionar-temas');

  const tema = await governance.getTheme(themeId);
  if (!tema) throw new ThemeError(`El tema '${themeId}' no existe.`, 404);
  if (tema.builtIn) {
    throw new ThemeError(
      'El tema de fabrica no se borra: es el que queda cuando no hay ningun otro.',
      409,
    );
  }

  await governance.deleteTheme(themeId);
  await changeRecord({
    actorId: actor.userId,
    entityType: 'theme',
    entityId: themeId,
    action: 'delete',
    before: tema,
  });
}

/** El tema que se sirve, ya resuelto. Nunca devuelve undefined: siempre hay uno. */
export async function activeTheme(): Promise<ThemeDefinition> {
  const id = await governance.getActiveTheme();
  return (await governance.getTheme(id)) ?? INSTITUTIONAL_THEME;
}

/**
 * Hereda de `AdminError` para que su CODIGO llegue a quien llama.
 *
 * `withAdmin` conoce `AdminError` y respeta su estado; cualquier otro error cae en el 400 generico.
 * Sin esto, un tema rechazado por contraste —422— y uno rechazado por un color mal escrito —400—
 * llegarian iguales a la pantalla, y no habria forma de contar lo que de verdad paso.
 */
export class ThemeError extends AdminError {
  constructor(message: string, status: number, detail?: unknown) {
    super(message, status, detail);
    this.name = 'ThemeError';
  }
}
