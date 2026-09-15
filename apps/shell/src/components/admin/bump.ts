'use client';

import { isMajorJump } from '@app/ui-components';
import type { Translator } from '@app/i18n';
import { emergente } from '../emergentes';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Subir un objeto a su ultima version dentro de un modulo — seccion 4.5.
 *
 * La peticion y el informe viven aqui, fuera de los dos botones que la disparan: el de una fila y
 * el de «subir todos». Con la logica dentro del boton de fila, el de arriba habria tenido que
 * repetirla, y son justo las lineas que deciden QUE se dice cuando algo se pierde por el camino.
 *
 * El informe sale por un mensaje emergente y no dentro de la celda. Escrito en la celda, el texto
 * ensanchaba la columna, descuadraba la tabla entera y se quedaba ahi como si fuera un dato mas
 * de la fila; y cuando son varios objetos, son varios parrafos dentro de varias celdas.
 */
export interface ResultadoDeSubida {
  instancias: number;
  preserved: string[];
  retiradas: { instanceId: string; clave: string; valor: unknown }[];
  nuevas: string[];
}

/** Que objeto de que modulo, y hasta donde. */
export interface Subida {
  slug: string;
  objectId: string;
  /** El nombre legible del objeto. Es la REFERENCIA del mensaje: sin ella, tres mensajes
   *  iguales no dicen cual fue cual. */
  nombre: string;
  desde: string;
  hasta: string;
}

/**
 * Sube uno y AVISA. Devuelve si salio bien, para que quien sube varios sepa cuando parar.
 *
 * Ya no hay confirmacion previa. La habia, y ensenaba «v1.0.0 → v1.4.0, lo que ya estaba
 * configurado se conserva»: un paso mas para decir de antemano lo que el informe dice despues y
 * con datos reales. Lo unico que aquella pantalla anadia era el aviso de salto de MAYOR, que no
 * se pierde — viaja en el mensaje, que sale marcado como aviso en vez de como exito.
 */
export async function subirObjeto(subida: Subida, t: Translator): Promise<boolean> {
  const respuesta = await pedir(`/api/modules/${subida.slug}/bump`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objectId: subida.objectId, hasta: subida.hasta }),
  });

  if (!respuesta?.ok) {
    emergente(
      `${subida.nombre}: ${await motivoDeFallo(respuesta, t('admin.bump.failed'))}`,
      'fallo',
    );
    return false;
  }

  const hecho = (await respuesta.json()) as ResultadoDeSubida;

  /*
   * Lo que se PERDIO va en su propio mensaje, y marcado como fallo.
   *
   * Si la version nueva ya no admite una clave que alguien habia configurado, eso no se puede
   * mezclar en la misma linea que «subieron tres instancias»: es lo unico de todo el informe que
   * obliga a hacer algo despues.
   */
  if (hecho.retiradas.length > 0) {
    emergente(
      `${subida.nombre}: ${t('admin.bump.dropped', {
        claves: t.lista(hecho.retiradas.map((r) => r.clave)),
      })}`,
      'fallo',
    );
  }

  /*
   * Un salto de MAYOR avisa aparte, que es para lo que `isMajorJump` se escribio.
   *
   * Subir de 1.0.0 a 1.0.1 y de 1.0.0 a 2.0.0 no son la misma noticia. El aviso estaba antes en
   * la pantalla de confirmacion; al quitarla se habria perdido, y el numero mayor existe
   * justamente para decir que una de las dos cosas no es como la otra.
   */
  if (isMajorJump(subida.desde, subida.hasta)) {
    emergente(`${subida.nombre}: ${t('admin.bump.major')}`, 'fallo');
  }

  // Lo que se conserva y lo que llega nuevo van en la MISMA linea que «subieron tres
  // instancias»: son el detalle de esa frase, no tres noticias distintas.
  const detalle = [
    hecho.preserved.length > 0 ? t('admin.bump.kept', { claves: t.lista(hecho.preserved) }) : '',
    hecho.nuevas.length > 0 ? t('admin.bump.new', { claves: t.lista(hecho.nuevas) }) : '',
  ].filter(Boolean);

  emergente(
    [
      `${subida.nombre}: ${t('admin.bump.done', { n: hecho.instancias, hasta: subida.hasta })}`,
      ...detalle,
    ].join(' '),
  );

  return true;
}
