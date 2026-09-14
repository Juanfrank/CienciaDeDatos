/*
 * Renombra los identificadores de prueba que se construyen con una plantilla.
 *
 * `data-testid={`anadir-${o.objectId}`}` lleva el prefijo en el componente y el nombre entero en
 * la prueba: `getByTestId('anadir-barras')`. El renombrado normal ve el nombre entero en la
 * prueba y lo traduce, pero del componente solo ve un trozo de plantilla, asi que los dos lados
 * se separan y la prueba busca un testid que nadie escribe.
 *
 * Solo se sustituye en POSICION de testid —`data-testid=`, `prueba=`, `getByTestId(`, y el
 * selector `[data-testid...=` — y nunca en cualquier cadena que empiece igual: `titulo-` es
 * tambien el principio del objectId `titulo-de-seccion`, y `equipo-` el de los ids del seed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const mapa = JSON.parse(readFileSync('tools/rename/prefijos-de-prueba.json', 'utf8'));
const claves = Object.keys(mapa).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternativa = claves.map(esc).join('|');

/** Los sitios donde una cadena ES un testid. El prefijo va justo tras la comilla. */
const POSICIONES = [
  String.raw`(data-testid\s*=\s*\{?["'\`])(${alternativa})`,
  String.raw`(prueba\s*=\s*\{?["'\`])(${alternativa})`,
  String.raw`(getByTestId\(\s*["'\`])(${alternativa})`,
  String.raw`(\[data-testid[^\]]*?=\s*["'])(${alternativa})`,
];

let n = 0;
let tocados = 0;
for (const ruta of execSync("git ls-files 'apps/shell/**'").toString().trim().split('\n')) {
  if (!/\.(tsx?|css)$/.test(ruta)) continue;
  const antes = readFileSync(ruta, 'utf8');
  let despues = antes;
  for (const patron of POSICIONES) {
    despues = despues.replace(new RegExp(patron, 'g'), (_, ancla, prefijo) => {
      n += 1;
      return ancla + mapa[prefijo];
    });
  }
  if (antes !== despues) {
    writeFileSync(ruta, despues);
    tocados += 1;
  }
}
console.log(`${n} prefijos de testid en ${tocados} archivos`);
