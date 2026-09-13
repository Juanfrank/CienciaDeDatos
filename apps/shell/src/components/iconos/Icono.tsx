import { TRAZOS_DE_ICONO, type NombreDeIcono } from '@app/ui-components';

/** Los iconos de la interfaz. */
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
