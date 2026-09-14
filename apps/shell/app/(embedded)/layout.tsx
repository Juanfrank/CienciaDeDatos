/**
 * Disposicion de una vista incrustada — seccion 4.9.
 *
 * El encabezado NO se dibuja aqui, se dibuja en la pagina. La razon es sencilla: hay dos formas de
 * incrustar —con encabezado institucional y sin el— y cual se pide viene en la query string, que
 * una disposicion de Next no puede leer. Dejandolo aqui, la version limpia habria tenido que
 * esconderlo con CSS, que es tener el encabezado igual y taparlo.
 */
export default function LayoutEmbedded({ children }: { children: React.ReactNode }) {
  return <div className="incrustado">{children}</div>;
}
