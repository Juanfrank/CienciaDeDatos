import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Los nombres de campo que viajan por HTTP, leidos en un lado y escritos en el otro.
 *
 * Un `Route Handler` lee su cuerpo por cadena —`body['code']`— y quien llama lo escribe como
 * clave de objeto —`{ code }`—. Son dos lados de un contrato que el compilador no relaciona: la
 * cadena no es un identificador, asi que renombrar la clave deja la lectura intacta y al reves.
 * El resultado es una peticion que sale bien formada, llega, y el servidor no encuentra el campo.
 *
 * Paso exactamente eso con el codigo TOTP: el formulario de acceso y las pruebas pasaron a mandar
 * `code` y las dos rutas seguian leyendo `body['codigo']`. Nada dejo de compilar, ninguna prueba
 * unitaria se inmuto, y la aplicacion entera se quedo sin poder iniciar sesion. Se vio nueve
 * minutos despues, cuando las 424 pruebas de navegador fallaron a la vez.
 */

const raiz = execSync("git rev-parse --show-toplevel").toString().trim();
const listar = (patron: string) =>
  execSync(`git -C ${raiz} ls-files ${patron}`)
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

const fuentes = listar(
  "'apps/shell/src/**' 'apps/shell/app/**' 'apps/shell/e2e/**'",
).filter((f) => /\.tsx?$/.test(f));
const contenido = new Map(
  fuentes.map((f) => [f, readFileSync(`${raiz}/${f}`, "utf8")]),
);

/** `body['campo']`, que es como una ruta lee lo que le mandaron. */
const LECTURA = /\bbody\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]/g;

/**
 * Cualquier identificador usado como clave de objeto.
 *
 * Cubre las tres formas con las que se escribe un cuerpo —`{ code: valor }`, la abreviada
 * `{ code }` y la condicional `...(x ? { code } : {})`— sin intentar averiguar si ese objeto
 * concreto acaba en una peticion. La pregunta que importa es mas simple: si NADIE en toda la
 * aplicacion escribe ese nombre como clave, nadie puede estar mandandolo.
 */
const CLAVE = /([A-Za-z_$][\w$]*)\s*:|[{,]\s*([A-Za-z_$][\w$]*)\s*[,}]/g;

/**
 * Campos que se leen y que nadie manda todavia, con su motivo.
 *
 * La rama mensual de una suscripcion esta escrita y tiene valor por defecto, pero ni el
 * formulario ni ninguna prueba la ejercita: hoy solo se crean suscripciones diarias y semanales.
 * No esta rota —`?? 1` la cubre—, esta sin estrenar, y es distinto.
 */
const SIN_EMISOR = new Map<string, string>([
  [
    "diaMes",
    "la cadencia mensual existe en la API y todavia no la pide ni el formulario ni una prueba",
  ],
]);

describe("campos que viajan por HTTP", () => {
  const leidos = new Map<string, Set<string>>();
  for (const [ruta, fuente] of contenido) {
    for (const m of fuente.matchAll(LECTURA)) {
      const campo = m[1] as string;
      if (!leidos.has(campo)) leidos.set(campo, new Set());
      (leidos.get(campo) as Set<string>).add(ruta);
    }
  }

  const escritos = new Set<string>();
  for (const fuente of contenido.values()) {
    for (const m of fuente.matchAll(CLAVE))
      escritos.add((m[1] ?? m[2]) as string);
  }

  it("hay campos que comparar", () => {
    expect(leidos.size).toBeGreaterThan(15);
    expect(escritos.size).toBeGreaterThan(100);
  });

  it("todo campo que una ruta lee lo escribe alguien", () => {
    const huerfanos = [...leidos.keys()]
      .filter((campo) => !escritos.has(campo) && !SIN_EMISOR.has(campo))
      .map(
        (campo) =>
          `${campo} <- ${[...(leidos.get(campo) as Set<string>)].join(", ")}`,
      )
      .sort();
    expect(huerfanos).toEqual([]);
  });
});
