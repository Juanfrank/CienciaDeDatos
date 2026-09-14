'use client';

import {
  type ConnectionSettings,
  type TextBoxSettings,
  type ShapeSettings,
  type LineSettings,
  type DividerLineSettings,
  type SectionTitleSettings,
  type TextColor,
  type Shape,
  estiloDeTexto,
  grosorValido,
  lineStroke,
} from '@app/ui-components';

export { trazar, type ObjectBox } from '@app/ui-components';

/** Los elementos: lo que se coloca en un modulo sin enlazarlo a datos. */

const VARIABLE: Record<TextColor, string> = {
  predeterminado: 'var(--md-sys-color-on-surface)',
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-outline)',
};

const colorOf = (color: TextColor | undefined): string => VARIABLE[color ?? 'atenuado'];

/** El borde CSS de una linea, en un solo sitio: las cuatro que hay deben verse iguales. */
const borderOf = (line: LineSettings | undefined): string =>
  `${grosorValido(line?.thickness)}px ${lineStroke(line?.style)} ${colorOf(line?.color)}`;

/* ── Cuadro de texto ───────────────────────────────────────────────────────────────────────── */

export function TextBox({ config }: { config: TextBoxSettings | undefined }) {
  const parrafos = config?.parrafos ?? [];

  return (
    <div className="text-box" data-testid="cuadro-de-texto">
      {parrafos.map((p, i) => {
        const style = estiloDeTexto(p.style);
        if (p.vineta) {
          return (
            <ul key={i} className="text-box__list">
              <li style={style}>{p.content}</li>
            </ul>
          );
        }
        /*
         * El nivel produce un encabezado REAL, no un parrafo en grande.
         */
        if (p.nivel) {
          const Label = (['h4', 'h5', 'h6'] as const)[p.nivel - 1] ?? 'h4';
          return (
            <Label key={i} className="text-box__title" style={style}>
              {p.content}
            </Label>
          );
        }
        return (
          <p key={i} style={style}>
            {p.content}
          </p>
        );
      })}
    </div>
  );
}

/* ── Titulo de seccion ─────────────────────────────────────────────────────────────────────── */

/** Un titulo que encabeza un grupo, con lineas que se reparten lo que sobra. */
export function SectionTitle({ config }: { config: SectionTitleSettings | undefined }) {
  const line = config?.line ?? 'ninguna';
  const borde = borderOf(config?.estiloDeLinea);
  const raya = <span className="section-title__line" style={{ borderTopWidth: 0, borderTop: borde }} />;

  const horizontal = line === 'izquierda' || line === 'derecha' || line === 'ambos';

  return (
    <div
      className="section-title"
      data-testid="title-de-seccion"
      data-text-position={config?.textPosition ?? 'izquierda'}
      style={{
        ...(line === 'arriba' ? { borderTop: borde, paddingTop: 'var(--space-sm)' } : {}),
        ...(line === 'abajo' ? { borderBottom: borde, paddingBottom: 'var(--space-sm)' } : {}),
      }}
    >
      {horizontal && (line === 'izquierda' || line === 'ambos') ? raya : null}
      <h3 className="section-title__text">{config?.content ?? ''}</h3>
      {horizontal && (line === 'derecha' || line === 'ambos') ? raya : null}
    </div>
  );
}

/* ── Linea divisoria ───────────────────────────────────────────────────────────────────────── */

export function DividerLine({ config }: { config: DividerLineSettings | undefined }) {
  const vertical = config?.orientation === 'vertical';
  return (
    // `separator` con orientacion: es lo que hace que un lector de pantalla la anuncie como
    // separacion en vez de callarsela por ser un `div` vacio.
    <div
      className="linea-divisoria"
      data-testid="linea-divisoria"
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      data-orientation={vertical ? 'vertical' : 'horizontal'}
    >
      <span
        style={vertical ? { borderLeft: borderOf(config) } : { borderTop: borderOf(config) }}
      />
    </div>
  );
}

/* ── Formas ────────────────────────────────────────────────────────────────────────────────── */

/** El recorte de cada forma. */
const RECORTE: Partial<Record<Shape, string>> = {
  triangulo: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  rombo: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  flecha: 'polygon(0% 30%, 60% 30%, 60% 0%, 100% 50%, 60% 100%, 60% 70%, 0% 70%)',
};

