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
const listar = (pattern: string) =>
  execSync(`git -C ${raiz} ls-files ${pattern}`).toString().trim().split('\n').filter(Boolean);

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
    /getByTestId\(\s*['"]([\w .-]+)['"]\s*\)|\[data-testid\^?=["']([\w .-]+)["']/g,
    0,
  );
  /** El grupo 0 trae la coincidencia entera; se rescata el nombre de cualquiera de los dos. */
  const nombresPedidos = new Map<string, Set<string>>();
  for (const [entero, donde] of pedidos) {
    const nombre = /['"]([\w .-]+)['"]/.exec(entero)?.[1];
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

/**
 * Lo que `playwright.config.mts` nombra y lo que el disco tiene.
 *
 * La configuracion reparte las pruebas por NOMBRE DE ARCHIVO: una lista dice cuales tocan la
 * semilla y corren solas, y una etiqueta dice cuales dependen del catalogo de objetos. Las dos
 * son cadenas, y una cadena no la sigue ningun renombrado: cuando `cuentas.spec.ts` paso a
 * `accounts.spec.ts`, la lista siguio citando el nombre viejo y el archivo que muta la identidad
 * sembrada se fue al pase paralelo. No fallo la configuracion —Playwright ignora un patron que no
 * casa— sino veintisiete pruebas de otros archivos, por un motivo que no se parecia a la causa.
 */
describe('el reparto de la suite de navegador', () => {
  const config = leer('playwright.config.mts');

  const secuenciales = [...config.matchAll(/'([\w-]+\.spec\.ts)'/g)].map((m) => m[1] as string);
  const existentes = new Set(listar("'apps/shell/e2e/*.spec.ts'").map((f) => f.split('/').pop()));

  it('hay pruebas repartidas', () => {
    expect(secuenciales.length).toBeGreaterThan(3);
    expect(existentes.size).toBeGreaterThan(15);
  });

  it('todo archivo que la configuracion nombra existe', () => {
    expect(secuenciales.filter((f) => !existentes.has(f)).sort()).toEqual([]);
  });

  it('la etiqueta del catalogo la lleva algun describe', () => {
    const etiquetados = listar("'apps/shell/e2e/*.spec.ts'").filter((f) =>
      /@catalogo/.test(leer(f)),
    );
    expect(etiquetados.length).toBeGreaterThan(0);
    // Si la etiqueta se escribe mal, el pase del catalogo se queda vacio y nadie lo nota.
    expect(config).toMatch(/@catalogo/);
  });
});

/**
 * Lo que se oculta con `hidden` y lo que el CSS le pone de `display`.
 *
 * `hidden` solo trae `display: none` de la hoja del navegador, asi que CUALQUIER regla propia que
 * le ponga `display` al mismo elemento gana y el atributo deja de ocultar nada. No falla, no
 * avisa: el bloque se queda dibujado y se come las pulsaciones de lo que tiene debajo. Paso con
 * el menu de la cuenta, que tapaba la esquina de todas las pantallas.
 */
describe('lo que se oculta con hidden', () => {
  const css = hojas.map(leer).join('\n');

  /** La clase del elemento que lleva `hidden={...}`, buscando hacia atras en la misma etiqueta. */
  const conHidden = new Map<string, Set<string>>();
  for (const ruta of componentes) {
    const fuente = leer(ruta);
    for (const m of fuente.matchAll(/className="([\w-]+)"[^<>]*?\bhidden=\{/g)) {
      const clase = m[1] as string;
      if (!conHidden.has(clase)) conHidden.set(clase, new Set());
      (conHidden.get(clase) as Set<string>).add(ruta);
    }
  }

  it('hay algun elemento que se oculte asi', () => {
    expect(conHidden.size).toBeGreaterThan(0);
  });

  it('ninguna regla de display deja el atributo sin efecto', () => {
    const rotas = [...conHidden.keys()].filter((clase) => {
      const regla = new RegExp(`\\.${clase}\\s*\\{[^}]*\\bdisplay\\s*:`);
      if (!regla.test(css)) return false;
      // Con su escape explicito la regla propia vuelve a perder, que es lo que hace falta.
      return !new RegExp(`\\.${clase}\\[hidden\\]`).test(css);
    });
    expect(conOrigen(conHidden, rotas)).toEqual([]);
  });
});

/**
 * Los identificadores que el carril de administracion COMPONE con la ruta de cada seccion.
 *
 * La comprobacion general de testids acepta cualquier nombre que empiece por un prefijo conocido,
 * y `admin-nav-` es un prefijo: `admin-nav-tree` pasaba por bueno aunque ninguna seccion se llame
 * asi —la carpeta es `arbol`— y la prueba se quedaba esperando un enlace que nadie dibuja. Aqui
 * se compara el sufijo contra las rutas reales.
 */
describe('el carril de administracion', () => {
  const secciones = leer('apps/shell/src/components/admin/sections.ts');
  const rutas = new Set(
    [...secciones.matchAll(/href:\s*'(\/admin[\w/-]*)'/g)].map(
      (m) => (m[1] as string).split('/').pop() as string,
    ),
  );

  const pedidos = recoger(pruebas, /admin-nav-([\w-]+)/g);

  it('hay secciones y pruebas que comparar', () => {
    expect(rutas.size).toBeGreaterThan(5);
    expect(pedidos.size).toBeGreaterThan(0);
  });

  it('cada seccion que una prueba nombra existe en el carril', () => {
    const huerfanas = [...pedidos.keys()].filter((s) => !rutas.has(s));
    expect(conOrigen(pedidos, huerfanas)).toEqual([]);
  });
});

/**
 * Las clases de CSS que una prueba de navegador usa como selector.
 *
 * Los identificadores de prueba ya se atan arriba. Las CLASES no, y son la otra mitad de lo
 * mismo: `page.locator('.log__row')` es un contrato entre la prueba y el TSX que nadie relaciona,
 * porque una clase es una cadena en los dos lados.
 *
 * Se encontro leyendo la prueba del registro de auditoria, que decia comprobar que la columna
 * «quien» no muestra identificadores crudos. `.log__row` no existe —la tabla es `tabla` y sus
 * filas son `tr`—, asi que el contador daba cero siempre; y la unica asercion vivia dentro de
 * `if (filas.count() > 0)`. La prueba llevaba desde que se escribio saliendo verde sin mirar
 * nada, y con eso tapaba que la pagina SI mostraba `u-admin` en esa columna.
 *
 * Un selector que no casa con nada no falla: devuelve una lista vacia. Por eso hay que
 * preguntarlo aparte.
 */
describe('clases que usan las pruebas de navegador', () => {
  const clasesEscritas = new Set<string>();
  for (const archivo of listar(
    "'apps/shell/src/**/*.tsx' 'apps/shell/app/**/*.tsx' 'packages/ui-components/src/**/*.tsx'",
  )) {
    const texto = readFileSync(`${raiz}/${archivo}`, 'utf8');
    // `className="a b"`, y tambien lo que haya dentro de un `className={...}` con plantillas.
    for (const m of texto.matchAll(/className=(?:"([^"]*)"|\{([^}]*)\})/g)) {
      for (const palabra of ((m[1] ?? m[2]) as string).split(/[^A-Za-z0-9_-]+/)) {
        if (palabra) clasesEscritas.add(palabra);
      }
    }
  }

  const usadas: { archivo: string; clase: string }[] = [];
  for (const archivo of listar("'apps/shell/e2e/*.ts'")) {
    const texto = readFileSync(`${raiz}/${archivo}`, 'utf8');
    for (const m of texto.matchAll(/locator\(\s*'([^']*\.[A-Za-z][\w-]*[^']*)'/g)) {
      const selector = m[1] as string;
      // Un selector puede llevar varias clases y combinadores: se miran todas.
      for (const c of selector.matchAll(/\.([A-Za-z][\w-]*)/g)) {
        usadas.push({ archivo, clase: c[1] as string });
      }
    }
  }

  it('hay clases que comparar', () => {
    expect(clasesEscritas.size).toBeGreaterThan(50);
    expect(usadas.length).toBeGreaterThan(10);
  });

  it('toda clase que una prueba selecciona la escribe algun componente', () => {
    const fantasmas = usadas
      .filter(({ clase }) => !clasesEscritas.has(clase))
      .map(({ archivo, clase }) => `${archivo}: .${clase}`);
    expect([...new Set(fantasmas)].sort()).toEqual([]);
  });
});
