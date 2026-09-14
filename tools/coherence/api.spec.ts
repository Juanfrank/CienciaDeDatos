import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentar } from "../rename/segmentos.mjs";

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
 *
 * La primera version de esta guarda no basto. Buscaba el nombre como clave de objeto en CUALQUIER
 * parte de la aplicacion, y cuando `correo` paso a `mail` en los dos emisores, la ruta se quedo
 * leyendo `body['correo']` y la comprobacion siguio en verde: `correo` seguia existiendo como
 * clave en un tipo y en el estado de un formulario. Ahora solo cuentan las claves que estan
 * DENTRO de un cuerpo que se envia, que es la unica pregunta que importa.
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

/**
 * Lo mismo sin comentarios ni cadenas, para buscar CLAVES.
 *
 * Un comentario en espanol lleva dos puntos con la misma naturalidad que un objeto: `// sale un
 * correo: de ese canal depende que el flujo sea seguro` hacia que `correo` contara como clave
 * enviada, y con eso la guarda dejaba pasar el campo de acceso que ya nadie mandaba.
 *
 * Solo vale para las claves. La LECTURA vive dentro de una cadena —`body['correo']`— y sobre el
 * texto limpio desaparece: eso es lo que hay que comparar, no lo que hay que limpiar. El
 * segmentador es el mismo que usa el renombrador para no traducir prosa.
 */
const codigoDe = new Map(
  fuentes.map((f) => [
    f,
    (segmentar(contenido.get(f) as string) as { tipo: string; texto: string }[])
      .filter((s) => s.tipo === "codigo")
      .map((s) => s.texto)
      .join(""),
  ]),
);

/** `body['campo']`, que es como una ruta lee lo que le mandaron. */
const LECTURA = /\bbody\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]/g;

/**
 * Las claves de cualquier objeto del archivo que llama.
 *
 * No se intenta seguir QUE objeto acaba en el cuerpo: se arman en una variable, se componen con
 * un spread —`{ ...comun, objeto, medida }`— y se serializan tres lineas mas abajo. Perseguir eso
 * con expresiones regulares da falsos positivos, y un falso positivo en una guarda termina con
 * alguien relajandola.
 *
 * El alcance ya lo pone `emisoresDe`: solo se miran los archivos que nombran la URL de ESTA ruta.
 * Dentro de ellos basta con que el nombre exista como clave. Es generoso a proposito, y aun asi
 * caza los dos fallos reales que hubo —`codigo` y `correo`—, porque el renombrado los cambio en
 * el emisor entero y no quedo ni rastro del nombre viejo.
 */
const CLAVE = /([A-Za-z_$][\w$]*)\s*:/g;
const ABREVIADA = /(?:[{,]\s*)([A-Za-z_$][\w$]*)\s*(?=[,}])/g;

/**
 * Las rutas son lo unico que lee por cadena.
 *
 * Una prueba que hace `body['estado']` esta leyendo una RESPUESTA, que es otro contrato y con
 * otros emisores. Aqui se compara lo que un `Route Handler` espera recibir.
 */
const rutas = fuentes.filter((f) => f.startsWith('apps/shell/app/api/'));

/** `apps/shell/app/api/modules/[slug]/status/route.ts` es `/api/modules/<lo-que-sea>/estado`. */
function urlDe(ruta: string): RegExp {
  const camino = ruta
    .replace(/^apps\/shell\/app/, '')
    .replace(/\/route\.tsx?$/, '')
    .replace(/\[[^\]]+\]/g, 'SEGMENTO');
  const patron = camino
    .split('/')
    .map((p) => (p === 'SEGMENTO' ? '[^/`\'"\\s]+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(patron);
}

/**
 * Quien manda a esta ruta: los archivos que nombran su URL.
 *
 * Es la diferencia entre esta guarda y la que no basto. La primera version preguntaba si el campo
 * existia como clave en ALGUNA parte de la aplicacion, y `correo` seguia existiendo en un tipo y
 * en el estado de un formulario mucho despues de que los dos emisores pasaran a mandar `mail`. La
 * pregunta correcta es mas estrecha: lo que lee esta ruta, ¿lo manda quien llama a ESTA ruta?
 */
function emisoresDe(ruta: string): string[] {
  const url = urlDe(ruta);
  return [...contenido].filter(([f, texto]) => f !== ruta && url.test(texto)).map(([f]) => f);
}

function clavesEnviadas(archivos: string[]): Set<string> {
  const claves = new Set<string>();
  for (const archivo of archivos) {
    const texto = codigoDe.get(archivo) as string;
    for (const m of texto.matchAll(CLAVE)) claves.add(m[1] as string);
    for (const m of texto.matchAll(ABREVIADA)) claves.add(m[1] as string);
  }
  return claves;
}

/**
 * Campos que se leen y que nadie manda todavia, con su motivo.
 *
 * La rama mensual de una suscripcion esta escrita y tiene valor por defecto, pero ni el
 * formulario ni ninguna prueba la ejercita: hoy solo se crean suscripciones diarias y semanales.
 * No esta rota —`?? 1` la cubre—, esta sin estrenar, y es distinto.
 */
const SIN_EMISOR = new Map<string, string>([
  [
    'diaMes',
    'la cadencia mensual existe en la API y todavia no la pide ni el formulario ni una prueba',
  ],
]);

describe('campos que viajan por HTTP', () => {
  const rotos: string[] = [];
  let comparadas = 0;

  for (const ruta of rutas) {
    const texto = contenido.get(ruta) as string;
    const leidos = [...new Set([...texto.matchAll(LECTURA)].map((m) => m[1] as string))];
    if (leidos.length === 0) continue;

    // Una ruta a la que nadie llama desde aqui la llama un sistema de fuera: su contrato no vive
    // en este repositorio y no hay con que compararlo.
    const emisores = emisoresDe(ruta);
    if (emisores.length === 0) continue;

    comparadas += 1;
    const enviadas = clavesEnviadas(emisores);
    for (const campo of leidos) {
      if (enviadas.has(campo) || SIN_EMISOR.has(campo)) continue;
      rotos.push(`${campo} <- ${ruta} (lo llaman: ${emisores.join(', ')})`);
    }
  }

  it('hay rutas que comparar', () => {
    expect(rutas.length).toBeGreaterThan(15);
    expect(comparadas).toBeGreaterThan(8);
  });

  it('todo campo que una ruta lee lo manda quien la llama', () => {
    expect(rotos.sort()).toEqual([]);
  });
});
