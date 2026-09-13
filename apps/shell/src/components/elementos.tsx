'use client';

import {
  type ConfiguracionDeConexion,
  type ConfiguracionDeCuadroDeTexto,
  type ConfiguracionDeForma,
  type ConfiguracionDeLinea,
  type ConfiguracionDeLineaDivisoria,
  type ConfiguracionDeTituloDeSeccion,
  type ColorDeTexto,
  type Forma,
  estiloDeTexto,
  grosorValido,
  trazoDeLinea,
} from '@app/ui-components';

export { trazar, type CajaDeObjeto } from '@app/ui-components';

/** Los elementos: lo que se coloca en un modulo sin enlazarlo a datos. */

const VARIABLE: Record<ColorDeTexto, string> = {
  predeterminado: 'var(--md-sys-color-on-surface)',
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-outline)',
};

const colorDe = (color: ColorDeTexto | undefined): string => VARIABLE[color ?? 'atenuado'];

/** El borde CSS de una linea, en un solo sitio: las cuatro que hay deben verse iguales. */
const bordeDe = (line: ConfiguracionDeLinea | undefined): string =>
  `${grosorValido(line?.grosor)}px ${trazoDeLinea(line?.estilo)} ${colorDe(line?.color)}`;

/* ── Cuadro de texto ───────────────────────────────────────────────────────────────────────── */

export function CuadroDeTexto({ config }: { config: ConfiguracionDeCuadroDeTexto | undefined }) {
  const parrafos = config?.parrafos ?? [];

  return (
    <div className="cuadro-texto" data-testid="cuadro-de-texto">
      {parrafos.map((p, i) => {
        const estilo = estiloDeTexto(p.estilo);
        if (p.vineta) {
          return (
            <ul key={i} className="cuadro-texto__lista">
              <li style={estilo}>{p.content}</li>
            </ul>
          );
        }
        /*
         * El nivel produce un encabezado REAL, no un parrafo en grande.
         */
        if (p.nivel) {
          const Etiqueta = (['h4', 'h5', 'h6'] as const)[p.nivel - 1] ?? 'h4';
          return (
            <Etiqueta key={i} className="cuadro-texto__titulo" style={estilo}>
              {p.content}
            </Etiqueta>
          );
        }
        return (
          <p key={i} style={estilo}>
            {p.content}
          </p>
        );
      })}
    </div>
  );
}

/* ── Titulo de seccion ─────────────────────────────────────────────────────────────────────── */

/** Un titulo que encabeza un grupo, con lineas que se reparten lo que sobra. */
export function TituloDeSeccion({ config }: { config: ConfiguracionDeTituloDeSeccion | undefined }) {
  const line = config?.line ?? 'ninguna';
  const borde = bordeDe(config?.estiloDeLinea);
  const raya = <span className="titulo-seccion__linea" style={{ borderTopWidth: 0, borderTop: borde }} />;

  const horizontal = line === 'izquierda' || line === 'derecha' || line === 'ambos';

  return (
    <div
      className="titulo-seccion"
      data-testid="titulo-de-seccion"
      data-cellPosition={config?.posicionDelTexto ?? 'izquierda'}
      style={{
        ...(line === 'arriba' ? { borderTop: borde, paddingTop: 'var(--space-sm)' } : {}),
        ...(line === 'abajo' ? { borderBottom: borde, paddingBottom: 'var(--space-sm)' } : {}),
      }}
    >
      {horizontal && (line === 'izquierda' || line === 'ambos') ? raya : null}
      <h3 className="titulo-seccion__texto">{config?.content ?? ''}</h3>
      {horizontal && (line === 'derecha' || line === 'ambos') ? raya : null}
    </div>
  );
}

/* ── Linea divisoria ───────────────────────────────────────────────────────────────────────── */

