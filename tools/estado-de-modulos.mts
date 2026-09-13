/**
 * Valida cada modulo POR SEPARADO y emite el resultado — seccion 3.4.
 *
 * Es la pieza que hace cierto «un error en un modulo no debe bloquear el despliegue de los
 * demas». No basta con que CI use `nx affected`: eso construye menos, pero sigue siendo un
 * resultado unico. Aqui cada modulo se valida contra el esquema real del cache y produce su
 * propia linea, y el que falla se lleva SOLO su bandera.
 *
 * La salida es un JSON que consume el despliegue:
 *
 *   { "generadoEn": "...", "modulos": [ { "slug": "...", "estado": "ok" | "degradado" | "fallo",
 *                                        "problemas": ["..."] } ] }
 *
 * **Tres estados, no dos, porque un objeto roto NO es un modulo caido.** Es literalmente lo que
 * manda 4.2: un objeto cuyo campo desaparecio se marca y el resto del modulo sigue funcionando.
 * Apagar el modulo entero por eso seria incumplir esa regla desde el despliegue, y ademas
 * convertiria el fixture que demuestra ese comportamiento en un modulo permanentemente rojo.
 *
 *   - `ok`         nada roto.
 *   - `degradado`  algun objeto roto, el modulo abre. Se despliega y se reporta.
 *   - `fallo`      no se puede componer: la disposicion es invalida, no hay paginas, o no queda
 *                  ni un objeto sano. Este es el unico que se apaga.
 *
 * El codigo de salida es 0 aunque haya modulos rojos. No es indulgencia: es el requisito. Si
 * saliera 1, el paso de despliegue no correria y un modulo roto bloquearia a los otros nueve,
 * que es exactamente lo que 3.4 prohibe. Quien decide si eso es aceptable es la puerta de
 * publicacion, con el JSON delante.
 */
import { writeFileSync } from 'node:fs';
import { type ResumenDeSalud, type SaludDeModulo, saludDe } from '@app/module-model';
import { diagnosticarDefinicion } from '../apps/shell/src/server/datos';
import { modulos } from '../apps/shell/src/server/almacenModulos';

interface EstadoDeModulo extends ResumenDeSalud {
  slug: string;
  moduleId: string;
}

const destino = process.argv[2] ?? 'estado-de-modulos.json';

const lista = await modulos.list();
const estados: EstadoDeModulo[] = [];

for (const modulo of lista) {
  try {
    // La clasificacion vive en `module-model`, no aqui: es una afirmacion sobre el dominio —
    // cuando un modulo se puede servir— y el panel de administracion la necesita igual.
    const resumen = saludDe(await diagnosticarDefinicion(modulo));
    estados.push({ slug: modulo.slug, moduleId: modulo.moduleId, ...resumen });
  } catch (error) {
    /*
     * Que un modulo reviente al validarse tampoco tumba a los demas.
     *
     * Sin este `catch`, una excepcion en el septimo modulo dejaria sin evaluar del octavo al
     * decimo, y esos aparecerian como «no reportados» en vez de como lo que son: sanos.
     */
    estados.push({
      slug: modulo.slug,
      moduleId: modulo.moduleId,
      salud: 'fallo',
      problemas: [error instanceof Error ? error.message : String(error)],
      objetos: { total: 0, rotos: 0 },
    });
  }
}

const informe = { generadoEn: new Date().toISOString(), modulos: estados };
writeFileSync(destino, `${JSON.stringify(informe, null, 2)}\n`);

const MARCA: Record<SaludDeModulo, string> = { ok: '✓', degradado: '~', fallo: '✗' };
for (const e of estados) {
  console.log(`${MARCA[e.salud]} ${e.slug}${e.problemas.length ? ` — ${e.problemas.join(' · ')}` : ''}`);
}

const caidos = estados.filter((e) => e.salud === 'fallo');
const degradados = estados.filter((e) => e.salud === 'degradado');
console.log(
  `\n${estados.length - caidos.length - degradados.length} sanos · ${degradados.length} degradados · ` +
    `${caidos.length} caidos · informe en ${destino}`,
);
if (degradados.length > 0) {
  console.log(`Se despliegan con sus objetos marcados (4.2): ${degradados.map((d) => d.slug).join(', ')}`);
}
if (caidos.length > 0) {
  console.log(`Quedan APAGADOS en App Configuration: ${caidos.map((c) => c.slug).join(', ')}`);
}
