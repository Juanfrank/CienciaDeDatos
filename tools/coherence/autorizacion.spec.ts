import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Que toda superficie del panel pase por su guardian.
 *
 * El criterio de la seccion 9 no dice «que la interfaz lo oculte», dice que un Visor no pueda
 * entrar «aunque intente hacerlo mediante manipulacion directa de solicitudes (prueba a nivel de
 * backend, no solo ocultamiento de UI)». Hoy se cumple: los doce handlers de `/api/admin/*`
 * llaman a `withAdmin` y el `layout.tsx` del panel corta las paginas antes de dibujar nada.
 *
 * Lo que no habia es nada que lo MANTENGA. Una ruta nueva bajo `/api/admin/` que exporte un `GET`
 * y se olvide del envoltorio compila, pasa el lint, responde 200 y sirve el gobierno entero a
 * quien lo pida. No hay tipo que lo impida: `withAdmin` es una funcion que uno llama o no llama,
 * y el unico sitio donde la ausencia se nota es en produccion.
 *
 * Las pruebas de navegador comprueban el 403 en las rutas que EXISTEN hoy; una ruta que se anada
 * manana no aparece en ninguna de ellas. Por eso se comprueba aqui, sobre el arbol de archivos:
 * la pregunta es «¿queda alguna sin guardian?», y esa se responde mirando todas.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`).toString().trim().split('\n').filter(Boolean);

const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

describe('el panel de administracion no tiene puertas sin guardian', () => {
  const rutas = listar("'apps/shell/app/api/admin/**/route.ts'");

  it('hay rutas de panel que comprobar', () => {
    expect(rutas.length).toBeGreaterThan(5);
  });

  it('todo handler de /api/admin pasa por withAdmin', () => {
    const desnudos: string[] = [];
    for (const ruta of rutas) {
      const texto = readFileSync(`${raiz}/${ruta}`, 'utf8');
      for (const metodo of METODOS) {
        const inicio = texto.indexOf(`export async function ${metodo}(`);
        if (inicio < 0) continue;
        // Hasta el siguiente `export` de nivel superior, o hasta el final.
        const resto = texto.slice(inicio + 1);
        const siguiente = resto.indexOf('\nexport ');
        const cuerpo = siguiente < 0 ? resto : resto.slice(0, siguiente);
        if (!cuerpo.includes('withAdmin')) desnudos.push(`${metodo} ${ruta}`);
      }
    }
    expect(desnudos.sort()).toEqual([]);
  });

  /*
   * Las paginas las corta el layout, no cada `page.tsx`. Es lo correcto —un solo sitio que
   * decide— y por eso mismo conviene atarlo: si alguien lo quita, las trece paginas del panel se
   * quedan abiertas de golpe y ninguna de ellas se lee distinto.
   */
  it('el layout del panel corta a quien no administra', () => {
    const layout = readFileSync(`${raiz}/apps/shell/app/admin/layout.tsx`, 'utf8');
    expect(layout).toContain('isAdministrator');
    expect(layout).toContain('redirect(');
  });

  /*
   * Y que las paginas cuelguen de ese layout: una ruta de panel escrita fuera de `app/admin/`
   * —pongamos `app/gobierno/`— no lo heredaria, y el guardian no se aplicaria nunca.
   */
  it('toda pagina del panel vive bajo el layout que la guarda', () => {
    const paginas = listar("'apps/shell/app/admin/**/page.tsx'");
    expect(paginas.length).toBeGreaterThan(10);
    expect(paginas.filter((p) => !p.startsWith('apps/shell/app/admin/'))).toEqual([]);
  });
});

/**
 * Y que ninguna ruta de datos conteste sin sesion.
 *
 * `sessionGet()` devuelve `null` cuando no hay cookie, y `null` no rompe nada por si solo: la
 * ruta sigue, `sesion.userId` es lo unico que fallaria, y una ruta que solo LEE —el arbol de
 * navegacion, el estado de una exportacion— ni siquiera lo mira. El resultado es una ruta que
 * responde 200 con datos a quien no ha entrado. Hoy las quince lo comprueban; lo que falta es que
 * la dieciseis no pueda olvidarlo.
 *
 * Las publicas se listan una a una CON SU MOTIVO. Una lista de excepciones sin motivo se va
 * llenando: cada vez que la prueba estorba, se anade una linea y nadie recuerda por que.
 */
const PUBLICAS = new Map<string, string>([
  [
    'apps/shell/app/api/sign-in/route.ts',
    'es la puerta: pedir sesion para entrar no dejaria entrar a nadie',
  ],
  [
    'apps/shell/app/api/reset/route.ts',
    'restablecer la contrasena es justo para quien NO puede iniciar sesion; lo que autoriza es el token',
  ],
  [
    'apps/shell/app/api/hooks/dataset-refresh/route.ts',
    'lo llama la capa de analisis, no una persona; se autoriza con WEBHOOK_SECRET en cabecera',
  ],
]);

describe('ninguna ruta de datos contesta sin sesion', () => {
  const rutas = listar("'apps/shell/app/api/**/route.ts'").filter(
    (r) => !r.startsWith('apps/shell/app/api/admin/'),
  );

  it('las publicas declaradas siguen existiendo', () => {
    const fantasmas = [...PUBLICAS.keys()].filter((p) => !rutas.includes(p));
    expect(fantasmas).toEqual([]);
  });

  it('toda ruta privada pide sesion y rechaza si no la hay', () => {
    const abiertas: string[] = [];
    for (const ruta of rutas) {
      if (PUBLICAS.has(ruta)) continue;
      const texto = readFileSync(`${raiz}/${ruta}`, 'utf8');
      const pide = /\bsession(Get|Require)\s*\(/.test(texto);
      // Pedirla y no mirarla es lo mismo que no pedirla — y mirarla sin SALIR, tambien: la
      // primera version de esta guarda se contentaba con que existiera el `if`, y dejaba pasar
      // un `if (!sesion) { }` vacio, que es exactamente la rotura que venia a impedir.
      const rechaza =
        /if\s*\(\s*!\s*ses(ion)?\s*\)\s*(\{\s*)?return\b/.test(texto) ||
        /sessionRequire\s*\(/.test(texto);
      if (!pide || !rechaza) abiertas.push(ruta);
    }
    expect(abiertas.sort()).toEqual([]);
  });
});

/**
 * La siembra de credenciales de demostracion, detras de una puerta explicita.
 *
 * `asegurarCredenciales()` da de alta a TODAS las cuentas del gobierno con la misma contrasena y
 * el mismo secreto TOTP, los dos escritos en `demoCredentials.ts` dentro de este repositorio —el
 * secreto es ademas el vector de prueba publico de la RFC—. Se llamaba en cada peticion de acceso
 * sin ninguna condicion: en un despliegue real, el primer intento de entrar dejaba a la
 * institucion entera, Administradores incluidos, con una clave y un segundo factor publicos.
 *
 * Mirar `NODE_ENV` no habria servido, y por eso la puerta es una variable propia: las pruebas de
 * navegador arrancan con `next start`, que ES produccion. Lo que se comprueba aqui es que la
 * puerta siga puesta y que la llave solo la tengan las superficies de demostracion declaradas.
 * Una plantilla de despliegue que anadiera la variable pasaria desapercibida de cualquier otra
 * forma: es una linea de configuracion, y nadie la lee dos veces.
 */
describe('las credenciales de demostracion no se siembran solas', () => {
  const BANDERA = 'SEED_DEMO_CREDENTIALS';

  /** Donde SI se enciende, con el motivo por el que es legitimo. */
  const DEMOSTRACION = new Map<string, string>([
    ['playwright.config.mts', 'las pruebas de navegador necesitan cuentas contra las que entrar'],
    ['apps/shell/project.json', 'el objetivo `dev`, que es la demostracion local'],
    ['README.md', 'la documentacion que explica la puerta'],
    ['docs/hoja-de-ruta.md', 'el registro de por que se cerro y que falta ahora (2.15)'],
    [
      'tools/capture-admin.mts',
      'las instrucciones para levantar el servidor de demostracion contra el que captura',
    ],
    [
      'tools/capture-editor.mts',
      'las mismas instrucciones, para las capturas del editor',
    ],
    [
      'tools/capture-f69.mts',
      'las mismas instrucciones, para las capturas del acceso y el menu contextual',
    ],
    [
      'tools/capture-f6.mts',
      'las mismas instrucciones, para las capturas de la tanda F6',
    ],
    ['tools/coherence/autorizacion.spec.ts', 'esta misma guarda'],
  ]);

  it('la siembra comprueba la bandera antes de escribir nada', () => {
    const identidad = readFileSync(`${raiz}/apps/shell/src/server/identity.ts`, 'utf8');
    expect(identidad).toContain(BANDERA);
    // Y la comprobacion sale ANTES del bucle que guarda: sin el `return`, leer la variable no
    // impide nada.
    const cuerpo = identidad.slice(identidad.indexOf('export async function asegurarCredenciales'));
    expect(cuerpo.slice(0, cuerpo.indexOf('credentialsStore.save'))).toMatch(
      /if\s*\(\s*!\s*SIEMBRA_PERMITIDA\s*\)\s*return/,
    );
  });

  it('solo las superficies de demostracion declaradas encienden la bandera', () => {
    const encendida = listar("'*'").filter((archivo) => {
      if (/^(package-lock\.json|\.claude\/)/.test(archivo)) return false;
      try {
        return readFileSync(`${raiz}/${archivo}`, 'utf8').includes(BANDERA);
      } catch {
        return false;
      }
    });
    const inesperadas = encendida.filter(
      (f) => !DEMOSTRACION.has(f) && f !== 'apps/shell/src/server/identity.ts',
    );
    expect(inesperadas.sort()).toEqual([]);
  });
});
