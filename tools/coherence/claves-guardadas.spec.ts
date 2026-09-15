import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { RENAMES } from '@app/module-model';

/**
 * Las claves que estan EN DISCO, contra las que declara el tipo — apartado 2.11.
 *
 * Es el contrato que hoy no ata nadie. Una definicion de modulo se guarda como JSON, y el JSON es
 * `unknown` para el compilador: renombrar una propiedad del tipo sin migrar lo guardado compila
 * perfectamente y deja de leerse el campo en todos los modulos que ya existen. No hay error, no
 * hay prueba roja; lo que hay es un grafico que sale sin formato y nadie sabe por que.
 *
 * Lo que se comprueba es la direccion que duele: que no quede escrita en el codigo una clave con
 * su nombre VIEJO despues de haberla renombrado. Si una fila de `RENAMES` dice que una clave paso
 * a llamarse de otra forma, ningun archivo del repositorio puede volver a escribirla con el nombre
 * de antes —ni la semilla, ni una prueba, ni un componente—, porque lo que escriba asi nacera ya
 * invisible para el codigo que lo lee.
 *
 * Y al reves: la clave vieja SI tiene que seguir apareciendo en la migracion, que es el unico
 * sitio donde nombrarla es correcto. Una fila que no se aplica en ninguna parte es una fila que
 * alguien copio y no termino.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

/**
 * Donde nombrar la clave vieja es legitimo.
 *
 * La migracion, porque es la que la busca —el prefijo cubre tambien su prueba, cuyo fixture esta a
 * proposito en la forma vieja—, y esta guarda, que tiene que escribirla para explicarse.
 */
const MIGRACION = 'packages/module-model/src/migrateDefinition';
const ESTA_GUARDA = 'tools/coherence/claves-guardadas.spec.ts';

const fuentes = listar("'*.ts' '*.tsx' '*.mts'").filter(
  (f) => !f.startsWith(MIGRACION) && f !== ESTA_GUARDA,
);

/**
 * La clave escrita como CLAVE, no la palabra suelta.
 *
 * `presentacion: {` es una clave; «la presentacion de la instancia» en un comentario es prosa
 * espanola, y la aplicacion habla espanol. Buscar la palabra a secas daria decenas de falsos
 * positivos y terminaria con alguien relajando la guarda.
 */
const comoClave = (nombre: string) =>
  new RegExp(`(^|[{,(\\s])['"\`]?${nombre}['"\`]?\\??\\s*:`, 'm');

describe('las claves guardadas en disco (2.11)', () => {
  it('hay renombrados declarados', () => {
    expect(RENAMES.length).toBeGreaterThan(0);
  });

  it('ninguna clave ya renombrada se vuelve a escribir con su nombre viejo', () => {
    const culpables: string[] = [];

    for (const { from } of RENAMES) {
      const patron = comoClave(from);
      for (const ruta of fuentes) {
        const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
        if (patron.test(fuente)) culpables.push(`${ruta}: ${from}`);
      }
    }

    expect(culpables, `claves viejas escritas de nuevo:\n  ${culpables.join('\n  ')}`).toEqual([]);
  });

  it('cada renombrado nombra la clave vieja en la migracion, que es donde toca', () => {
    const migracion = readFileSync(`${raiz}/${MIGRACION}.ts`, 'utf8');

    for (const { from, to } of RENAMES) {
      // Una fila que no se aplica en ninguna parte es una fila que alguien copio y no termino.
      expect(migracion).toContain(from);
      expect(migracion).toContain(to);
    }
  });
});
