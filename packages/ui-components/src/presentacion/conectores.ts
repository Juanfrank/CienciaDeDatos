/**
 * La geometria de un conector.
 *
 * Vive en el paquete y no junto al componente porque no dibuja nada: convierte dos cajas en una
 * lista de puntos. Separarlo es lo que permite probarlo —una funcion pura con cajas de mentira, sin
 * navegador— y es la parte que de verdad se puede equivocar: un signo invertido manda la flecha a
 * atravesar el objeto en vez de salir de el, y eso en una captura de pantalla se ve como «raro»
 * pero no se sabe por que.
 */

export interface CajaDeObjeto {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * El trazado de un conector entre dos cajas, en coordenadas de rejilla.
 *
 * Se calcula A PARTIR de las cajas en cada render, y por eso el conector sigue pegado cuando
 * cualquiera de los dos extremos se mueve o cambia de tamano. Guardar los puntos habria sido mas
 * barato y es el fallo clasico de los diagramas de las herramientas de oficina: la flecha se queda
 * donde estaba y apunta al aire.
 *
 * Sale de cada caja por el borde MAS CERCANO al otro, que es lo que hace que la flecha parezca
 * salir del objeto y no atravesarlo.
 */
export function trazar(desde: CajaDeObjeto, hasta: CajaDeObjeto): { puntos: [number, number][] } {
  const ca = { x: desde.x + desde.w / 2, y: desde.y + desde.h / 2 };
  const cb = { x: hasta.x + hasta.w / 2, y: hasta.y + hasta.h / 2 };
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  // Se elige el eje DOMINANTE: si los dos objetos estan casi a la misma altura, el conector sale
  // por los lados; si estan uno encima del otro, por arriba y abajo.
  const porX = Math.abs(dx) >= Math.abs(dy);

  const salida: [number, number] = porX
    ? [dx >= 0 ? desde.x + desde.w : desde.x, ca.y]
    : [ca.x, dy >= 0 ? desde.y + desde.h : desde.y];
  const entrada: [number, number] = porX
    ? [dx >= 0 ? hasta.x : hasta.x + hasta.w, cb.y]
    : [cb.x, dy >= 0 ? hasta.y : hasta.y + hasta.h];

  const medio: [number, number][] = porX
    ? [
        [(salida[0] + entrada[0]) / 2, salida[1]],
        [(salida[0] + entrada[0]) / 2, entrada[1]],
      ]
    : [
        [salida[0], (salida[1] + entrada[1]) / 2],
        [entrada[0], (salida[1] + entrada[1]) / 2],
      ];

  return { puntos: [salida, ...medio, entrada] };
}

