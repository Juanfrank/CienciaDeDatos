import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Toda clave del almacen esta CLASIFICADA: o se respalda, o se dice por que no.
 *
 * `backup.ts` decide con una tabla de prefijos lo que entra en el respaldo del estado
 * autoritativo. Una tabla asi envejece de la unica forma que importa: alguien anade una clave
 * nueva el ano que viene —un registro, una preferencia, una cola— y nadie se acuerda de decidir
 * si hay que respaldarla. No falla nada. El dia del desastre esa clave no vuelve, y nadie sabe
 * que existia.
 *
 * Esta guarda cierra ese hueco: si una clave no cae bajo ningun prefijo clasificado, enrojece.
 * Obliga a DECIDIR, no a respaldar: `no-respaldar` con su motivo escrito es una respuesta
 * perfectamente valida, y es la que llevan las sesiones y los tokens de un solo uso.
 *
 * La tabla se lee del archivo como TEXTO y no se importa, porque `tools/coherence` no puede
 * importar de `apps/shell`: lo prohibe el limite de dependencias, y con razon. Es lo mismo que
 * hace `simulacros.spec.ts` con la configuracion de vitest, y sirve igual — lo que se compara es
 * la tabla de verdad, no una copia de ella.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const fuentes = execSync(`git -C ${raiz} ls-files '*.ts' '*.tsx' '*.mts'`)
  .toString()
  .trim()
  .split('\n')
  .filter(Boolean);

/**
 * Una clave del almacen, tal y como se DECLARA.
 *
 * Todas nacen igual: una constante con su literal, o una funcion que la arma con una plantilla.
 *
 *     export const KEY_AUDIT = 'app:auditoria';
 *     const CREDENTIAL_KEY = (email: string) => `auth:credencial:${email.toLowerCase()}`;
 *
 * De ahi que el patron admita las tres formas en que aparece un literal de clave: detras de un
 * `=`, de un `=>` y de un `return`. Media docena de claves —las que llevan un identificador
 * dentro— se arman en una funcion, y la del dataset se devuelve desde el cuerpo.
 *
 * Se busca la DECLARACION y no el uso porque el uso es un identificador —`leer(KEY_AUDIT)`— y
 * resolverlo desde fuera del compilador seria adivinar.
 */
const DECLARACION = /(?:=>?|\breturn)\s*[`']([a-z][a-z0-9-]*:[^`'\s]*)[`']/g;

/**
 * Lo que lleva dos puntos y no es una clave.
 *
 * Una URL, un `data:` incrustado y un `otpauth:` tambien casan con la forma. Se distinguen por la
 * barra —ninguna clave del almacen lleva `/`— salvo `otpauth`, que no la lleva y hay que nombrar.
 */
const esClave = (texto: string) => !texto.includes('/') && !texto.startsWith('otpauth:');

/** Donde se escribe la tabla y donde se explica: nombran claves para poder hablar de ellas. */
const NO_SE_MIRAN = [
  'apps/shell/src/server/backup.ts',
  'apps/shell/src/server/backup.spec.ts',
  'tools/coherence/respaldo.spec.ts',
];

/**
 * Los componentes no se miran, y es la linea que separa las dos cosas.
 *
 * El almacen es estado de SERVIDOR: un `.tsx` no lo toca. Una clave con esta forma dentro de un
 * componente es de `localStorage` —`navegacion:carpetas-plegadas`, las carpetas plegadas del
 * arbol—, que no sobrevive a un despliegue, no sale de ese navegador y no hay nada que respaldar
 * en ella. Mirarla solo daria falsas alarmas, que es como se termina apagando una guarda.
 */
const esComponente = (ruta: string) => ruta.endsWith('.tsx');

/**
 * Lo que tiene forma de clave, vive donde el almacen y aun asi no lo es, con su motivo.
 *
 * Dos, y las dos del mismo sitio: son prefijos de los IDENTIFICADORES que guarda el catalogo de
 * gobierno dentro de su propio valor, no claves con las que se lea nada.
 */
const NO_SON_CLAVES: Record<string, string> = {
  'icono:': 'Prefijo de un identificador de icono dentro de `app:catalogo:gobierno`.',
  'imagen:': 'Prefijo de un identificador de imagen dentro de `app:catalogo:gobierno`.',
};

/** Los prefijos declarados en `backup.ts`, leidos de ahi. */
function prefijosDeclarados(): string[] {
  const fuente = readFileSync(`${raiz}/apps/shell/src/server/backup.ts`, 'utf8');
  const tabla = /prefix:\s*'([^']+)',\s*kind:\s*'([^']+)'/g;
  const prefijos = [...fuente.matchAll(tabla)].map((m) => m[1] as string);
  // Si el formato de la tabla cambia, lo que se leeria es una lista vacia, y una lista vacia
  // no ampara nada pero tampoco acusa a nadie: la guarda se quedaria muda en vez de romperse.
  if (prefijos.length === 0) throw new Error('No se pudo leer CLASSES de backup.ts');
  return prefijos;
}

const PREFIJOS = prefijosDeclarados();

const claves = new Map<string, string>();
for (const ruta of fuentes) {
  if (NO_SE_MIRAN.includes(ruta)) continue;
  if (esComponente(ruta)) continue;
  for (const m of readFileSync(`${raiz}/${ruta}`, 'utf8').matchAll(DECLARACION)) {
    const clave = m[1] as string;
    if (!esClave(clave) || NO_SON_CLAVES[clave]) continue;
    if (!claves.has(clave)) claves.set(clave, ruta);
  }
}

describe('el respaldo no se deja ninguna clave sin decidir', () => {
  it('hay claves que revisar, y la tabla se leyo de verdad', () => {
    expect(claves.size).toBeGreaterThan(10);
    expect(PREFIJOS.length).toBeGreaterThan(10);
  });

  it('cada clave del almacen cae bajo un prefijo clasificado', () => {
    const sinClase = [...claves.entries()]
      .filter(([clave]) => !PREFIJOS.some((p) => clave.startsWith(p)))
      .map(([clave, ruta]) => `${clave} (${ruta})`)
      .sort();

    expect(
      sinClase,
      'estas claves no estan en la tabla de `apps/shell/src/server/backup.ts`, asi que el\n' +
        'respaldo las ignora en silencio. Anadelas con su clase y su motivo: `no-respaldar`\n' +
        'tambien es una respuesta, y es la de las sesiones y los tokens de un solo uso.\n',
    ).toEqual([]);
  });

  it('y ningun prefijo de la tabla sobra: todos amparan alguna clave real', () => {
    // Un prefijo que ya no ampara nada es una decision sobre algo que se borro, y leerlo hace
    // creer que ese estado existe. La lista se lee para decidir, asi que tiene que ser cierta.
    const huerfanos = PREFIJOS.filter(
      (prefijo) => ![...claves.keys()].some((clave) => clave.startsWith(prefijo)),
    );

    expect(huerfanos).toEqual([]);
  });

});
