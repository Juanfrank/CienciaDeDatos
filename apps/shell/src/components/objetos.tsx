import type { QueryResult } from '@app/data-contracts';
import {
  type BindingProblem,
  fieldKey,
  toCategorical,
  toKpi,
  toMatrix,
  toSlicerOptions,
} from '@app/ui-components';
import type { ObjectInstance } from '@app/ui-components';
import { Segmentador } from './Segmentador';

/**
 * Objetos prediseñados — seccion 4.2.
 *
 * Envoltorios DELGADOS sobre los view-model puros, que son los que estan probados. Cada objeto
 * recibe filas ya leidas del cache y ya filtradas por el ambito de quien mira: ninguno conoce
 * la fuente, la consulta ni el conector activo.
 */

const formatearNumero = (n: number): string => new Intl.NumberFormat('es-DO').format(Math.round(n));

/** Un objeto cuyo mapeo ya no se puede resolver se dibuja MARCADO, nunca omitido (4.2). */
export function ObjetoRoto({
  titulo,
  problems,
  unresolvedObject,
}: {
  titulo: string;
  problems: BindingProblem[];
  unresolvedObject?: string;
}) {
  return (
    <div className="objeto objeto--roto" data-testid="objeto-roto">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
        <span className="insignia insignia--error">Roto</span>
      </div>
      <div className="objeto__cuerpo">
        <p className="texto-atenuado">
          Este objeto no se puede dibujar. El resto del modulo sigue funcionando.
        </p>
        <ul className="lista-problemas">
          {unresolvedObject ? <li>{unresolvedObject}</li> : null}
          {problems.map((p) => (
            <li key={`${p.slot}-${p.kind}`}>
              <code>{p.slot}</code> — {p.problem}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Estado explicito de 6.3: el dato aun no esta. Nunca un error, nunca una consulta a la fuente. */
export function ObjetoGenerandose({ titulo }: { titulo: string }) {
  return (
    <div className="objeto objeto--generandose" data-testid="objeto-generandose">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
        <span className="insignia">Generandose</span>
      </div>
      <div className="objeto__cuerpo">
        <p className="texto-atenuado">
          El dato aun no esta disponible. El proceso de poblacion lo esta generando.
        </p>
      </div>
    </div>
  );
}

function Marco({
  titulo,
  children,
  pie,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  return (
    <div className="objeto">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
      </div>
      <div className="objeto__cuerpo">{children}</div>
      {pie ? <div className="objeto__pie">{pie}</div> : null}
    </div>
  );
}

export function TarjetaKpi({ titulo, result, instance }: ObjetoProps) {
  const kpi = toKpi(result, instance.binding.measures, titulo);
  const delta = kpi.delta;

  return (
    <Marco titulo={titulo}>
      <p className="kpi__valor" data-testid="kpi-valor">
        {formatearNumero(kpi.value)}
      </p>
      {delta ? (
        <p className={`kpi__delta ${delta.absolute >= 0 ? 'es-positivo' : 'es-negativo'}`}>
          {delta.absolute >= 0 ? '+' : ''}
          {formatearNumero(delta.absolute)}
          {delta.relative === null ? '' : ` (${(delta.relative * 100).toFixed(1)}%)`}
        </p>
      ) : null}
    </Marco>
  );
}

export function Barras({ titulo, result, instance, onFiltrar }: ObjetoProps) {
  const vm = toCategorical(result, instance.binding.dimensions, instance.binding.measures);
  const maximo = Math.max(1, ...vm.points.flatMap((p) => p.values));
  const dimension = instance.binding.dimensions[0];

  return (
    <Marco
      titulo={titulo}
      pie={vm.aggregated ? <span className="texto-atenuado">Agregado sobre el dataset cacheado</span> : null}
    >
      <ul className="barras" data-testid="barras">
        {vm.points.map((punto) => {
          const valor = punto.values[0] ?? 0;
          return (
            <li key={punto.label} className="barras__fila">
              <button
                type="button"
                className="barras__etiqueta"
                data-testid={`barra-${punto.label}`}
                onClick={
                  dimension && onFiltrar
                    ? () => onFiltrar(fieldKey(dimension), punto.label)
                    : undefined
                }
                title={dimension ? `Filtrar por ${punto.label}` : undefined}
              >
                {punto.label}
              </button>
              <span className="barras__pista">
                <span className="barras__relleno" style={{ width: `${(valor / maximo) * 100}%` }} />
              </span>
              <span className="barras__valor">{formatearNumero(valor)}</span>
            </li>
          );
        })}
      </ul>
    </Marco>
  );
}

export function Lineas({ titulo, result, instance }: ObjetoProps) {
  const vm = toCategorical(result, instance.binding.dimensions, instance.binding.measures);
  const todos = vm.points.flatMap((p) => p.values);
  const maximo = Math.max(1, ...todos);
  const ancho = 100;
  const alto = 40;

  return (
    <Marco titulo={titulo}>
      <svg viewBox={`0 0 ${ancho} ${alto}`} className="lineas" role="img" aria-label={titulo}>
        {vm.series.map((serie, s) => {
          const puntos = vm.points
            .map((p, i) => {
              const x = (i / Math.max(1, vm.points.length - 1)) * ancho;
              const y = alto - ((p.values[s] ?? 0) / maximo) * alto;
              return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(' ');
          return (
            <polyline
              key={serie}
              points={puntos}
              fill="none"
              strokeWidth={1.5}
              stroke={`var(--color-categorical-${s % 8})`}
            />
          );
        })}
      </svg>
      <ul className="leyenda">
        {vm.series.map((serie, s) => (
          <li key={serie}>
            <span className="leyenda__marca" style={{ background: `var(--color-categorical-${s % 8})` }} />
            {serie}
          </li>
        ))}
      </ul>
    </Marco>
  );
}

export function Tabla({ titulo, result }: ObjetoProps) {
  return (
    <Marco titulo={titulo}>
      <div className="tabla-contenedor">
        <table className="tabla" data-testid="tabla">
          <thead>
            <tr>
              {result.columns.map((c) => (
                <th key={c.name}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td key={j} className={typeof celda === 'number' ? 'es-numero' : ''}>
                    {typeof celda === 'number' ? formatearNumero(celda) : String(celda)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Marco>
  );
}

export function Matriz({ titulo, result, instance }: ObjetoProps) {
  const medida = instance.binding.measures[0] ?? '';
  const vm = toMatrix(result, instance.binding.dimensions, medida);

  return (
    <Marco titulo={titulo}>
      <div className="tabla-contenedor">
        <table className="tabla" data-testid="matriz">
          <thead>
            <tr>
              <th />
              {vm.columnLabels.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {vm.rowLabels.map((fila, i) => (
              <tr key={fila}>
                <th scope="row">{fila}</th>
                {vm.cells[i]?.map((celda, j) => (
                  <td key={j} className="es-numero">
                    {celda === null ? '—' : formatearNumero(celda)}
                  </td>
                ))}
                <td className="es-numero es-total">{formatearNumero(vm.rowTotals[i] ?? 0)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row">Total</th>
              {vm.columnTotals.map((t, j) => (
                <td key={j} className="es-numero es-total">
                  {formatearNumero(t)}
                </td>
              ))}
              <td className="es-numero es-total">{formatearNumero(vm.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Marco>
  );
}

export interface ObjetoProps {
  titulo: string;
  result: QueryResult;
  instance: ObjectInstance;
  /** Filtrado cruzado (4.4): anade un filtro a la query string, no a un estado paralelo. */
  onFiltrar?: (campo: string, valor: string) => void;
}

/** Objeto declarado en el catalogo pero sin render disponible todavia (el mapa). */
export function ObjetoNoDisponible({ titulo, objectId }: { titulo: string; objectId: string }) {
  return (
    <div className="objeto objeto--no-disponible">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
        <span className="insignia">No disponible</span>
      </div>
      <div className="objeto__cuerpo">
        <p className="texto-atenuado">
          El objeto <code>{objectId}</code> esta declarado en el catalogo pero su render aun no
          esta implementado.
        </p>
      </div>
    </div>
  );
}

export { Segmentador, toSlicerOptions };
