import type { QueryResult } from '@app/data-contracts';
import {
  type BindingProblem,
  fieldKey,
  proyectarObjeto,
  toCategorical,
  toKpi,
  toMatrix,
  toSlicerOptions,
} from '@app/ui-components';
import type { ObjectInstance } from '@app/ui-components';
import { Complementos } from './Complementos';
import { Grafico } from './Grafico';
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

/**
 * Marco comun de un objeto.
 *
 * Dibuja los complementos adjuntados el: asi ningun objeto tiene que acordarse de hacerlo, y uno
 * nuevo los hereda por existir. Si cada objeto los pintara por su cuenta, el primero que se
 * anadiera sin ellos los perderia en silencio.
 */
function Marco({
  titulo,
  children,
  pie,
  instance,
  result,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  instance?: ObjectInstance;
  result?: QueryResult;
}) {
  return (
    <div className="objeto">
      <div className="objeto__cabecera">
        <h3>{titulo}</h3>
        {instance && result ? (
          <Complementos instance={instance} result={result} titulo={titulo} />
        ) : null}
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
    <Marco titulo={titulo} instance={instance} result={result}>
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
      instance={instance}
      result={result}
      pie={vm.aggregated ? <span className="texto-atenuado">Agregado sobre el dataset cacheado</span> : null}
    >
      <Grafico
        instanceId={instance.instanceId}
        tipo="barras"
        vm={vm}
        titulo={titulo}
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (categoria: string) => onFiltrar(fieldKey(dimension), categoria) }
          : {})}
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
      </Grafico>
    </Marco>
  );
}

export function Lineas({ titulo, result, instance }: ObjetoProps) {
  const vm = toCategorical(result, instance.binding.dimensions, instance.binding.measures);
  const dimension = instance.binding.dimensions[0];

  return (
    <Marco titulo={titulo} instance={instance} result={result}>
      <Grafico
        instanceId={instance.instanceId}
        tipo="lineas"
        vm={vm}
        titulo={titulo}
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
      >
        {/*
          El respaldo de una linea es una TABLA, no un dibujo.
          
          Una serie temporal tiene un valor por punto y por serie; en cuanto no se puede ver la
          forma de la curva, lo util son las cifras. Dibujar unas barras aqui seria inventar una
          lectura que el objeto no propone.
        */}
        <div className="tabla-contenedor">
          <table className="tabla" data-testid="lineas">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                {vm.series.map((serie) => (
                  <th key={serie} scope="col" className="es-numero">
                    {serie}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto) => (
                <tr key={punto.label}>
                  <th scope="row">{punto.label}</th>
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="es-numero">
                      {formatearNumero(punto.values[s] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Grafico>
    </Marco>
  );
}

export function Tabla({ titulo, result, instance }: ObjetoProps) {
  // La tabla dibuja SU proyeccion, no el dataset en crudo.
  //
  // Antes pintaba todas las columnas del dataset, incluidas las que su mapeo no declara, y las
  // filas sin agregar: un mapeo de dos dimensiones sobre un dataset con tres mostraba la tercera
  // y repetia cada combinacion. Es la misma funcion que usan la exportacion y el complemento de
  // tabla de datos, asi que lo que se ve y lo que se exporta no pueden separarse.
  const proyectado = proyectarObjeto(instance, result);

  return (
    <Marco titulo={titulo} instance={instance} result={result}>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
        <table className="tabla" data-testid="tabla">
          <thead>
            <tr>
              {proyectado.columns.map((c) => (
                <th key={c.name} scope="col">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proyectado.rows.map((fila, i) => (
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
    <Marco titulo={titulo} instance={instance} result={result}>
      <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
        <table className="tabla" data-testid="matriz">
          <thead>
            <tr>
              <th />
              {vm.columnLabels.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
              <th scope="col">Total</th>
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
