#!/usr/bin/env node
/**
 * Renombrado al ingles de las carpetas que quedaban en espanol.
 *
 * Cubre dos cosas distintas y por eso se lee entera:
 *
 * 1. Carpetas INTERNAS —`tools/`, paquetes, fixtures—. Son identificadores puros: nadie fuera
 *    del repositorio las nombra, y renombrarlas no rompe nada mas que un `import`.
 *
 * 2. Carpetas de `apps/shell/app/` que definen una URL. Ahi el renombrado SI es visible: cambia
 *    la direccion que una persona tiene guardada. Se renombran todas menos `m/[slug]`, que es
 *    la URL de un modulo: es la que se guarda en marcadores, la que se incrusta en otro portal
 *    y la que se reparte por correo. Romperla no es una molestia, es perder el acceso.
 *
 *    El grupo `(modulos)` que la contiene SI se renombra: los parentesis lo sacan de la URL, asi
 *    que es una carpeta interna con forma de ruta.
 *
 * Se conserva en el arbol como registro de la correspondencia.
 *
 *   node tools/rename/migrate-folders.mjs [--check]
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const solo = process.argv.includes('--check');

/**
 * De carpeta a su NUEVO nombre, sin tocar el resto de la ruta.
 *
 * Solo el ultimo segmento: renombrar una carpeta a otra rama dejaria a su madre vacia y `git mv`
 * se niega a mover una carpeta vacia. Se aplica de la mas honda a la mas somera, y asi cuando le
 * toca a la madre ya se lleva dentro a las hijas con su nombre nuevo.
 */
const CARPETAS = [
  // Grupo de rutas: entre parentesis no aparece en la URL, asi que `/m/[slug]` no se mueve.
  ['apps/shell/app/(modulos)', '(modules)'],
  // Rutas del panel de administracion.
  ['apps/shell/app/admin/ambitos', 'scopes'],
  ['apps/shell/app/admin/auditoria', 'audit'],
  ['apps/shell/app/admin/cuentas', 'accounts'],
  ['apps/shell/app/admin/equipos', 'teams'],
  ['apps/shell/app/admin/modulos/arbol', 'tree'],
  ['apps/shell/app/admin/modulos/paquetes', 'packages'],
  ['apps/shell/app/admin/modulos', 'modules'],
  ['apps/shell/app/admin/origenes', 'sources'],
  ['apps/shell/app/admin/quien-ve-que', 'who-sees-what'],
  ['apps/shell/app/admin/recursos/complementos', 'addons'],
  ['apps/shell/app/admin/recursos/contenedores', 'containers'],
  ['apps/shell/app/admin/recursos/elementos', 'elements'],
  ['apps/shell/app/admin/recursos/otros', 'other'],
  ['apps/shell/app/admin/recursos/visualizaciones', 'visualizations'],
  ['apps/shell/app/admin/recursos', 'resources'],
  ['apps/shell/app/admin/temas', 'themes'],
  ['apps/shell/app/admin/usuarios', 'users'],

  // Resto del cromo.
  ['apps/shell/app/acceso', 'sign-in'],
  ['apps/shell/app/admin-sin-permiso', 'admin-without-permission'],
  ['apps/shell/app/avisos', 'notices'],
  ['apps/shell/app/editor-sin-permiso', 'editor-without-permission'],
  ['apps/shell/app/restablecer', 'reset'],
  ['apps/shell/app/(incrustado)/incrustar', 'embed'],
  ['apps/shell/app/(incrustado)', '(embedded)'],

  // Rutas de API.
  ['apps/shell/app/api/acceso', 'sign-in'],
  ['apps/shell/app/api/admin/ambitos', 'scopes'],
  ['apps/shell/app/api/admin/arbol', 'tree'],
  ['apps/shell/app/api/admin/auditoria', 'audit'],
  ['apps/shell/app/api/admin/cuentas', 'accounts'],
  ['apps/shell/app/api/admin/equipos', 'teams'],
  ['apps/shell/app/api/admin/esquema', 'schema'],
  ['apps/shell/app/api/admin/paquetes', 'packages'],
  ['apps/shell/app/api/admin/quien-ve-que', 'who-sees-what'],
  ['apps/shell/app/api/alertas', 'alerts'],
  ['apps/shell/app/api/consulta', 'query'],
  ['apps/shell/app/api/exportaciones/[id]/descarga', 'download'],
  ['apps/shell/app/api/exportaciones', 'exports'],
  ['apps/shell/app/api/marcadores', 'bookmarks'],
  ['apps/shell/app/api/modulos/[slug]/edicion', 'edit'],
  ['apps/shell/app/api/modulos/[slug]/estado', 'status'],
  ['apps/shell/app/api/modulos/[slug]/vista', 'view'],
  ['apps/shell/app/api/modulos', 'modules'],
  ['apps/shell/app/api/navegacion', 'navigation'],
  ['apps/shell/app/api/notificaciones', 'notifications'],
  ['apps/shell/app/api/restablecer', 'reset'],
  ['apps/shell/app/api/sesion/equipo-activo', 'active-team'],
  ['apps/shell/app/api/sesion', 'session'],
  ['apps/shell/app/api/suscripciones', 'subscriptions'],

  // Carpetas internas.
  ['apps/modules/modulo-ejemplo', 'sample-module'],
  ['apps/shell/public/marca', 'brand'],
  ['tools/carga', 'load'],
  ['tools/coherencia', 'coherence'],
  ['docs/arquitectura', 'architecture'],
  ['docs/operacion', 'operations'],
];

