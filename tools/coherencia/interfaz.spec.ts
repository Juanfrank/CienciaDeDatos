import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { initialCatalog } from '@app/ui-components';

/**
 * Los nombres con los que el TSX, el CSS y las pruebas de navegador se buscan entre si.
 *
 * Un atributo `data-*` y un identificador de prueba son contratos entre dos archivos que nada
 * ata: un lado lo escribe, el otro lo busca, y el compilador no relaciona uno con otro. Cuando
 * el renombrado al ingles movio un lado y no el otro, la regla de estilo dejo de aplicarse y la
 * prueba se quedo esperando treinta segundos por un elemento que nadie dibuja. Aqui se ve en un
 * segundo.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const leer = (ruta: string) => readFileSync(`${raiz}/${ruta}`, 'utf8');

/** Los componentes: todo el TSX y TS de la aplicacion, sin sus propias pruebas. */
const componentes = listar("'apps/shell/src/**' 'apps/shell/app/**'").filter(
  (f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f),
);
/*
 * Toda la hoja de estilo del repositorio.
 *
 * El patron anterior era `apps/shell/app/**\/*.css`, y `git ls-files` no devolvia NADA con el:
 * su comodin exige al menos una carpeta intermedia y `globals.css` cuelga directamente de `app`.
 * La lista vacia no fallaba —comparar cero selectores contra el TSX sale verde siempre—, asi que
 * la comprobacion llevaba desde el primer dia sin mirar un solo archivo. De ahi el recuento de
 * mas abajo: una guarda sin entrada no es una guarda.
 */
const hojas = listar("'*.css'");
const pruebas = listar("'apps/shell/e2e/*.ts'");

/** Todo lo que se recoge de una lista de archivos con una expresion regular. */
function recoger(rutas: string[], re: RegExp, grupo = 1): Map<string, Set<string>> {
  const encontrados = new Map<string, Set<string>>();
  for (const ruta of rutas) {
    for (const m of leer(ruta).matchAll(re)) {
      const valor = m[grupo] as string;
      if (!encontrados.has(valor)) encontrados.set(valor, new Set());
      (encontrados.get(valor) as Set<string>).add(ruta);
    }
  }
  return encontrados;
}

const conOrigen = (mapa: Map<string, Set<string>>, claves: string[]) =>
  claves.map((k) => `${k} <- ${[...(mapa.get(k) as Set<string>)].join(', ')}`).sort();