export function FormaBasica({ config }: { config: ShapeSettings | undefined }) {
  const forma = config?.forma ?? 'rectangulo';
  // Un cuadrado y un circulo se dibujan con lado igual al MENOR de los dos ejes, no estirados a la
  // celda: estirarlos los convierte en un rectangulo y una elipse, que son otra cosa.
  const regular = forma === 'cuadrado' || forma === 'circulo';
  const recorte = RECORTE[forma];

  return (
    <div className="forma" data-testid="forma" data-shape={forma}>
      <div
        className="shape__body"
        data-regular={regular ? 'si' : undefined}
        style={{
          background: colorOf(config?.relleno ?? 'primario'),
          opacity: Math.min(100, Math.max(0, config?.opacidad ?? 100)) / 100,
          ...(config?.stroke ? { border: `${grosorValido(config.strokeThickness)}px solid ${colorOf(config.stroke)}` } : {}),
          ...(forma === 'circulo' ? { borderRadius: '50%' } : { borderRadius: `${config?.radio ?? 0}px` }),
          ...(recorte ? { clipPath: recorte } : {}),
          /*
           * El lado de un cuadrado o un circulo lo pone el CSS, no este objeto de estilos.
           */
        }}
      />
      {config?.content ? (
        <span className="shape__text" style={estiloDeTexto(config.estiloDeTexto)}>
          {config.content}
        </span>
      ) : null}
    </div>
  );
}

/* ── Conexiones ────────────────────────────────────────────────────────────────────────────── */

/** El conector dibujado. */
export function Connection({
  config,
  puntos,
}: {
  config: ConnectionSettings | undefined;
  puntos: [number, number][];
}) {
  if (puntos.length < 2) {
    return (
      <p className="connection__without-ends" data-testid="connection-without-ends">
        Elija un objeto de origen y uno de destino.
      </p>
    );
  }

  const dash = config?.dash ?? 'angulo';
  const d =
    dash === 'recto'
      ? `M ${puntos[0]?.[0]} ${puntos[0]?.[1]} L ${puntos[puntos.length - 1]?.[0]} ${puntos[puntos.length - 1]?.[1]}`
      : dash === 'curva'
        ? curva(puntos)
        : puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  const color = colorOf(config?.estiloDeLinea?.color ?? 'primario');
  const thickness = grosorValido(config?.estiloDeLinea?.thickness ?? 2);
  const id = `punta-${config?.desde ?? 'a'}-${config?.hasta ?? 'b'}`;

  return (
    <svg className="conexion" data-testid="conexion" aria-hidden="true">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeDasharray={
          config?.estiloDeLinea?.style === 'discontinua'
            ? '8 6'
            : config?.estiloDeLinea?.style === 'punteada'
              ? '2 5'
              : undefined
        }
        {...(config?.extremoFinal === 'flecha' ? { markerEnd: `url(#${id})` } : {})}
        {...(config?.initialEnd === 'flecha' ? { markerStart: `url(#${id})` } : {})}
      />
      {config?.content ? (
        <text
          className="connection__text"
          // Los parentesis importan: `a ?? 0 + b` agrupa como `a ?? (0 + b)`, asi que el rotulo
          // se colocaba en la x de SALIDA en vez de a mitad de camino.
          x={((puntos[0]?.[0] ?? 0) + (puntos[puntos.length - 1]?.[0] ?? 0)) / 2}
          y={((puntos[0]?.[1] ?? 0) + (puntos[puntos.length - 1]?.[1] ?? 0)) / 2 - 6}
          textAnchor="middle"
          fill={color}
        >
          {config.content}
        </text>
      ) : null}
    </svg>
  );
}

/** Una curva suave por los mismos puntos que usaria el trazado en angulo. */
function curva(puntos: [number, number][]): string {
  const [home, ...resto] = puntos;
  if (!home) return '';
  const end = resto[resto.length - 1];
  if (!end) return '';
  const control = resto[0] ?? home;
  return `M ${home[0]} ${home[1]} Q ${control[0]} ${control[1]} ${end[0]} ${end[1]}`;
}
