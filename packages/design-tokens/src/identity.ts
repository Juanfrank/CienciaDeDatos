/**
 * Identidad institucional — seccion 4.3.
 *
 * El nombre y el logo van aqui, junto a la paleta y la tipografia, y no escritos dentro de la
 * cabecera: la seccion 4.3 trata la identidad visual como configuracion de la institucion, no
 * como una constante del producto. El dia que esta capa sirva a otra institucion se cambia este
 * objeto y nada mas.
 *
 * El archivo del logo se sirve desde el PROPIO ORIGEN (`apps/shell/public`). Traerlo de un CDN
 * institucional haria que el navegador hablase con un tercero, y eso incumple el principio 1.
 */

export interface InstitutionIdentity {
  /** Nombre completo, tal como debe aparecer en el cromo de la aplicacion. */
  name: string;
  /** Forma corta, para sitios donde el nombre completo no cabe. */
  shortName: string;
  /**
   * Emblema, SIN la marca denominativa.
   *
   * El logotipo oficial es un lockup —emblema arriba, "Republica Dominicana / Poder Judicial"
   * debajo— y a la altura de una cabecera ese texto se vuelve ilegible. En el cromo va el
   * emblema solo y el nombre se escribe al lado como texto de verdad, que ademas es lo que lo
   * hace seleccionable, traducible y legible por un lector de pantalla.
   */
  emblem: { src: string; width: number; height: number };
}

export const defaultIdentity: InstitutionIdentity = {
  name: 'Poder Judicial de la República Dominicana',
  shortName: 'Poder Judicial',
  emblem: {
    src: '/marca/poder-judicial-emblema.png',
    // Medidas del archivo (2x de la altura de dibujo), para que el navegador reserve el hueco
    // y la cabecera no salte al cargar la imagen.
    width: 61,
    height: 80,
  },
};