describe('atributos de datos', () => {
  // `data-x=` en el JSX y `dataset.x` cuando se escribe desde un efecto.
  const puestos = new Set([
    ...recoger(componentes, /\bdata-([a-z][\w-]*)\s*=/g).keys(),
    ...recoger(componentes, /\bdataset\.([a-zA-Z][\w]*)/g).keys(),
  ]);
  const usados = recoger(hojas, /\[data-([a-z][\w-]*)/g);

  it('hay hojas de estilo que revisar', () => {
    expect(hojas.length).toBeGreaterThan(0);
    expect(usados.size).toBeGreaterThan(5);
  });

  it('ningun selector espera un atributo que ya no se escribe', () => {
    expect([...usados.keys()].filter((a) => !puestos.has(a)).sort()).toEqual([]);
  });

  it('ningun atributo de la interfaz se queda a medio camino de ser `data-`', () => {
    // `data-pestana` se convirtio en `tab-data`, que el navegador no reconoce como atributo de
    // datos: el selector lo encontraba solo porque los dos lados llevaban el mismo error.
    expect([...recoger(componentes, /\s([a-z][\w-]*-data)\s*=\s*\{/g).keys()].sort()).toEqual([]);
  });

  it('ningun selector de atributo apunta a un atributo que no existe', () => {
    // `body[sidebar-data='oculto']` no fallaba por el lado del TSX —ahi el atributo se escribe
    // con `dataset.sidebar`, que esta bien— sino por el del CSS: la comprobacion de arriba busca
    // `[data-`, y un nombre al que se le quito el prefijo es invisible para ella. El navegador
    // tampoco protesta: aplica el selector, no encuentra nada y la regla se queda muda.
    const ESTANDAR =
      /^(aria-[\w-]+|data-[\w-]+|role|type|href|src|alt|title|lang|dir|id|class|name|for|rel|target|value|scope|open|hidden|disabled|checked|selected|multiple|readonly|required|placeholder|tabindex|contenteditable|draggable|style)$/;
    const atributos = recoger(hojas, /\[([a-zA-Z][\w-]*)[\]=~^$*|]/g);
    const invalidos = [...atributos.keys()].filter((a) => !ESTANDAR.test(a));
    expect(conOrigen(atributos, invalidos)).toEqual([]);
  });

  it('ningun atributo de datos lleva mayusculas', () => {
    // El navegador pasa a minusculas el nombre del atributo, asi que `data-textPosition` llega al
    // DOM como `data-textposition` y el selector que lo busca tal cual no encuentra nada.
    expect([...puestos].filter((a) => a.includes('-') && a !== a.toLowerCase())).toEqual([]);
  });
});

describe('identificadores de prueba', () => {
  /** Lo que los componentes pueden producir: literales, prefijos de plantilla y los objectId. */
  const literales = new Set<string>(initialCatalog.map((o) => o.objectId));
  for (const id of recoger(
    componentes,
    /(?:data-testid|prueba)\s*[=:]\s*\{?["'`]([\w-]+)["'`]/g,
  ).keys()) {
    literales.add(id);
  }
  // `data-testid={`add-${objectId}`}` y el testid que viaja como argumento de una funcion.
  const prefijos = new Set(recoger(componentes, /`([\w-]*-)\$\{/g).keys());

  const pedidos = recoger(
    pruebas,
    /getByTestId\(\s*['"]([\w -]+)['"]\s*\)|\[data-testid\^?=["']([\w -]+)["']/g,
    0,
  );
  /** El grupo 0 trae la coincidencia entera; se rescata el nombre de cualquiera de los dos. */
  const nombresPedidos = new Map<string, Set<string>>();
  for (const [entero, donde] of pedidos) {
    const nombre = /['"]([\w -]+)['"]/.exec(entero)?.[1];
    if (!nombre) continue;
    if (!nombresPedidos.has(nombre)) nombresPedidos.set(nombre, new Set());
    donde.forEach((d) => (nombresPedidos.get(nombre) as Set<string>).add(d));
  }

  /**
   * Los prefijos que las pruebas COMPONEN, que es donde el renombrado se cuela sin que nadie mire.
   *
   * `arrastrar(page, `move-handle-${id}`)` no pasa por `getByTestId` —el testid viaja como
   * argumento de una funcion de la propia prueba—, asi que la comprobacion de arriba no lo
   * alcanza. Se descarta lo que interpola un reloj o un aleatorio: eso es un slug de modulo que
   * la prueba inventa para no chocar con la ejecucion anterior, no un testid.
   */
  const prefijosPedidos = new Map<string, Set<string>>();
  for (const ruta of pruebas) {
    const fuente = leer(ruta);
    for (const m of fuente.matchAll(/`([a-z][\w-]*-)((?:[^`\\]|\\.)*)`/g)) {
      const resto = m[2] as string;
      if (!/^\$\{/.test(resto) || /Date\.now|Math\.random/.test(resto)) continue;
      const p = m[1] as string;
      if (!prefijosPedidos.has(p)) prefijosPedidos.set(p, new Set());
      (prefijosPedidos.get(p) as Set<string>).add(ruta);
    }
  }

  it('hay componentes y pruebas que comparar', () => {
    expect(literales.size).toBeGreaterThan(100);
    expect(nombresPedidos.size).toBeGreaterThan(100);
  });

  it('cada testid que una prueba pide lo escribe algun componente', () => {
    const huerfanos = [...nombresPedidos.keys()].filter(
      (id) =>
        !literales.has(id) &&
        // Un prefijo casa en los dos sentidos: la prueba puede pedir el prefijo entero
        // (`matrix-collapse-x`) o quedarse en el tronco (`[data-testid^="block"]`).
        ![...prefijos].some((p) => id.startsWith(p) || p.startsWith(id)),
    );
    expect(conOrigen(nombresPedidos, huerfanos)).toEqual([]);
  });

  it('cada prefijo que una prueba compone lo escribe algun componente', () => {
    const huerfanos = [...prefijosPedidos.keys()].filter(
      (p) => ![...prefijos].some((c) => p.startsWith(c) || c.startsWith(p)),
    );
    expect(conOrigen(prefijosPedidos, huerfanos)).toEqual([]);
  });
});
