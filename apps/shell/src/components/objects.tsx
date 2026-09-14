'use client';

import type { Aggregation, QueryResult } from '@app/data-contracts';
import {
  type BindingProblem,
  type IconName,
  type MultiplePanel,
  type ObjectPresentation,
  type FieldSlot,
  type ChartKind,
  aFieldRef,
  aggregationsFor,
  gaugeScale,
  slotField,
  conditionalColor,
  columnsFor,
  paginationLegend,
  niceScale,
  maxCommon,
  splitMultiples,
  estiloDeTexto,
  fieldKey,
  sortCategories,
  slotsOf,
  measureFormatter,
  projectObject,
  buildMatrix,
  toCategorical,
  toKpi,
  toSlicerOptions,
} from '@app/ui-components';
import type { ObjectInstance } from '@app/ui-components';
import { useOverflows } from '../hooks/useOverflows';
import { Addons, Pagination, VisualFilter } from './Addons';
import { useObjectChrome } from './ObjectView';
import { MatrixTable } from './MatrixTable';
import { SortableTable } from './SortableTable';
import { Chart } from './Chart';
import { Slicer } from './Slicer';
import { Icon } from './icons/Icon';

/** Objetos prediseñados — seccion 4.2. */

/** El formato por defecto, para lo que no es una cifra de la instancia. */
/** Numero para pantalla. `null` es «no hay respuesta» y se dibuja como raya, no como cero. */
const formatNumber = (n: number | null): string =>
  n === null ? '—' : new Intl.NumberFormat('es-DO').format(Math.round(n));

/** Los campos de un objeto, LEIDOS POR RANURA. */
function porRanura(instance: ObjectInstance, slots: FieldSlot[] | undefined) {
  if (!slots || slots.length === 0) return null;
  return {
    one: (id: string) => slotField(instance, slots, id),
    varios: (id: string) => slotsOf(instance, slots).get(id) ?? [],
  };
}

