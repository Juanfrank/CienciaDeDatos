import { TRAZOS_DE_ICONO, type NombreDeIcono } from '@app/ui-components';

/**
 * Los iconos de la interfaz.
 *
 * Los TRAZOS no estan aqui: viven en `@app/ui-components`, como dato. Este componente solo los
 * dibuja. La primera version tenia su propia lista y duro exactamente hasta que se anadieron dos
 * iconos al catalogo de la libreria: la validacion los aceptaba —existian para ella— y la
 * pantalla pintaba un cuadro vacio, porque para el componente no existian. Con una sola lista eso
 * no puede volver a pasar.
 *
 * Son SVG en linea, no una fuente de iconos ni imagenes: heredan `currentColor`, asi que un icono
 * dentro de la cabecera en `primary` sale en `on-primary` sin declarar nada, y siguen al tema
 * oscuro solos. Una fuente ademas obliga a una peticion mas y, si no llega, dibuja un cuadrado
 * vacio donde deberia haber un control.
 *
 * Todos llevan `aria-hidden`: el nombre accesible lo pone SIEMPRE quien los contiene. Un icono no
 * es texto alternativo de si mismo — «marcador» no dice lo que el boton hace.
 */
export function Icono({ nombre, tamano = 20 }: { nombre: NombreDeIcono; tamano?: number }) {
  return (
    <svg
      className="icono"
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={TRAZOS_DE_ICONO[nombre]} />
    </svg>
  );
}

export type { NombreDeIcono };
