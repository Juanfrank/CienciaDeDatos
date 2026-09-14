import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentar } from '../rename/segmentos.mjs';

/**
 * Toda URL interna que el codigo pide tiene que existir como ruta.
 *
 * La URL vive en una cadena y la ruta es una CARPETA: nada las ata. El renombrado al ingles
 * tradujo la URL del panel de «quien ve que» dentro del componente y de las pruebas, y dejo la
 * carpeta como estaba. La pagina pasaba a ser un 404 — y la prueba de
 * accesibilidad seguia en verde, porque un 404 tambien es accesible.
 *
 * La primera version solo miraba `/admin` y `/api/admin`, y por ese hueco se colaron dos mas:
 * `redirect('/editor-without-permission')` y su gemelo de `/admin`, con las carpetas todavia en
 * `editor-sin-permiso` y `admin-sin-permiso`. Quien no tiene permiso para editar acababa en un
 * 404 en vez de en la pantalla que se lo explica. Ahora se miran TODAS.
 *
 * Las URL del producto estan en espanol —`/sign-in`, `/notices`, `/reset`— y se quedan asi:
 * son lo que una persona ve y comparte, no un identificador. El renombrado al ingles no debia
 * tocarlas.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const app = join(raiz, 'apps/shell/app');

/** Las rutas de API, como listas de segmentos. Un `[param]` es un comodin. */
function rutasDeApi(dir: string, prefijo: string[] = []): string[][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (!e.isDirectory()) return [];
    const segmentos = [...prefijo, e.name];
    const propia = existsSync(join(dir, e.name, 'route.ts')) ? [segmentos] : [];
    return [...propia, ...rutasDeApi(join(dir, e.name), segmentos)];
  });
}

/** Las rutas estaticas que el enrutador sirve de verdad, sin los grupos entre parentesis. */
function rutas(dir: string, prefijo = ''): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => {
      // `(modules)` agrupa sin aparecer en la URL; `[slug]` es dinamico y aqui no se comprueba.
      const segmento = /^\(.*\)$/.test(e.name) ? prefijo : `${prefijo}/${e.name}`;
      return [segmento, ...rutas(join(dir, e.name), segmento)];
    });
}

function fuentes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === '.next' || e.name === 'node_modules' ? [] : fuentes(ruta);
    // `.mts` cuenta: los scripts de `tools/` se escriben asi, y es justo donde estaba la rotura.
    // Con `/\.tsx?$/` la carpeta entraba en la lista y salian cero archivos, que es la forma
    // mas silenciosa de que una guarda no compruebe nada.
    return /\.m?tsx?$/.test(e.name) ? [ruta] : [];
  });
}

/**
 * Donde se buscan URL internas.
 *
 * `tools/` entra por la misma razon que entro `/api`: el hueco se llena solo. `capture-admin.mts`
 * apuntaba a `/admin/arbol` y a `/admin/sees-who-where`, dos rutas que el renombrado al ingles
 * movio, y nadie se entero porque un script de capturas solo falla cuando alguien lo ejecuta. No
 * compila menos, no rompe ninguna prueba, y el dia que se necesita la captura sale un 404.
 */
const DONDE = ['apps/shell', 'tools'];