export function LineaDivisoria({ config }: { config: ConfiguracionDeLineaDivisoria | undefined }) {
  const vertical = config?.orientacion === 'vertical';
  return (
    // `separator` con orientacion: es lo que hace que un lector de pantalla la anuncie como
    // separacion en vez de callarsela por ser un `div` vacio.
    <div
      className="linea-divisoria"
      data-testid="linea-divisoria"
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      data-orientacion={vertical ? 'vertical' : 'horizontal'}
    >
      <span
        style={vertical ? { borderLeft: bordeDe(config) } : { borderTop: bordeDe(config) }}
      />
    </div>
  );
}

/* ── Formas ────────────────────────────────────────────────────────────────────────────────── */

/** El recorte de cada forma. */
const RECORTE: Partial<Record<Forma, string>> = {
  triangulo: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  rombo: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  flecha: 'polygon(0% 30%, 60% 30%, 60% 0%, 100% 50%, 60% 100%, 60% 70%, 0% 70%)',
};

export function FormaBasica({ config }: { config: ConfiguracionDeForma | undefined }) {
  const forma = config?.forma ?? 'rectangulo';
  // Un cuadrado y un circulo se dibujan con lado igual al MENOR de los dos ejes, no estirados a la
  // celda: estirarlos los convierte en un rectangulo y una elipse, que son otra cosa.
  const regular = forma === 'cuadrado' || forma === 'circulo';
  const recorte = RECORTE[forma];

  return (
    <div className="forma" data-testid="forma" data-forma={forma}>
      <div
        className="forma__cuerpo"
        data-regular={regular ? 'si' : undefined}
        style={{
          background: colorDe(config?.relleno ?? 'primario'),
          opacity: Math.min(100, Math.max(0, config?.opacidad ?? 100)) / 100,
          ...(config?.trazo ? { border: `${grosorValido(config.grosorDeTrazo)}px solid ${colorDe(config.trazo)}` } : {}),
          ...(forma === 'circulo' ? { borderRadius: '50%' } : { borderRadius: `${config?.radio ?? 0}px` }),
          ...(recorte ? { clipPath: recorte } : {}),
          /*
           * El lado de un cuadrado o un circulo lo pone el CSS, no este objeto de estilos.
           */
        }}
      />
      {config?.content ? (
        <span className="forma__texto" style={estiloDeTexto(config.estiloDeTexto)}>
          {config.content}
        </span>
      ) : null}
    </div>
  );
}

/* ── Conexiones ────────────────────────────────────────────────────────────────────────────── */

/** El conector dibujado. */
export function Conexion({
  config,
  puntos,
}: {
  config: ConfiguracionDeConexion | undefined;
  puntos: [number, number][];
}) {
  if (puntos.length < 2) {
    return (
      <p className="conexion__sin-extremos" data-testid="conexion-sin-extremos">
        Elija un objeto de source y uno de destino.
      </p>
    );
  }

  const trazado = config?.trazado ?? 'angulo';
  const d =
    trazado === 'recto'
      ? `M ${puntos[0]?.[0]} ${puntos[0]?.[1]} L ${puntos[puntos.length - 1]?.[0]} ${puntos[puntos.length - 1]?.[1]}`
      : trazado === 'curva'
        ? curva(puntos)
        : puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');

  const color = colorDe(config?.estiloDeLinea?.color ?? 'primario');
  const grosor = grosorValido(config?.estiloDeLinea?.grosor ?? 2);
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
        strokeWidth={grosor}
        strokeDasharray={
          config?.estiloDeLinea?.estilo === 'discontinua'
            ? '8 6'
            : config?.estiloDeLinea?.estilo === 'punteada'
              ? '2 5'
              : undefined
        }
        {...(config?.extremoFinal === 'flecha' ? { markerEnd: `url(#${id})` } : {})}
        {...(config?.extremoInicial === 'flecha' ? { markerStart: `url(#${id})` } : {})}
      />
      {config?.content ? (
        <text
          className="conexion__texto"
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
  const [inicio, ...resto] = puntos;
  if (!inicio) return '';
  const fin = resto[resto.length - 1];
  if (!fin) return '';
  const control = resto[0] ?? inicio;
  return `M ${inicio[0]} ${inicio[1]} Q ${control[0]} ${control[1]} ${fin[0]} ${fin[1]}`;
}
