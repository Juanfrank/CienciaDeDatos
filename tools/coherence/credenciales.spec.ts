import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * La credencial local entra y sale del almacen por UN solo sitio.
 *
 * El secreto TOTP se cifra en la frontera de la persistencia: `CredentialsStore`, en
 * `identity.ts`, lo mete en un sobre al guardar y lo abre al leer. Eso solo se sostiene mientras
 * esa sea la unica puerta. Un `write('auth:credencial:...', registro)` escrito en otro archivo
 * compila, funciona y deja el segundo factor en claro en el disco — sin error, sin prueba roja y
 * sin nada que mirar hasta el dia en que alguien se lleve el almacen.
 *
 * Los archivos de prueba quedan fuera: siembran registros a mano a proposito, incluido alguno en
 * claro para comprobar que se migra.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const fuentes = listar("'*.ts' '*.tsx' '*.mts'").filter((f) => !/\.spec\.tsx?$/.test(f));

/** La clave del almacen donde vive una credencial local. */
const PREFIJO = 'auth:credencial:';

/** El campo que solo existe en el disco: lo escribe y lo lee el mismo archivo. */
const CAMPO_CIFRADO = 'totpSecretCipher';

/** Quien la dueña de la clave, y quien la nombra con motivo. */
const LA_PUERTA = 'apps/shell/src/server/identity.ts';
const LA_NOMBRAN_CON_MOTIVO: Record<string, string> = {
  'apps/shell/src/server/backup.ts': 'Clasifica el prefijo: tiene que nombrarlo para excluirlo.',
  'tools/coherence/credenciales.spec.ts': 'Esta guarda.',
  'tools/coherence/respaldo.spec.ts': 'Usa la clave como ejemplo al explicarse.',
};

const contiene = (archivo: string, texto: string) =>
  readFileSync(`${raiz}/${archivo}`, 'utf8').includes(texto);

describe('la credencial local entra por una sola puerta', () => {
  it('hay fuentes que revisar', () => {
    expect(fuentes.length).toBeGreaterThan(0);
  });

  it('solo `identity.ts` nombra la clave del almacen, salvo quien tiene motivo escrito', () => {
    const laNombran = fuentes.filter((f) => contiene(f, PREFIJO));

    expect(laNombran).toContain(LA_PUERTA);
    expect(laNombran.filter((f) => f !== LA_PUERTA && !LA_NOMBRAN_CON_MOTIVO[f])).toEqual([]);
  });

  it('solo `identity.ts` conoce el campo cifrado, que es el que toca el disco', () => {
    expect(fuentes.filter((f) => contiene(f, CAMPO_CIFRADO))).toEqual([LA_PUERTA]);
  });
});

describe('la credencial no entra en el respaldo', () => {
  const tabla = readFileSync(`${raiz}/apps/shell/src/server/backup.ts`, 'utf8');

  /** La entrada de la tabla de `backup.ts`, con su clase, tal y como se declara. */
  const CLASE = new RegExp(
    `prefix: '${PREFIJO}',\\s*\\n\\s*kind: '([a-z-]+)'`,
  );

  it('la tabla clasifica el prefijo', () => {
    expect(tabla).toMatch(CLASE);
  });

  it('y lo deja fuera: cifrado o no, el archivo seria la identidad local entera', () => {
    // `respaldo.spec.ts` obliga a clasificar toda clave; esto fija ADEMAS la clase de esta, que
    // es la unica cuyo cambio convertiria el respaldo en un volcado de credenciales.
    expect(CLASE.exec(tabla)?.[1]).toBe('no-respaldar');
  });
});
