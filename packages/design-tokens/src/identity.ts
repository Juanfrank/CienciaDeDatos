/** Identidad institucional — seccion 4.3. */

export interface InstitutionIdentity {
  /** Nombre completo, tal como debe aparecer en el cromo de la aplicacion. */
  name: string;
  /** Forma corta, para sitios donde el nombre completo no cabe. */
  shortName: string;
  /** Emblema, SIN la marca denominativa. */
  emblem: { src: string; width: number; height: number };
}

export const defaultIdentity: InstitutionIdentity = {
  name: 'Poder Judicial de la República Dominicana',
  shortName: 'Poder Judicial',
  emblem: {
    src: '/brand/poder-judicial-emblema.png',
    // Medidas del archivo (2x de la altura de dibujo), para que el navegador reserve el hueco
    // y la cabecera no salte al cargar la imagen.
    width: 61,
    height: 80,
  },
};