/** La variable del tema de cada rol, para la linea de resaltado. */
const HIGHLIGHT_VARIABLE: Record<string, string> = {
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

/** Icono por defecto de cada tipo, cuando la instancia no elige otro. */
/** Un objeto cuyo mapeo ya no se puede resolver se dibuja MARCADO, nunca omitido (4.2). */
export function BrokenObject({
  titulo,
  problems,
  unresolvedObject,
}: {
  titulo: string;
  problems: BindingProblem[];
  unresolvedObject?: string;
}) {
  return (
    <div className="objeto object--broken" data-testid="object-broken">
      <div className="object__header">
        <h3>{titulo}</h3>
        <span className="insignia badge--error">Roto</span>
      </div>
      <div className="object__body">
        <p className="muted-text">
          Este objeto no se puede dibujar. El resto del modulo sigue funcionando.
        </p>
        <ul className="problems-list">
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
export function GeneratingObject({ titulo }: { titulo: string }) {
  return (
    <div className="objeto object--generating" data-testid="object-generating">
      <div className="object__header">
        <h3>{titulo}</h3>
        <span className="insignia">Generandose</span>
      </div>
      <div className="object__body">
        <p className="muted-text">
          El dato aun no esta disponible. El proceso de poblacion lo esta generando.
        </p>
      </div>
    </div>
  );
}

/** Marco comun de un objeto. */
/*
 * Se EXPORTA.
 */
export function Frame({
  titulo,
  children,
  pie,
  accion,
  instance,
  result,
  aggregations,
  objectIcon,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** Un control propio del objeto, junto a los complementos. Por ejemplo «Limpiar». */
  accion?: React.ReactNode;
  instance?: ObjectInstance;
  result?: QueryResult;
  /** Para los complementos: la tabla de datos proyecta con los mismos operadores que el objeto. */
  aggregations?: Aggregation[];
  /** El que declara la version del objeto. La presentacion de la instancia lo anula. */
  objectIcon?: IconName;
}) {
  /*
   * La presentacion se dibuja AQUI, en el marco comun, y no en cada objeto.
   */
  const presentacion = instance?.presentacion;
  // El icono por defecto lo declara el objeto y viaja con el; la presentacion solo lo anula.
  const icono = presentacion?.icono ?? objectIcon;
  const acento = presentacion?.acento ?? 'primario';
  /*
   * La cabecera entera se puede ocultar.
   */
  const withHeader = presentacion?.mostrarTitulo !== false;
  const body = useOverflows<HTMLDivElement>();

  /*
   * Los tres complementos de vista llegan por CONTEXTO, no por propiedad.
   *
   * Este marco lo dibujan los dieciseis renderizadores. Pasarlos de mano en mano seria tocarlos
   * todos y confiar en que ninguno se olvide: el que se olvidara dejaria un objeto con el
   * complemento configurado y sin dibujar, que es la peor de las dos formas de fallar — la que no
   * se nota. Por contexto, un objeto nuevo los hereda por usar el marco.
   */
  const chrome = useObjectChrome();

  return (
    <div
      className="objeto"
      data-accent={acento}
      data-highlight={presentacion?.resaltado ? 'si' : undefined}
      // El color del resaltado, cuando debe decir algo distinto del acento. Es una variable y no
      // una clase porque el valor sale de un rol del tema, no de un conjunto de estados.
      style={
        presentacion?.colorDeResaltado
          ? ({ '--color-de-resaltado': HIGHLIGHT_VARIABLE[presentacion.colorDeResaltado] } as React.CSSProperties)
          : undefined
      }
    >
      {withHeader ? (
      <div className="object__header">
        {icono && presentacion?.mostrarIcono !== false ? (
          // Decorativo: el nombre del objeto esta a su lado como texto. Darle tambien nombre
          // accesible haria que un lector leyera dos veces lo mismo.
          <span className="object__icon" aria-hidden="true">
            <Icon nombre={icono} tamano={18} />
          </span>
        ) : null}
        <div className="object__titulos">
          {/*
            El estilo sale de `estiloDeTexto`, la MISMA funcion para todos los objetos. Con cada
            uno traduciendo por su cuenta, «negrita» en una tarjeta y «negrita» en una tabla
            acabarian siendo pesos distintos.
          */}
          <h3 style={estiloDeTexto(presentacion?.textos?.titulo)} data-testid="title-object">
            {titulo}
          </h3>
          {presentacion?.subtitulo ? (
            <p
              className="object__subtitle"
              data-testid="subtitle-object"
              style={estiloDeTexto(presentacion.textos?.subtitulo)}
            >
              {presentacion.subtitulo}
            </p>
          ) : null}
        </div>
        {instance && result ? (
          <Addons
            instance={instance}
            result={result}
            titulo={titulo}
            aggregations={aggregations ?? []}
          />
        ) : null}
        {chrome.filtro ? <VisualFilter titulo={titulo} filtro={chrome.filtro} /> : null}
        {accion}
      </div>
      ) : null}
      {/*
        El cuerpo recibe parada de tabulacion SOLO si de verdad desborda.
        Una region desplazable tiene que alcanzarse con el teclado (2.1.1); ponerla en todas las
        tarjetas por si acaso sumaria una parada por objeto que no lleva a ninguna parte.
      */}
      {chrome.paginado?.coletilla === 'arriba' ? (
        <p className="paginado__coletilla es-arriba" data-testid={`pagination-legend-${titulo}`}>
          {paginationLegend(chrome.paginado.vista)}
        </p>
      ) : null}
      <div
        className="object__body"
        ref={body.ref}
        {...(body.overflows
          ? { tabIndex: 0, role: 'region', 'aria-label': `Contenido de ${titulo}` }
          : {})}
      >
        {children}
      </div>
      {/*
        El paginado va DEBAJO del cuerpo, fuera de el.
        Dentro se desplazaria con el contenido y habria que bajar hasta el final para cambiar de
        pagina; y el alto de la tarjeta lo manda la rejilla, asi que el sitio que ocupa se lo quita
        al cuerpo — no se lo suma a la tarjeta.
      */}
      {chrome.paginado ? <Pagination titulo={titulo} paginado={chrome.paginado} /> : null}
      {pie ? <div className="object__pie">{pie}</div> : null}
      {chrome.pie ? (
        <p className="object__pie" data-testid={`footer-${titulo}`}>
          {chrome.pie}
        </p>
      ) : null}
    </div>
  );
}

export function KpiCard({ titulo, result, instance, slots, aggregations, objectIcon }: PropsObject) {
  const r = porRanura(instance, slots);
  // El valor y la comparacion, en ese orden, salen de sus ranuras: con dos medidas mapeadas al
  // reves la tarjeta mostraba la comparacion como cifra principal.
  const medidas = r
    ? [r.one('valor'), r.one('comparacion')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;
  const kpi = toKpi(
    result,
    medidas,
    titulo,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );
  const delta = kpi.delta;
  const formatear = measureFormatter(instance.presentacion, medidas[0]);
  const valueColor = conditionalColor(
    instance.presentacion?.condicional,
    kpi.value,
    medidas[0],
  );
  const etiqueta = instance.presentacion?.etiqueta?.content;
  const labelPosition = instance.presentacion?.etiqueta?.cellPosition ?? 'debajo';

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      {/*
        El valor y su ETIQUETA, que es un texto propio y no el titulo reutilizado.
        El titulo dice que objeto es —y va en la cabecera, con el icono y los complementos—; la
        etiqueta dice que mide la cifra. Con uno solo no se puede tener una tarjeta titulada
        «Casos pendientes» cuya cifra se rotule «al cierre del trimestre».
      */}
      <div className="kpi" style={estiloDeTexto(instance.presentacion?.textos?.valor)}>
        {etiqueta && labelPosition === 'encima' ? (
          <p
            className="kpi__label"
            data-testid="label-kpi"
            style={estiloDeTexto(instance.presentacion?.textos?.etiqueta)}
          >
            {etiqueta}
          </p>
        ) : null}
        {/*
          El color condicional se aplica ENCIMA del estilo de texto del valor, no en su lugar.
          El estilo dice como se ve la cifra siempre —peso, alineacion, color base— y la regla dice
          que hoy esa cifra pide atencion. Si sustituyera al estilo, encender una regla borraria la
          negrita que alguien puso.
        */}
        <p
          className="kpi__value"
          data-testid="value-kpi"
          style={estiloDeTexto({
            ...instance.presentacion?.textos?.valor,
            ...(valueColor ? { color: valueColor } : {}),
          })}
        >
          {formatear(kpi.value)}
        </p>
        {etiqueta && labelPosition === 'debajo' ? (
          <p
            className="kpi__label"
            data-testid="label-kpi"
            style={estiloDeTexto(instance.presentacion?.textos?.etiqueta)}
          >
            {etiqueta}
          </p>
        ) : null}
      </div>
      {delta ? (
        <p className={`kpi__delta ${delta.absolute >= 0 ? 'es-positivo' : 'es-negativo'}`}>
          {delta.absolute >= 0 ? '+' : ''}
          {formatear(delta.absolute)}
          {delta.relative === null ? '' : ` (${(delta.relative * 100).toFixed(1)}%)`}
        </p>
      ) : null}
    </Frame>
  );
}

/** Barras horizontales — el mismo objeto con los ejes intercambiados. */
/** El hueco de una dona recien puesta, en porcentaje del radio. */
const DONUT_HOLE = 55;

export function HorizontalBars(props: PropsObject) {
  return <Bars {...props} horizontal />;
}

export function Area(props: PropsObject) {
  return <Lines {...props} area />;
}

export function Bars({
  titulo,
  result,
  instance,
  onFiltrar,
  slots,
  aggregations,
  horizontal,
  objectIcon,
}: PropsObject & { horizontal?: boolean }) {
  /*
   * El eje X sale de SU ranura, no de la primera dimension.
   */
  const r = porRanura(instance, slots);
  const multiple = r ? r.one('multiplo') : undefined;
  const ejeX = r ? r.one('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const serie = r ? r.one('serie') : fieldKeyDe(instance.binding.dimensions[1]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  /*
   * El multiplo va PRIMERO en las dimensiones.
   */
  const dimensiones = [multiple, ejeX, serie]
    .filter((c): c is string => c !== undefined)
    .map(aFieldRef);
  /*
   * El orden se aplica al MODELO, antes de repartirlo.
   */
  const vm = sortCategories(
    toCategorical(
      result,
      dimensiones,
      medidas,
      aggregationsFor(medidas, instance.binding.measures, aggregations),
    ),
    instance.presentacion?.orden,
  );
  // Los huecos no entran en el maximo: `Math.max` con un null lo convierte en 0, y con todos los
  // valores en hueco daria 0 y todas las barras a escala completa.
  const maximo = Math.max(
    1,
    ...vm.points.flatMap((p) => p.values.filter((v): v is number => v !== null)),
  );
  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  const formatear = (valor: number, s: number) =>
    measureFormatter(instance.presentacion, medidas[s] ?? '')(valor);

  const partition = multiple ? splitMultiples(vm) : undefined;

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      objectIcon={objectIcon}
      pie={vm.aggregated ? <span className="muted-text">Agregado sobre el dataset cacheado</span> : null}
    >
      {partition ? (
        <Multiples
          panels={partition.panels}
          omitted={partition.omitted}
          instance={instance}
          presentacion={panelPresentation(instance.presentacion, partition.panels)}
          tipo={horizontal ? 'barras-horizontales' : 'barras'}
          titulo={titulo}
          formatear={formatear}
          {...(dimension ? { dimension: fieldKey(dimension) } : {})}
          gridColumns={columnsFor(partition.panels.length, instance.presentacion?.multiplos?.gridColumns)}
          {...(onFiltrar ? { onFiltrar } : {})}
        />
      ) : (
      <Chart
        instanceId={instance.instanceId}
        tipo={horizontal ? 'barras-horizontales' : 'barras'}
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        // Un formateador POR MEDIDA, el mismo que usa la tabla de datos adjunta: sin esto, la
        // cifra sobre la barra y la de la tabla dirian el mismo numero de dos formas distintas.
        formatear={(valor, serie) =>
          measureFormatter(instance.presentacion, medidas[serie] ?? '')(valor)
        }
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (categoria: string) => onFiltrar(fieldKey(dimension), categoria) }
          : {})}
      >
      <ul className="barras" data-testid="barras">
        {vm.points.map((punto) => {
          const valor = punto.values[0] ?? 0;
          return (
            <li key={punto.label} className="bars__row">
              <button
                type="button"
                className="bars__label"
                data-testid={`bar-${punto.label}`}
                onClick={
                  dimension && onFiltrar
                    ? () => onFiltrar(fieldKey(dimension), punto.label)
                    : undefined
                }
                title={dimension ? `Filtrar por ${punto.label}` : undefined}
              >
                {punto.label}
              </button>
              <span className="bars__pista">
                <span className="bars__relleno" style={{ width: `${(valor / maximo) * 100}%` }} />
              </span>
              <span className="bars__value">{formatNumber(valor)}</span>
            </li>
          );
        })}
      </ul>
      </Chart>
      )}
    </Frame>
  );
}

