/**
 * Los iconos de la interfaz.
 *
 * Son SVG en linea, no una fuente de iconos ni imagenes: heredan `currentColor`, asi que un
 * icono dentro de la cabecera en `primary` sale en `on-primary` sin declarar nada, y siguen al
 * tema oscuro solos. Una fuente de iconos ademas obliga a una peticion mas y, si no llega,
 * dibuja un cuadrado vacio donde deberia haber un control.
 *
 * Todos llevan `aria-hidden`: el nombre accesible lo pone SIEMPRE el boton que los contiene. Un
 * icono no es texto alternativo de si mismo — "marcador" no dice lo que el boton hace.
 */

const TRAZOS: Record<string, string> = {
  // Tres lineas. Pliega y despliega el panel lateral.
  sandwich: 'M4 7h16M4 12h16M4 17h16',
  // Marcapaginas.
  marcador: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z',
  // Flecha hacia una bandeja: descargar.
  exportar: 'M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18v1.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V18',
  // Campana.
  aviso: 'M18 16.5V11a6 6 0 1 0-12 0v5.5L4.5 18h15zM10 21a2 2 0 0 0 4 0',
  // Dos corchetes angulares: el codigo que se pega en otro portal.
  incrustar: 'm9 18-6-6 6-6M15 6l6 6-6 6',
  // Silueta de una persona: la vista propia frente a la institucional.
  vista: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  // Un candado cerrado: el ambito que impone el RLS.
  ambito: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
  // Aspa de cerrar.
  cerrar: 'M6 6l12 12M18 6 6 18',
};

export type NombreDeIcono = keyof typeof TRAZOS;

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
      <path d={TRAZOS[nombre]} />
    </svg>
  );
}
