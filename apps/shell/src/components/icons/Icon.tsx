import { ICON_STROKES, type IconName } from '@app/ui-components';

/** Los iconos de la interfaz. */
export function Icon({ nombre, tamano = 20 }: { nombre: IconName; tamano?: number }) {
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
      <path d={ICON_STROKES[nombre]} />
    </svg>
  );
}

export type { IconName };
