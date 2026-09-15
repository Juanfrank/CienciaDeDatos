import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { RENAMES } from '@app/module-model';
// @ts-expect-error -- el escaner del renombrador es JavaScript con tipos en JSDoc, sin `.d.ts`.
import { segmentar, segmentarJsx } from '../rename/segmentos.mjs';

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

/**
 * Y solo en el CODIGO, que es lo que la tercera tanda obligo a afinar.
 *
 * Mientras las claves renombradas eran compuestas —`presentacion`, `colorDeResaltado`— el patron
 * de arriba bastaba: nadie escribe «colorDeResaltado:» en una frase. `ejes` y `escala` son
 * palabras corrientes del espanol, y en cuanto entraron aparecieron cuatro acusaciones falsas de
 * golpe: «titulos de los ejes: esos se suman aqui» en un comentario, «Una sola escala: la
 * comparacion es directa» dentro de un subtitulo, y el propio comentario de esta tanda que cita
 * la linea que arreglaba.
 *
 * Ninguna era un error; las cuatro habrian empujado a relajar la guarda. Se reutiliza el escaner
 * del renombrador, que ya sabe partir un archivo en codigo, comentario y cadena — es la misma
 * distincion que hace falta aqui, y tenerla en un solo sitio es lo que evita que las dos se
 * separen.
 */
const codigoDe = (fuente: string, jsx: boolean): string =>
  (jsx ? segmentarJsx(fuente) : segmentar(fuente))
    .filter((s: { tipo: string }) => s.tipo === 'codigo')
    .map((s: { texto: string }) => s.texto)
    .join('\n');

/**
 * Las claves viejas que son TAMBIEN el nombre legitimo de otra cosa.
 *
 * `ejes` paso a `axes` en la presentacion de un objeto, y a la vez es la clave con la que la
 * prueba de los temas cuenta los seis ejes de estilo —letra, escala, radios, borde, sombra,
 * tinte—. Son dos claves distintas que se llaman igual, en paquetes distintos, y ninguna migracion
 * las confunde porque la tabla declara la RUTA. La guarda no puede ver rutas: mira archivos.
 *
 * De ahi la excepcion, por archivo y con su motivo. No es una lista de «perdonados»: es la misma
 * leccion que la tabla de renombrados —`tipo` quiere decir cosas distintas en sitios distintos—
 * dicha donde la guarda puede aplicarla.
 */
const CONVIVEN: Record<string, string[]> = {
  // Los seis ejes de ESTILO de un tema, que no son los ejes de un grafico.
  'packages/design-tokens/src/graphicLineTheme.spec.ts': ['ejes', 'escala'],
};

describe('las claves guardadas en disco (2.11)', () => {
  it('hay renombrados declarados', () => {
    expect(RENAMES.length).toBeGreaterThan(0);
  });

  it('ninguna clave ya renombrada se vuelve a escribir con su nombre viejo', () => {
    const culpables: string[] = [];

    const codigo = new Map<string, string>();
    for (const ruta of fuentes) {
      const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
      codigo.set(ruta, codigoDe(fuente, ruta.endsWith('.tsx')));
    }

    for (const { from } of RENAMES) {
      const patron = comoClave(from);
      for (const [ruta, fuente] of codigo) {
        if (CONVIVEN[ruta]?.includes(from)) continue;
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