export function Lines({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  area,
  onFiltrar,
  objectIcon,
}: PropsObject & { area?: boolean }) {
  const r = porRanura(instance, slots);
  const multiple = r ? r.one('multiplo') : undefined;
  const ejeX = r ? r.one('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  // El multiplo va PRIMERO, por lo mismo que en columnas: `toCategorical` compone las etiquetas
  // en el orden de las dimensiones y partirlas supone que el primer trozo es el panel.
  const dimensiones = [multiple, ejeX]
    .filter((c): c is string => c !== undefined)
    .map(aFieldRef);
  const vm = sortCategories(
    toCategorical(
      result,
      dimensiones,
      medidas,
      aggregationsFor(medidas, instance.binding.measures, aggregations),
    ),
    instance.presentacion?.orden,
  );
  const formatear = (valor: number, s: number) =>
    measureFormatter(instance.presentacion, medidas[s] ?? '')(valor);
  const partition = multiple ? splitMultiples(vm) : undefined;

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      {partition ? (
        <Multiples
          panels={partition.panels}
          omitted={partition.omitted}
          instance={instance}
          presentacion={panelPresentation(instance.presentacion, partition.panels)}
          tipo={area ? 'area' : 'lineas'}
          titulo={titulo}
          formatear={formatear}
          {...(dimension ? { dimension: fieldKey(dimension) } : {})}
          gridColumns={columnsFor(partition.panels.length, instance.presentacion?.multiplos?.gridColumns)}
          {...(onFiltrar ? { onFiltrar } : {})}
        />
      ) : (
      /*
       * Una linea tambien FILTRA.
       */
      <Chart
        instanceId={instance.instanceId}
        tipo={area ? 'area' : 'lineas'}
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor, serie) =>
          measureFormatter(instance.presentacion, medidas[serie] ?? '')(valor)
        }
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (categoria: string) => onFiltrar(fieldKey(dimension), categoria) }
          : {})}
      >
        {/*
          El respaldo de una linea es una TABLA, no un dibujo.
          
          Una serie temporal tiene un valor por punto y por serie; en cuanto no se puede ver la
          forma de la curva, lo util son las cifras. Dibujar unas barras aqui seria inventar una
          lectura que el objeto no propone.
        */}
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid="lineas">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                {vm.series.map((serie) => (
                  <th key={serie} scope="col" className="is-number">
                    {serie}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto) => (
                <tr key={punto.label}>
                  <CategoryCell
                    etiqueta={punto.label}
                    {...(dimension ? { fieldName: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="is-number">
                      {formatNumber(punto.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
      )}
    </Frame>
  );
}

/** Pequenos multiplos: el mismo grafico, una vez por panel, dentro de UNA tarjeta. */
function Multiples({
  panels,
  omitted,
  instance,
  presentacion,
  tipo,
  titulo,
  formatear,
  columnSeries,
  dimension,
  gridColumns,
  onFiltrar,
}: {
  panels: MultiplePanel[];
  /** Cuantos valores de la dimension no caben en el limite. Se dicen; no se ocultan. */
  omitted: number;
  instance: ObjectInstance;
  presentacion: ObjectPresentation | undefined;
  tipo: ChartKind;
  titulo: string;
  formatear: (valor: number, serie: number) => string;
  columnSeries?: number;
  dimension?: string;
  gridColumns: number;
  /** Filtrar desde un panel filtra por la CATEGORIA DEL EJE, no por el valor del panel. */
  onFiltrar?: (fieldName: string, valor: string) => void;
}) {
  return (
    <div
      className="multiplos"
      data-testid="multiplos"
      style={{ '--multiplos-columnas': gridColumns } as React.CSSProperties}
    >
      {panels.map((panel, i) => (
        <section key={panel.titulo} className="multiples__panel">
          {/*
            El rotulo de cada panel es un encabezado de verdad, no un texto suelto.
            Es lo unico que dice de que valor es cada grafico, y con lector de pantalla la lista de
            encabezados es como se recorre una tarjeta con seis graficos dentro.
          */}
          <h4 className="multiples__title">{panel.titulo}</h4>
          <Chart
            instanceId={`${instance.instanceId}-m${i}`}
            tipo={tipo}
            vm={panel.vm}
            titulo={`${titulo} — ${panel.titulo}`}
            {...(presentacion
              ? {
                  /*
                   * La leyenda, SOLO en el primer panel.
                   */
                  presentacion: i === 0 ? presentacion : { ...presentacion, leyenda: 'oculta' },
                }
              : {})}
            formatear={formatear}
            {...(columnSeries === undefined ? {} : { columnSeries })}
            {...(dimension ? { dimension } : {})}
            {...(dimension && onFiltrar
              ? { onSeleccionar: (categoria: string) => onFiltrar(dimension, categoria) }
              : {})}
          >
            {/* El nombre lleva el del PANEL: con el del objeto, los seis respaldos de una
                tarjeta de multiplos se anunciarian con el mismo rotulo y no habria forma de
                saber cual se esta leyendo. */}
            <FallbackTable nombre={`${titulo} — ${panel.titulo}`}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">{panel.titulo}</th>
                    {panel.vm.series.map((serie) => (
                      <th key={serie} scope="col" className="is-number">
                        {serie}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {panel.vm.points.map((punto) => (
                    <tr key={punto.label}>
                      <CategoryCell
                        etiqueta={punto.label}
                        {...(dimension ? { fieldName: dimension } : {})}
                        {...(onFiltrar ? { onFiltrar } : {})}
                      />
                      {panel.vm.series.map((serie, sIdx) => (
                        <td key={serie} className="is-number">
                          {formatNumber(punto.values[sIdx] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </FallbackTable>
          </Chart>
        </section>
      ))}

      {/*
        Lo que no cabe se DICE.
        Recortar en silencio deja a quien mira creyendo que la dimension tiene doce valores, que
        es la misma clase de mentira que 4.2 cierra al obligar a marcar un objeto roto en vez de
        omitirlo. Ocupa su propia celda de la rejilla para no robarle alto a ningun panel.
      */}
      {omitted > 0 ? (
        <p className="multiples__omitted" data-testid="omitted-multiples">
          {omitted === 1
            ? 'Hay 1 valor mas que no cabe. Ordene la dimension para ver otros.'
            : `Hay ${omitted} valores mas que no caben. Ordene la dimension para ver otros.`}
        </p>
      ) : null}
    </div>
  );
}

/** La presentacion con la que se dibuja CADA panel. */
function panelPresentation(
  presentacion: ObjectPresentation | undefined,
  panels: MultiplePanel[],
): ObjectPresentation | undefined {
  if (presentacion?.multiplos?.sameScale === false) return presentacion;
  const maximo = maxCommon(panels);
  if (maximo === undefined || presentacion?.ejes?.maximoY !== undefined) return presentacion;
  /*
   * El maximo se REDONDEA hacia arriba a un numero de escala.
   */
  return { ...presentacion, ejes: { ...presentacion?.ejes, maximoY: niceScale(maximo) } };
}

/** La celda de categoria del respaldo, que ademas FILTRA. */
function CategoryCell({
  etiqueta,
  valor,
  fieldName,
  onFiltrar,
}: {
  etiqueta: string;
  /** Lo que se manda al filtro, cuando no es lo mismo que se lee. */
  valor?: string;
  /** La dimension por la que se filtra. Sin ella el objeto no tiene por que ofrecer el gesto. */
  fieldName?: string;
  onFiltrar?: (fieldName: string, valor: string) => void;
}) {
  const filter = valor ?? etiqueta;
  if (!fieldName || !onFiltrar) return <th scope="row">{etiqueta}</th>;
  return (
    <th scope="row">
      <button
        type="button"
        className="button-link"
        data-testid={`filter-${filter}`}
        title={`Filtrar por ${filter}`}
        onClick={() => onFiltrar(fieldName, filter)}
      >
        {etiqueta}
      </button>
    </th>
  );
}

/** El contenedor del respaldo accesible de un objeto. */
function FallbackTable({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="container-table" tabIndex={0} role="region" aria-label={nombre}>
      {children}
    </div>
  );
}

/** Combinado de columnas y lineas. */
export function Combo({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  onFiltrar,
  objectIcon,
}: PropsObject) {
  const r = porRanura(instance, slots);
  const ejeX = r ? r.one('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const deColumnas = r ? r.varios('columnas') : instance.binding.measures.slice(0, 1);
  const lines = r ? r.varios('lineas') : instance.binding.measures.slice(1);
  const medidas = [...deColumnas, ...lines];

  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  const vm = sortCategories(
    toCategorical(
      result,
      dimension ? [dimension] : [],
      medidas,
      aggregationsFor(medidas, instance.binding.measures, aggregations),
    ),
    instance.presentacion?.orden,
  );

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo="combinado"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        columnSeries={deColumnas.length}
        formatear={(valor, serie) =>
          measureFormatter(instance.presentacion, medidas[serie] ?? '')(valor)
        }
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (c: string) => onFiltrar(fieldKey(dimension), c) }
          : {})}
      >
        {/*
          El respaldo marca QUE FORMA tiene cada medida.
          
          Sin eso, la tabla del camino accesible seria indistinguible de la de un grafico de
          lineas normal, y justo lo que este objeto anade —que unas medidas son columnas y otras
          linea— desapareceria para quien no ve el dibujo.
        */}
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid="combinado">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                {vm.series.map((serie, s) => (
                  <th key={serie} scope="col" className="is-number">
                    {serie} ({s < deColumnas.length ? 'columna' : 'linea'})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto) => (
                <tr key={punto.label}>
                  <CategoryCell
                    etiqueta={punto.label}
                    {...(dimension ? { fieldName: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="is-number">
                      {measureFormatter(instance.presentacion, serie)(punto.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
    </Frame>
  );
}

/** Dispersion — dos medidas enfrentadas, un punto por categoria. */
export function Scatter({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  onFiltrar,
  objectIcon,
}: PropsObject) {
  const r = porRanura(instance, slots);
  const punto = r ? r.one('punto') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r
    ? [r.one('eje-x'), r.one('eje-y'), r.one('tamano')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;

  const dimension = punto ? aFieldRef(punto) : undefined;
  const vm = toCategorical(
    result,
    dimension ? [dimension] : [],
    medidas,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo="dispersion"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor, serie) =>
          measureFormatter(instance.presentacion, medidas[serie] ?? '')(valor)
        }
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (c: string) => onFiltrar(fieldKey(dimension), c) }
          : {})}
      >
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid="dispersion">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Punto'}</th>
                {vm.series.map((serie) => (
                  <th key={serie} scope="col" className="is-number">
                    {serie}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((p) => (
                <tr key={p.label}>
                  <CategoryCell
                    etiqueta={p.label}
                    {...(dimension ? { fieldName: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="is-number">
                      {measureFormatter(instance.presentacion, serie)(p.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
    </Frame>
  );
}

/** Embudo y cascada comparten la misma forma de datos: una dimension y una medida. */
function MeasureDimension({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  onFiltrar,
  objectIcon,
  tipo,
  dimensionSlot,
  columnaExtra,
}: PropsObject & {
  tipo: 'embudo' | 'cascada';
  dimensionSlot: string;
  columnaExtra: { heading: string; cell: (valores: number[], i: number) => string };
}) {
  const r = porRanura(instance, slots);
  const dim = r ? r.one(dimensionSlot) : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;
  const dimension = dim ? aFieldRef(dim) : undefined;

  const vm = sortCategories(
    toCategorical(
      result,
      dimension ? [dimension] : [],
      medidas,
      aggregationsFor(medidas, instance.binding.measures, aggregations),
    ),
    // El embudo NO admite `orden` en su presentacion; llega siempre `undefined` y el orden es el
    // del dataset, que es el del proceso. La cascada si lo admite.
    instance.presentacion?.orden,
  );
  const formatear = measureFormatter(instance.presentacion, medidas[0] ?? '');
  const valores = vm.points.map((p) => p.values[0] ?? 0);

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo={tipo}
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor) => formatear(valor)}
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (c: string) => onFiltrar(fieldKey(dimension), c) }
          : {})}
      >
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid={tipo}>
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                <th scope="col" className="is-number">
                  {medidas[0] ?? 'Valor'}
                </th>
                <th scope="col" className="is-number">
                  {columnaExtra.heading}
                </th>
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto, i) => (
                <tr key={punto.label}>
                  <CategoryCell
                    etiqueta={punto.label}
                    {...(dimension ? { fieldName: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="is-number">{formatear(punto.values[0] ?? null)}</td>
                  <td className="is-number">{columnaExtra.cell(valores, i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
    </Frame>
  );
}

export function Funnel(props: PropsObject) {
  const compare = props.instance.presentacion?.embudo?.compare ?? 'primero';
  return (
    <MeasureDimension
      {...props}
      tipo="embudo"
      dimensionSlot="etapa"
      columnaExtra={{
        heading: compare === 'anterior' ? 'De la anterior' : 'De la primera',
        cell: (valores, i) => {
          const base = compare === 'anterior' ? (valores[i - 1] ?? valores[i]) : valores[0];
          const valor = valores[i];
          // Una etapa de referencia en cero no da «caida infinita»: da una comparacion sin
          // sentido, y la raya lo dice mejor que un numero inventado.
          if (base === undefined || base === 0 || valor === undefined) return '—';
          return `${((valor / base) * 100).toFixed(1)} %`;
        },
      }}
    />
  );
}

export function Waterfall(props: PropsObject) {
  return (
    <MeasureDimension
      {...props}
      tipo="cascada"
      dimensionSlot="categoria"
      columnaExtra={{
        // El acumulado es lo que la cascada DIBUJA: sin esta columna, el respaldo seria una lista
        // de contribuciones y la altura de cada barra —que es el acumulado— se perderia.
        heading: 'Acumulado',
        cell: (valores, i) => {
          const hasta = valores.slice(0, i + 1).reduce((suma, v) => suma + v, 0);
          return String(hasta);
        },
      }}
    />
  );
}

/** Mapa de arbol — una o dos dimensiones, una medida. */
export function TreeMap({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  onFiltrar,
  objectIcon,
}: PropsObject) {
  const r = porRanura(instance, slots);
  const grupo = r ? r.one('grupo') : fieldKeyDe(instance.binding.dimensions[0]);
  const detalle = r ? r.one('detalle') : fieldKeyDe(instance.binding.dimensions[1]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;

  const dimensiones = [grupo, detalle].filter((c): c is string => c !== undefined).map(aFieldRef);
  const vm = toCategorical(
    result,
    dimensiones,
    medidas,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );
  const formatear = measureFormatter(instance.presentacion, medidas[0] ?? '');
  const principal = dimensiones[0];

  /*
   * El nombre que ECharts entrega al pulsar, convertido en un valor de la PRIMERA dimension.
   */
  const grupoDe = (node: string): string => {
    const withNameThat = vm.points.find((p) => p.label === node || p.label.endsWith(` / ${node}`));
    return withNameThat?.label.split(' / ')[0] ?? node;
  };

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo="mapa-de-arbol"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor) => formatear(valor)}
        {...(principal ? { dimension: fieldKey(principal) } : {})}
        {...(principal && onFiltrar
          ? { onSeleccionar: (node: string) => onFiltrar(fieldKey(principal), grupoDe(node)) }
          : {})}
      >
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid="mapa-de-arbol">
            <thead>
              <tr>
                <th scope="col">{principal ? fieldKey(principal) : 'Grupo'}</th>
                <th scope="col" className="is-number">
                  {medidas[0] ?? 'Valor'}
                </th>
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto) => (
                <tr key={punto.label}>
                  {/*
                    El rectangulo filtra con el raton y esta celda con el teclado. Faltaba la
                    segunda, que es la unica que existe para quien no puede pulsar un area de un
                    `<canvas>`.
                  */}
                  <CategoryCell
                    etiqueta={punto.label}
                    valor={punto.label.split(' / ')[0] ?? punto.label}
                    {...(principal ? { fieldName: fieldKey(principal) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="is-number">{formatear(punto.values[0] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
    </Frame>
  );
}

/** Circular — pastel y dona. */
export function Pie({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  onFiltrar,
  objectIcon,
  hole,
}: PropsObject & { hole?: number }) {
  const r = porRanura(instance, slots);
  const categoria = r ? r.one('categoria') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;
  const dimension = categoria ? aFieldRef(categoria) : undefined;

  const vm = toCategorical(
    result,
    dimension ? [dimension] : [],
    medidas,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );
  const formatear = measureFormatter(instance.presentacion, medidas[0] ?? '');

  /*
   * El hueco por defecto del objeto, que la presentacion anula.
   */
  const circular = {
    ...(hole === undefined ? {} : { radioInterior: hole }),
    ...instance.presentacion?.circular,
  };
  const presentacion = { ...instance.presentacion, circular };

  // El total se calcula sobre lo que de verdad se dibuja: los nulos no entran, igual que en el
  // grafico. Si entraran como cero, el porcentaje del respaldo no cuadraria con el del dibujo.
  const valores = vm.points
    .map((p) => ({ label: p.label, valor: p.values[0] }))
    .filter((p): p is { label: string; valor: number } => p.valor !== null);
  const total = valores.reduce((suma, p) => suma + p.valor, 0);

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo="circular"
        vm={vm}
        titulo={titulo}
        presentacion={presentacion}
        formatear={(valor) => formatear(valor)}
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (c: string) => onFiltrar(fieldKey(dimension), c) }
          : {})}
      >
        {/*
          El respaldo lleva la cifra Y su parte del total.
          
          Es lo que el dibujo comunica: la porcion es el porcentaje. Un respaldo con solo las
          cifras obligaria a dividir de cabeza para leer lo mismo que el grafico ensena de un
          vistazo, y entonces el camino accesible diria menos que el otro.
        */}
        <FallbackTable nombre={titulo}>
          <table className="tabla" data-testid="circular">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                <th scope="col" className="is-number">
                  {medidas[0] ?? 'Valor'}
                </th>
                <th scope="col" className="is-number">
                  Parte
                </th>
              </tr>
            </thead>
            <tbody>
              {valores.map((punto) => (
                <tr key={punto.label}>
                  <CategoryCell
                    etiqueta={punto.label}
                    {...(dimension ? { fieldName: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="is-number">{formatear(punto.valor)}</td>
                  <td className="is-number">
                    {total === 0 ? '—' : `${((punto.valor / total) * 100).toFixed(1)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FallbackTable>
      </Chart>
    </Frame>
  );
}

/** La dona es el circular con hueco. Nada mas: mismo contrato, mismo dibujo, mismo respaldo. */
export function Donut(props: PropsObject) {
  return <Pie {...props} hole={DONUT_HOLE} />;
}

/** Medidor — una cifra contra su meta. */
export function Gauge({
  titulo,
  result,
  instance,
  slots,
  aggregations,
  objectIcon,
}: PropsObject) {
  const r = porRanura(instance, slots);
  const medidas = r
    ? [r.one('valor'), r.one('objetivo')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;

  const vm = toCategorical(
    result,
    [],
    medidas,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );
  const formatear = measureFormatter(instance.presentacion, medidas[0] ?? '');
  const punto = vm.points[0];
  const valor = punto?.values[0] ?? null;
  const objetivo = punto?.values[1] ?? instance.presentacion?.medidor?.objetivo ?? null;
  const scale = gaugeScale(instance.presentacion?.medidor, valor, objetivo);

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <Chart
        instanceId={instance.instanceId}
        tipo="medidor"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(v) => formatear(v)}
      >
        {/*
          El respaldo dice cuanto falta, no solo cuanto hay.
          
          Es lo que la aguja contra la marca ensena de un vistazo y lo que un lector de pantalla
          no puede deducir de dos cifras sueltas.
        */}
        <dl className="fallback-gauge" data-testid="medidor">
          <div>
            <dt>{medidas[0] ?? 'Valor'}</dt>
            <dd>{formatear(valor)}</dd>
          </div>
          {/*
            La ESCALA, que es lo que convierte la cifra en un medidor.
            Sin ella el respaldo dice «15,741» y no dice de cuanto: un medidor no mide una
            magnitud, mide una POSICION dentro de un rango, y esa es justo la informacion que la
            aguja contra el arco da de un vistazo y que dos cifras sueltas no pueden dar. Sale de
            la misma funcion que el dibujo, para que el respaldo no afirme un limite distinto.
          */}
          <div>
            <dt>Escala</dt>
            <dd>
              {formatear(scale.minimo)} – {formatear(scale.maximo)}
            </dd>
          </div>
          {objetivo === null ? null : (
            <>
              <div>
                <dt>Objetivo</dt>
                <dd>{formatear(objetivo)}</dd>
              </div>
              <div>
                <dt>Diferencia</dt>
                <dd>{valor === null ? '—' : formatear(valor - objetivo)}</dd>
              </div>
            </>
          )}
        </dl>
      </Chart>
    </Frame>
  );
}

export function Table({ titulo, result, instance, aggregations, objectIcon }: PropsObject) {
  // La tabla dibuja SU proyeccion, no el dataset en crudo.
  //
  // Antes pintaba todas las columnas del dataset, incluidas las que su mapeo no declara, y las
  // filas sin agregar: un mapeo de dos dimensiones sobre un dataset con tres mostraba la tercera
  // y repetia cada combinacion. Es la misma funcion que usan la exportacion y el complemento de
  // tabla de datos, asi que lo que se ve y lo que se exporta no pueden separarse.
  const projected = projectObject(instance, result, aggregations);

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      {/*
        Una tabla tiene varias medidas y cada una con su formato: el formateador se elige POR
        COLUMNA, no uno para toda la tabla. Es el caso que la forma anterior del formato no podia
        cubrir — casos y dias de resolucion salian iguales porque el formato era del objeto.
      */}
      <SortableTable
        projected={projected}
        titulo={titulo}
        formatColumn={(nombre) => measureFormatter(instance.presentacion, nombre)}
        {...(instance.presentacion?.condicional
          ? { condicional: instance.presentacion.condicional }
          : {})}
      />
    </Frame>
  );
}

export function Matrix({ titulo, result, instance, slots, aggregations, objectIcon }: PropsObject) {
  const r = porRanura(instance, slots);
  // Varios niveles por pozo: es lo que convierte el cruce plano en una jerarquia.
  const rowDims = (r ? r.varios('filas') : instance.binding.dimensions.slice(0, 1).map(fieldKey))
    .map(aFieldRef);
  const columnDims = (
    r ? r.varios('columnas') : instance.binding.dimensions.slice(1, 2).map(fieldKey)
  ).map(aFieldRef);
  const medidas = r ? r.varios('valores') : instance.binding.measures;

  const vm = buildMatrix(
    result,
    rowDims,
    columnDims,
    medidas,
    aggregationsFor(medidas, instance.binding.measures, aggregations),
  );

  return (
    <Frame
      titulo={titulo}
      instance={instance}
      result={result}
      aggregations={aggregations}
      objectIcon={objectIcon}
    >
      <MatrixTable vm={vm} titulo={titulo} instance={instance} />
    </Frame>
  );
}

export interface PropsObject {
  titulo: string;
  result: QueryResult;
  instance: ObjectInstance;
  /** Con que operador se resume cada medida, alineado con `instance.binding.measures`. */
  aggregations: Aggregation[];
  /** Las ranuras que declara la version del objeto. */
  slots?: FieldSlot[];
  /** Filtrado cruzado (4.4): anade un filtro a la query string, no a un estado paralelo. */
  onFiltrar?: (fieldName: string, valor: string) => void;
  /** El icono que declara la version del objeto en el catalogo. */
  objectIcon?: IconName;
}

/** `FieldRef` -> 'Tabla.Campo', tolerando que no haya campo. */
const fieldKeyDe = (ref: { table: string; field: string } | undefined): string | undefined =>
  ref ? fieldKey(ref) : undefined;

/** Objeto declarado en el catalogo pero sin render disponible todavia (el mapa). */
export function ObjectNotAvailable({ titulo, objectId }: { titulo: string; objectId: string }) {
  return (
    <div className="objeto object--not-available">
      <div className="object__header">
        <h3>{titulo}</h3>
        <span className="insignia">No disponible</span>
      </div>
      <div className="object__body">
        <p className="muted-text">
          El objeto <code>{objectId}</code> esta declarado en el catalogo pero su render aun no
          esta implementado.
        </p>
      </div>
    </div>
  );
}

export { Slicer, toSlicerOptions };