describe('rutas', () => {
  const servidas = new Set(rutas(app).filter(Boolean));

  it('el enrutador declara las rutas que se esperan', () => {
    expect(servidas.has('/admin/who-sees-what')).toBe(true);
    expect(existsSync(join(app, 'api/admin/who-sees-what/route.ts'))).toBe(true);
  });

  it('ninguna URL interna apunta a una ruta que no existe', () => {
    const rotas: string[] = [];
    for (const archivo of DONDE.flatMap((d) => fuentes(join(raiz, d)))) {
      const contenido = readFileSync(archivo, 'utf8');
      // Solo lo que NAVEGA de verdad. Una cadena suelta que empieza por barra puede ser el
      // trozo final de una ruta de API compuesta con plantilla, o el nombre de un fixture.
      for (const m of contenido.matchAll(
        /(?:redirect|push|replace|goto)\(\s*['"`](\/[^'"`${}]*)|href=["'`](\/[^'"`${}]*)/g,
      )) {
        const url = (m[1] ?? m[2]) as string;
        if (!url || url === '/') continue;
        // Las dinamicas y las de datos no son paginas; los ficheros estaticos tampoco.
        if (/\[|\.|^\/api\b/.test(url)) continue;
        // Un prefijo servido basta: `/m/casos-pendientes` cuelga de `/m/[slug]`.
        if (servidas.has(url) || [...servidas].some((r) => url.startsWith(`${r}/`))) continue;
        rotas.push(`${archivo.slice(raiz.length + 1)}: ${url}`);
      }
    }
    expect([...new Set(rotas)].sort()).toEqual([]);
  });

  /*
   * Y las que viajan en una TABLA, no en la llamada.
   *
   * La comprobacion de arriba mira lo que esta dentro de `goto(...)` o de un `href`, y eso deja
   * fuera el caso mas comun en un script: una lista de rutas arriba y un bucle abajo que las
   * recorre. Asi estaban `/admin/arbol` y su gemela en `capture-admin.mts`: rutas muertas dentro
   * de un array, a diez lineas del `goto` que las usaba.
   *
   * Se reconoce una URL por su PRIMER segmento: si empieza por uno que el enrutador sirve de
   * verdad —`/admin`, `/editor`, `/m`…—, es una direccion de esta aplicacion y tiene que existir.
   * Una cadena que empiece por cualquier otra cosa no se toca, y eso es lo que mantiene la
   * comprobacion sin falsos positivos.
   */
  it('ninguna URL suelta en una tabla apunta a una ruta que no existe', () => {
    const raices = new Set(
      [...servidas].map((r) => r.split('/')[1]).filter((s): s is string => Boolean(s)),
    );

    /*
     * Aqui se compara por SEGMENTOS, no por prefijo.
     *
     * La comprobacion de arriba acepta cualquier URL que cuelgue de una ruta servida, porque
     * necesita que `/m/casos-pendientes` pase por `/m/[slug]`. Esa misma indulgencia deja pasar
     * `/admin/lo-que-sea`, que es exactamente la rotura que se busca. Con segmentos, un `[slug]`
     * es comodin donde LO HAY —`/m/casos-pendientes` casa— y `/admin/arbol` no casa con nada,
     * porque bajo `/admin` no hay ningun segmento dinamico.
     */
    const declaradas = [...servidas].map((r) => r.split('/').filter(Boolean));
    const casaPagina = (url: string): boolean => {
      const pedida = url.split('/').filter(Boolean);
      return declaradas.some(
        (ruta) =>
          ruta.length === pedida.length &&
          ruta.every((seg, i) => /^\[.*\]$/.test(seg) || seg === pedida[i]),
      );
    };

    const rotas: string[] = [];
    for (const archivo of DONDE.flatMap((d) => fuentes(join(raiz, d)))) {
      const contenido = readFileSync(archivo, 'utf8');
      for (const m of contenido.matchAll(/['"](\/[a-z][\w/-]*)['"]/g)) {
        const url = m[1] as string;
        const primero = url.split('/')[1];
        if (!primero || !raices.has(primero)) continue;
        if (casaPagina(url)) continue;
        rotas.push(`${archivo.slice(raiz.length + 1)}: ${url}`);
      }
    }
    expect([...new Set(rotas)].sort()).toEqual([]);
  });
});

/**
 * Lo mismo para las rutas de API, que es por donde se colo todo.
 *
 * La guarda de arriba se saltaba `/api` a proposito —«no son paginas»— y ese hueco dejo pasar
 * cinco roturas de golpe en el renombrado al ingles: `/api/modules/${slug}/edicion` cuando la
 * carpeta ya era `edit`, `/api/exports/${id}/descarga` cuando era `download`, y una URL literal
 * con el slug escrito a mano. Ninguna dejo de compilar; todas devolvian el HTML de un 404, y el
 * `await respuesta.json()` reventaba diez lineas mas alla con «Unexpected token '<'».
 *
 * Se comparan por SEGMENTOS: lo que el codigo interpola —`${slug}`— o escribe concreto
 * —`casos-pendientes`— casa contra el `[slug]` de la carpeta, y el resto tiene que coincidir.
 */
describe('rutas de API', () => {
  const declaradas = rutasDeApi(join(app, 'api')).map((s) => ['api', ...s]);

  /** `/api/modules/${slug}/edit?x=1` -> ['api','modules','*','edit'] */
  function segmentosDe(url: string): string[] {
    const [sinConsulta = ''] = url.split('?');
    const [camino = ''] = sinConsulta.split('#');
    return camino
      .replace(/^\//, '')
      .split('/')
      .filter(Boolean)
      .map((s) => (s.includes('${') ? '*' : s));
  }

  const casa = (pedida: string[]) =>
    declaradas.some(
      (ruta) =>
        ruta.length === pedida.length &&
        ruta.every((seg, i) => /^\[.*\]$/.test(seg) || seg === pedida[i] || pedida[i] === '*'),
    );

  it('hay rutas de API que comparar', () => {
    expect(declaradas.length).toBeGreaterThan(15);
  });

  // Se cuenta CADA carpeta: si una deja de devolver archivos, la guarda la recorre en vano.
  it.each(DONDE)('hay fuentes que revisar en %s', (carpeta) => {
    expect(fuentes(join(raiz, carpeta)).length).toBeGreaterThan(0);
  });

  it('ninguna URL de API apunta a una ruta que no existe', () => {
    const rotas: string[] = [];
    for (const archivo of DONDE.flatMap((d) => fuentes(join(raiz, d)))) {
      // Se miran solo las CADENAS: `page.request.post('/api/...')` escrito dentro de un
      // comentario es prosa, no una llamada, y no hay ruta que pueda casar con «...».
      const contenido = (segmentar(readFileSync(archivo, 'utf8')) as { tipo: string; texto: string }[])
        .filter((s) => s.tipo !== 'comentario')
        .map((s) => s.texto)
        .join('');
      for (const m of contenido.matchAll(/['"`](\/api\/[^'"`\s]*)['"`]/g)) {
        const url = m[1] as string;
        // Una URL partida en dos —`'/api/modules/' + algo`— no se puede comprobar entera.
        if (url.endsWith('/')) continue;
        if (casa(segmentosDe(url))) continue;
        rotas.push(`${archivo.slice(raiz.length + 1)}: ${url}`);
      }
    }
    expect([...new Set(rotas)].sort()).toEqual([]);
  });
});