/** La ruta que resulta de cambiarle el ultimo segmento. */
const destinoDe = ([vieja, base]) => [...vieja.split('/').slice(0, -1), base].join('/');

/** De la mas honda a la mas somera: la madre se mueve cuando sus hijas ya tienen nombre nuevo. */
const PROFUNDAS = [...CARPETAS].sort(
  (a, b) => b[0].split('/').length - a[0].split('/').length,
);

/**
 * Cadenas a sustituir en el contenido.
 *
 * Salen de las carpetas —una ruta de URL es su carpeta— mas los pocos sitios donde el mismo
 * nombre viaja sin carpeta delante. Se sustituye de la mas larga a la mas corta.
 */
function reemplazos() {
  const pares = [];
  for (const carpeta of CARPETAS) {
    const [vieja] = carpeta;
    const nueva = destinoDe(carpeta);
    pares.push([vieja, nueva]);
    // La ruta publica: `apps/shell/app/admin/temas` -> `/admin/themes`.
    const url = (ruta) =>
      ruta
        .replace('apps/shell/app', '')
        .replace(/\/\([^)]+\)/g, '');
    const a = url(vieja);
    const b = url(nueva);
    if (a && a !== b) pares.push([a, b]);
  }
  return pares.sort((x, y) => y[0].length - x[0].length);
}

if (solo) {
  for (const carpeta of CARPETAS) {
    const existe = existsSync(`${raiz}/${carpeta[0]}`);
    console.log(`${existe ? 'mv' : '--'} ${carpeta[0]} -> ${destinoDe(carpeta)}`);
  }
  process.exit(0);
}

for (const carpeta of PROFUNDAS) {
  const [vieja] = carpeta;
  if (!existsSync(`${raiz}/${vieja}`)) continue;
  execSync(`git -C ${raiz} mv "${vieja}" "${destinoDe(carpeta)}"`);
}

const pares = reemplazos();
const archivos = execSync(
  `git -C ${raiz} ls-files '*.ts' '*.tsx' '*.mts' '*.mjs' '*.json' '*.md' '*.css' '*.yml' '*.yaml' '*.bicep'`,
).toString().trim().split('\n').filter(Boolean);

let tocados = 0;
for (const relativa of archivos) {
  if (relativa === 'tools/rename/migrate-folders.mjs') continue;
  const ruta = `${raiz}/${relativa}`;
  const antes = readFileSync(ruta, 'utf8');
  let despues = antes;
  for (const [vieja, nueva] of pares) despues = despues.split(vieja).join(nueva);
  if (despues !== antes) {
    writeFileSync(ruta, despues);
    tocados += 1;
  }
}
console.log(`${CARPETAS.length} carpetas, ${tocados} archivos reescritos`);
