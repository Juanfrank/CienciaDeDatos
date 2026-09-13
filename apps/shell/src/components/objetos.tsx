'use client';

import type { Agregacion, QueryResult } from '@app/data-contracts';
import {
  type BindingProblem,
  type NombreDeIcono,
  type PanelDeMultiplo,
  type PresentacionDeObjeto,
  type RanuraDeCampos,
  type TipoDeGrafico,
  aFieldRef,
  agregacionesPara,
  escalaDelMedidor,
  campoDeRanura,
  colorCondicional,
  columnasPara,
  escalaBonita,
  maximoComun,
  partirEnMultiplos,
  estiloDeTexto,
  fieldKey,
  ordenarCategorias,
  ranurasDe,
  formateadorDeMedida,
  proyectarObjeto,
  construirMatriz,
  toCategorical,
  toKpi,
  toSlicerOptions,
} from '@app/ui-components';
import type { ObjectInstance } from '@app/ui-components';
import { useDesborda } from '../hooks/useDesborda';
import { Complementos } from './Complementos';
import { TablaDeMatriz } from './TablaDeMatriz';
import { TablaOrdenable } from './TablaOrdenable';
import { Grafico } from './Grafico';
import { Segmentador } from './Segmentador';
import { Icono } from './iconos/Icono';

/** Objetos prediseñados — seccion 4.2. */

/** El formato por defecto, para lo que no es una cifra de la instancia. */
/** Numero para pantalla. `null` es «no hay respuesta» y se dibuja como raya, no como cero. */
const formatearNumero = (n: number | null): string =>
  n === null ? '—' : new Intl.NumberFormat('es-DO').format(Math.round(n));

/** Los campos de un objeto, LEIDOS POR RANURA. */
function porRanura(instance: ObjectInstance, ranuras: RanuraDeCampos[] | undefined) {
  if (!ranuras || ranuras.length === 0) return null;
  return {
    uno: (id: string) => campoDeRanura(instance, ranuras, id),
    varios: (id: string) => ranurasDe(instance, ranuras).get(id) ?? [],
  };
}

/** La variable del tema de cada rol, para la linea de resaltado. */
const VARIABLE_DE_RESALTADO: Record<string, string> = {
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

/** Icono por defecto de cada tipo, cuando la instancia no elige otro. */
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

/** Marco comun de un objeto. */
/*
 * Se EXPORTA.
 */
export function Marco({
  titulo,
  children,
  pie,
  accion,
  instance,
  result,
  agregaciones,
  iconoDelObjeto,
}: {
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** Un control propio del objeto, junto a los complementos. Por ejemplo «Limpiar». */
  accion?: React.ReactNode;
  instance?: ObjectInstance;
  result?: QueryResult;
  /** Para los complementos: la tabla de datos proyecta con los mismos operadores que el objeto. */
  agregaciones?: Agregacion[];
  /** El que declara la version del objeto. La presentacion de la instancia lo anula. */
  iconoDelObjeto?: NombreDeIcono;
}) {
  /*
   * La presentacion se dibuja AQUI, en el marco comun, y no en cada objeto.
   */
  const presentacion = instance?.presentacion;
  // El icono por defecto lo declara el objeto y viaja con el; la presentacion solo lo anula.
  const icono = presentacion?.icono ?? iconoDelObjeto;
  const acento = presentacion?.acento ?? 'primario';
  /*
   * La cabecera entera se puede ocultar.
   */
  const conCabecera = presentacion?.mostrarTitulo !== false;
  const cuerpo = useDesborda<HTMLDivElement>();

  return (
    <div
      className="objeto"
      data-acento={acento}
      data-resaltado={presentacion?.resaltado ? 'si' : undefined}
      // El color del resaltado, cuando debe decir algo distinto del acento. Es una variable y no
      // una clase porque el valor sale de un rol del tema, no de un conjunto de estados.
      style={
        presentacion?.colorDeResaltado
          ? ({ '--color-de-resaltado': VARIABLE_DE_RESALTADO[presentacion.colorDeResaltado] } as React.CSSProperties)
          : undefined
      }
    >
      {conCabecera ? (
      <div className="objeto__cabecera">
        {icono && presentacion?.mostrarIcono !== false ? (
          // Decorativo: el nombre del objeto esta a su lado como texto. Darle tambien nombre
          // accesible haria que un lector leyera dos veces lo mismo.
          <span className="objeto__icono" aria-hidden="true">
            <Icono nombre={icono} tamano={18} />
          </span>
        ) : null}
        <div className="objeto__titulos">
          {/*
            El estilo sale de `estiloDeTexto`, la MISMA funcion para todos los objetos. Con cada
            uno traduciendo por su cuenta, «negrita» en una tarjeta y «negrita» en una tabla
            acabarian siendo pesos distintos.
          */}
          <h3 style={estiloDeTexto(presentacion?.textos?.titulo)} data-testid="objeto-titulo">
            {titulo}
          </h3>
          {presentacion?.subtitulo ? (
            <p
              className="objeto__subtitulo"
              data-testid="objeto-subtitulo"
              style={estiloDeTexto(presentacion.textos?.subtitulo)}
            >
              {presentacion.subtitulo}
            </p>
          ) : null}
        </div>
        {instance && result ? (
          <Complementos
            instance={instance}
            result={result}
            titulo={titulo}
            agregaciones={agregaciones ?? []}
          />
        ) : null}
        {accion}
      </div>
      ) : null}
      {/*
        El cuerpo recibe parada de tabulacion SOLO si de verdad desborda.
        Una region desplazable tiene que alcanzarse con el teclado (2.1.1); ponerla en todas las
        tarjetas por si acaso sumaria una parada por objeto que no lleva a ninguna parte.
      */}
      <div
        className="objeto__cuerpo"
        ref={cuerpo.ref}
        {...(cuerpo.desborda
          ? { tabIndex: 0, role: 'region', 'aria-label': `Contenido de ${titulo}` }
          : {})}
      >
        {children}
      </div>
      {pie ? <div className="objeto__pie">{pie}</div> : null}
    </div>
  );
}

export function TarjetaKpi({ titulo, result, instance, ranuras, agregaciones, iconoDelObjeto }: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  // El valor y la comparacion, en ese orden, salen de sus ranuras: con dos medidas mapeadas al
  // reves la tarjeta mostraba la comparacion como cifra principal.
  const medidas = r
    ? [r.uno('valor'), r.uno('comparacion')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;
  const kpi = toKpi(
    result,
    medidas,
    titulo,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );
  const delta = kpi.delta;
  const formatear = formateadorDeMedida(instance.presentacion, medidas[0]);
  const colorDelValor = colorCondicional(
    instance.presentacion?.condicional,
    kpi.value,
    medidas[0],
  );
  const etiqueta = instance.presentacion?.etiqueta?.texto;
  const posicionDeEtiqueta = instance.presentacion?.etiqueta?.posicion ?? 'debajo';

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      {/*
        El valor y su ETIQUETA, que es un texto propio y no el titulo reutilizado.
        El titulo dice que objeto es —y va en la cabecera, con el icono y los complementos—; la
        etiqueta dice que mide la cifra. Con uno solo no se puede tener una tarjeta titulada
        «Casos pendientes» cuya cifra se rotule «al cierre del trimestre».
      */}
      <div className="kpi" style={estiloDeTexto(instance.presentacion?.textos?.valor)}>
        {etiqueta && posicionDeEtiqueta === 'encima' ? (
          <p
            className="kpi__etiqueta"
            data-testid="kpi-etiqueta"
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
          className="kpi__valor"
          data-testid="kpi-valor"
          style={estiloDeTexto({
            ...instance.presentacion?.textos?.valor,
            ...(colorDelValor ? { color: colorDelValor } : {}),
          })}
        >
          {formatear(kpi.value)}
        </p>
        {etiqueta && posicionDeEtiqueta === 'debajo' ? (
          <p
            className="kpi__etiqueta"
            data-testid="kpi-etiqueta"
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
    </Marco>
  );
}

/** Barras horizontales — el mismo objeto con los ejes intercambiados. */
/** El hueco de una dona recien puesta, en porcentaje del radio. */
const HUECO_DE_DONA = 55;

export function BarrasHorizontales(props: ObjetoProps) {
  return <Barras {...props} horizontal />;
}

export function Area(props: ObjetoProps) {
  return <Lineas {...props} area />;
}

export function Barras({
  titulo,
  result,
  instance,
  onFiltrar,
  ranuras,
  agregaciones,
  horizontal,
  iconoDelObjeto,
}: ObjetoProps & { horizontal?: boolean }) {
  /*
   * El eje X sale de SU ranura, no de la primera dimension.
   */
  const r = porRanura(instance, ranuras);
  const multiplo = r ? r.uno('multiplo') : undefined;
  const ejeX = r ? r.uno('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const serie = r ? r.uno('serie') : fieldKeyDe(instance.binding.dimensions[1]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  /*
   * El multiplo va PRIMERO en las dimensiones.
   */
  const dimensiones = [multiplo, ejeX, serie]
    .filter((c): c is string => c !== undefined)
    .map(aFieldRef);
  /*
   * El orden se aplica al MODELO, antes de repartirlo.
   */
  const vm = ordenarCategorias(
    toCategorical(
      result,
      dimensiones,
      medidas,
      agregacionesPara(medidas, instance.binding.measures, agregaciones),
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
    formateadorDeMedida(instance.presentacion, medidas[s] ?? '')(valor);

  const particion = multiplo ? partirEnMultiplos(vm) : undefined;

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      iconoDelObjeto={iconoDelObjeto}
      pie={vm.aggregated ? <span className="texto-atenuado">Agregado sobre el dataset cacheado</span> : null}
    >
      {particion ? (
        <Multiplos
          paneles={particion.paneles}
          omitidos={particion.omitidos}
          instance={instance}
          presentacion={presentacionDePanel(instance.presentacion, particion.paneles)}
          tipo={horizontal ? 'barras-horizontales' : 'barras'}
          titulo={titulo}
          formatear={formatear}
          {...(dimension ? { dimension: fieldKey(dimension) } : {})}
          columnas={columnasPara(particion.paneles.length, instance.presentacion?.multiplos?.columnas)}
          {...(onFiltrar ? { onFiltrar } : {})}
        />
      ) : (
      <Grafico
        instanceId={instance.instanceId}
        tipo={horizontal ? 'barras-horizontales' : 'barras'}
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        // Un formateador POR MEDIDA, el mismo que usa la tabla de datos adjunta: sin esto, la
        // cifra sobre la barra y la de la tabla dirian el mismo numero de dos formas distintas.
        formatear={(valor, serie) =>
          formateadorDeMedida(instance.presentacion, medidas[serie] ?? '')(valor)
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
      )}
    </Marco>
  );
}

export function Lineas({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  area,
  onFiltrar,
  iconoDelObjeto,
}: ObjetoProps & { area?: boolean }) {
  const r = porRanura(instance, ranuras);
  const multiplo = r ? r.uno('multiplo') : undefined;
  const ejeX = r ? r.uno('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  // El multiplo va PRIMERO, por lo mismo que en columnas: `toCategorical` compone las etiquetas
  // en el orden de las dimensiones y partirlas supone que el primer trozo es el panel.
  const dimensiones = [multiplo, ejeX]
    .filter((c): c is string => c !== undefined)
    .map(aFieldRef);
  const vm = ordenarCategorias(
    toCategorical(
      result,
      dimensiones,
      medidas,
      agregacionesPara(medidas, instance.binding.measures, agregaciones),
    ),
    instance.presentacion?.orden,
  );
  const formatear = (valor: number, s: number) =>
    formateadorDeMedida(instance.presentacion, medidas[s] ?? '')(valor);
  const particion = multiplo ? partirEnMultiplos(vm) : undefined;

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      {particion ? (
        <Multiplos
          paneles={particion.paneles}
          omitidos={particion.omitidos}
          instance={instance}
          presentacion={presentacionDePanel(instance.presentacion, particion.paneles)}
          tipo={area ? 'area' : 'lineas'}
          titulo={titulo}
          formatear={formatear}
          {...(dimension ? { dimension: fieldKey(dimension) } : {})}
          columnas={columnasPara(particion.paneles.length, instance.presentacion?.multiplos?.columnas)}
          {...(onFiltrar ? { onFiltrar } : {})}
        />
      ) : (
      /*
       * Una linea tambien FILTRA.
       */
      <Grafico
        instanceId={instance.instanceId}
        tipo={area ? 'area' : 'lineas'}
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor, serie) =>
          formateadorDeMedida(instance.presentacion, medidas[serie] ?? '')(valor)
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
        <TablaDeRespaldo nombre={titulo}>
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
                  <CeldaDeCategoria
                    etiqueta={punto.label}
                    {...(dimension ? { campo: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="es-numero">
                      {formatearNumero(punto.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
      )}
    </Marco>
  );
}

/** Pequenos multiplos: el mismo grafico, una vez por panel, dentro de UNA tarjeta. */
function Multiplos({
  paneles,
  omitidos,
  instance,
  presentacion,
  tipo,
  titulo,
  formatear,
  seriesDeColumna,
  dimension,
  columnas,
  onFiltrar,
}: {
  paneles: PanelDeMultiplo[];
  /** Cuantos valores de la dimension no caben en el limite. Se dicen; no se ocultan. */
  omitidos: number;
  instance: ObjectInstance;
  presentacion: PresentacionDeObjeto | undefined;
  tipo: TipoDeGrafico;
  titulo: string;
  formatear: (valor: number, serie: number) => string;
  seriesDeColumna?: number;
  dimension?: string;
  columnas: number;
  /** Filtrar desde un panel filtra por la CATEGORIA DEL EJE, no por el valor del panel. */
  onFiltrar?: (campo: string, valor: string) => void;
}) {
  return (
    <div
      className="multiplos"
      data-testid="multiplos"
      style={{ '--multiplos-columnas': columnas } as React.CSSProperties}
    >
      {paneles.map((panel, i) => (
        <section key={panel.titulo} className="multiplos__panel">
          {/*
            El rotulo de cada panel es un encabezado de verdad, no un texto suelto.
            Es lo unico que dice de que valor es cada grafico, y con lector de pantalla la lista de
            encabezados es como se recorre una tarjeta con seis graficos dentro.
          */}
          <h4 className="multiplos__titulo">{panel.titulo}</h4>
          <Grafico
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
            {...(seriesDeColumna === undefined ? {} : { seriesDeColumna })}
            {...(dimension ? { dimension } : {})}
            {...(dimension && onFiltrar
              ? { onSeleccionar: (categoria: string) => onFiltrar(dimension, categoria) }
              : {})}
          >
            {/* El nombre lleva el del PANEL: con el del objeto, los seis respaldos de una
                tarjeta de multiplos se anunciarian con el mismo rotulo y no habria forma de
                saber cual se esta leyendo. */}
            <TablaDeRespaldo nombre={`${titulo} — ${panel.titulo}`}>
              <table className="tabla">
                <thead>
                  <tr>
                    <th scope="col">{panel.titulo}</th>
                    {panel.vm.series.map((serie) => (
                      <th key={serie} scope="col" className="es-numero">
                        {serie}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {panel.vm.points.map((punto) => (
                    <tr key={punto.label}>
                      <CeldaDeCategoria
                        etiqueta={punto.label}
                        {...(dimension ? { campo: dimension } : {})}
                        {...(onFiltrar ? { onFiltrar } : {})}
                      />
                      {panel.vm.series.map((serie, sIdx) => (
                        <td key={serie} className="es-numero">
                          {formatearNumero(punto.values[sIdx] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaDeRespaldo>
          </Grafico>
        </section>
      ))}

      {/*
        Lo que no cabe se DICE.
        Recortar en silencio deja a quien mira creyendo que la dimension tiene doce valores, que
        es la misma clase de mentira que 4.2 cierra al obligar a marcar un objeto roto en vez de
        omitirlo. Ocupa su propia celda de la rejilla para no robarle alto a ningun panel.
      */}
      {omitidos > 0 ? (
        <p className="multiplos__omitidos" data-testid="multiplos-omitidos">
          {omitidos === 1
            ? 'Hay 1 valor mas que no cabe. Ordene la dimension para ver otros.'
            : `Hay ${omitidos} valores mas que no caben. Ordene la dimension para ver otros.`}
        </p>
      ) : null}
    </div>
  );
}

/** La presentacion con la que se dibuja CADA panel. */
function presentacionDePanel(
  presentacion: PresentacionDeObjeto | undefined,
  paneles: PanelDeMultiplo[],
): PresentacionDeObjeto | undefined {
  if (presentacion?.multiplos?.mismaEscala === false) return presentacion;
  const maximo = maximoComun(paneles);
  if (maximo === undefined || presentacion?.ejes?.maximoY !== undefined) return presentacion;
  /*
   * El maximo se REDONDEA hacia arriba a un numero de escala.
   */
  return { ...presentacion, ejes: { ...presentacion?.ejes, maximoY: escalaBonita(maximo) } };
}

/** La celda de categoria del respaldo, que ademas FILTRA. */
function CeldaDeCategoria({
  etiqueta,
  valor,
  campo,
  onFiltrar,
}: {
  etiqueta: string;
  /** Lo que se manda al filtro, cuando no es lo mismo que se lee. */
  valor?: string;
  /** La dimension por la que se filtra. Sin ella el objeto no tiene por que ofrecer el gesto. */
  campo?: string;
  onFiltrar?: (campo: string, valor: string) => void;
}) {
  const aFiltrar = valor ?? etiqueta;
  if (!campo || !onFiltrar) return <th scope="row">{etiqueta}</th>;
  return (
    <th scope="row">
      <button
        type="button"
        className="boton-enlace"
        data-testid={`filtrar-${aFiltrar}`}
        title={`Filtrar por ${aFiltrar}`}
        onClick={() => onFiltrar(campo, aFiltrar)}
      >
        {etiqueta}
      </button>
    </th>
  );
}

/** El contenedor del respaldo accesible de un objeto. */
function TablaDeRespaldo({ nombre, children }: { nombre: string; children: React.ReactNode }) {
  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={nombre}>
      {children}
    </div>
  );
}

/** Combinado de columnas y lineas. */
export function Combinado({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  onFiltrar,
  iconoDelObjeto,
}: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  const ejeX = r ? r.uno('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const deColumnas = r ? r.varios('columnas') : instance.binding.measures.slice(0, 1);
  const deLineas = r ? r.varios('lineas') : instance.binding.measures.slice(1);
  const medidas = [...deColumnas, ...deLineas];

  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  const vm = ordenarCategorias(
    toCategorical(
      result,
      dimension ? [dimension] : [],
      medidas,
      agregacionesPara(medidas, instance.binding.measures, agregaciones),
    ),
    instance.presentacion?.orden,
  );

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
        instanceId={instance.instanceId}
        tipo="combinado"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        seriesDeColumna={deColumnas.length}
        formatear={(valor, serie) =>
          formateadorDeMedida(instance.presentacion, medidas[serie] ?? '')(valor)
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
        <TablaDeRespaldo nombre={titulo}>
          <table className="tabla" data-testid="combinado">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                {vm.series.map((serie, s) => (
                  <th key={serie} scope="col" className="es-numero">
                    {serie} ({s < deColumnas.length ? 'columna' : 'linea'})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto) => (
                <tr key={punto.label}>
                  <CeldaDeCategoria
                    etiqueta={punto.label}
                    {...(dimension ? { campo: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="es-numero">
                      {formateadorDeMedida(instance.presentacion, serie)(punto.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
    </Marco>
  );
}

/** Dispersion — dos medidas enfrentadas, un punto por categoria. */
export function Dispersion({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  onFiltrar,
  iconoDelObjeto,
}: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  const punto = r ? r.uno('punto') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r
    ? [r.uno('eje-x'), r.uno('eje-y'), r.uno('tamano')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;

  const dimension = punto ? aFieldRef(punto) : undefined;
  const vm = toCategorical(
    result,
    dimension ? [dimension] : [],
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
        instanceId={instance.instanceId}
        tipo="dispersion"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor, serie) =>
          formateadorDeMedida(instance.presentacion, medidas[serie] ?? '')(valor)
        }
        {...(dimension ? { dimension: fieldKey(dimension) } : {})}
        {...(dimension && onFiltrar
          ? { onSeleccionar: (c: string) => onFiltrar(fieldKey(dimension), c) }
          : {})}
      >
        <TablaDeRespaldo nombre={titulo}>
          <table className="tabla" data-testid="dispersion">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Punto'}</th>
                {vm.series.map((serie) => (
                  <th key={serie} scope="col" className="es-numero">
                    {serie}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vm.points.map((p) => (
                <tr key={p.label}>
                  <CeldaDeCategoria
                    etiqueta={p.label}
                    {...(dimension ? { campo: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  {vm.series.map((serie, s) => (
                    <td key={serie} className="es-numero">
                      {formateadorDeMedida(instance.presentacion, serie)(p.values[s] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
    </Marco>
  );
}

/** Embudo y cascada comparten la misma forma de datos: una dimension y una medida. */
function UnaDimensionUnaMedida({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  onFiltrar,
  iconoDelObjeto,
  tipo,
  ranuraDeDimension,
  columnaExtra,
}: ObjetoProps & {
  tipo: 'embudo' | 'cascada';
  ranuraDeDimension: string;
  columnaExtra: { encabezado: string; celda: (valores: number[], i: number) => string };
}) {
  const r = porRanura(instance, ranuras);
  const dim = r ? r.uno(ranuraDeDimension) : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;
  const dimension = dim ? aFieldRef(dim) : undefined;

  const vm = ordenarCategorias(
    toCategorical(
      result,
      dimension ? [dimension] : [],
      medidas,
      agregacionesPara(medidas, instance.binding.measures, agregaciones),
    ),
    // El embudo NO admite `orden` en su presentacion; llega siempre `undefined` y el orden es el
    // del dataset, que es el del proceso. La cascada si lo admite.
    instance.presentacion?.orden,
  );
  const formatear = formateadorDeMedida(instance.presentacion, medidas[0] ?? '');
  const valores = vm.points.map((p) => p.values[0] ?? 0);

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
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
        <TablaDeRespaldo nombre={titulo}>
          <table className="tabla" data-testid={tipo}>
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                <th scope="col" className="es-numero">
                  {medidas[0] ?? 'Valor'}
                </th>
                <th scope="col" className="es-numero">
                  {columnaExtra.encabezado}
                </th>
              </tr>
            </thead>
            <tbody>
              {vm.points.map((punto, i) => (
                <tr key={punto.label}>
                  <CeldaDeCategoria
                    etiqueta={punto.label}
                    {...(dimension ? { campo: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="es-numero">{formatear(punto.values[0] ?? null)}</td>
                  <td className="es-numero">{columnaExtra.celda(valores, i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
    </Marco>
  );
}

export function Embudo(props: ObjetoProps) {
  const comparar = props.instance.presentacion?.embudo?.comparar ?? 'primero';
  return (
    <UnaDimensionUnaMedida
      {...props}
      tipo="embudo"
      ranuraDeDimension="etapa"
      columnaExtra={{
        encabezado: comparar === 'anterior' ? 'De la anterior' : 'De la primera',
        celda: (valores, i) => {
          const base = comparar === 'anterior' ? (valores[i - 1] ?? valores[i]) : valores[0];
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

export function Cascada(props: ObjetoProps) {
  return (
    <UnaDimensionUnaMedida
      {...props}
      tipo="cascada"
      ranuraDeDimension="categoria"
      columnaExtra={{
        // El acumulado es lo que la cascada DIBUJA: sin esta columna, el respaldo seria una lista
        // de contribuciones y la altura de cada barra —que es el acumulado— se perderia.
        encabezado: 'Acumulado',
        celda: (valores, i) => {
          const hasta = valores.slice(0, i + 1).reduce((suma, v) => suma + v, 0);
          return String(hasta);
        },
      }}
    />
  );
}

/** Mapa de arbol — una o dos dimensiones, una medida. */
export function MapaDeArbol({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  onFiltrar,
  iconoDelObjeto,
}: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  const grupo = r ? r.uno('grupo') : fieldKeyDe(instance.binding.dimensions[0]);
  const detalle = r ? r.uno('detalle') : fieldKeyDe(instance.binding.dimensions[1]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;

  const dimensiones = [grupo, detalle].filter((c): c is string => c !== undefined).map(aFieldRef);
  const vm = toCategorical(
    result,
    dimensiones,
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );
  const formatear = formateadorDeMedida(instance.presentacion, medidas[0] ?? '');
  const principal = dimensiones[0];

  /*
   * El nombre que ECharts entrega al pulsar, convertido en un valor de la PRIMERA dimension.
   */
  const grupoDe = (nodo: string): string => {
    const conEseNombre = vm.points.find((p) => p.label === nodo || p.label.endsWith(` / ${nodo}`));
    return conEseNombre?.label.split(' / ')[0] ?? nodo;
  };

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
        instanceId={instance.instanceId}
        tipo="mapa-de-arbol"
        vm={vm}
        titulo={titulo}
        presentacion={instance.presentacion}
        formatear={(valor) => formatear(valor)}
        {...(principal ? { dimension: fieldKey(principal) } : {})}
        {...(principal && onFiltrar
          ? { onSeleccionar: (nodo: string) => onFiltrar(fieldKey(principal), grupoDe(nodo)) }
          : {})}
      >
        <TablaDeRespaldo nombre={titulo}>
          <table className="tabla" data-testid="mapa-de-arbol">
            <thead>
              <tr>
                <th scope="col">{principal ? fieldKey(principal) : 'Grupo'}</th>
                <th scope="col" className="es-numero">
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
                  <CeldaDeCategoria
                    etiqueta={punto.label}
                    valor={punto.label.split(' / ')[0] ?? punto.label}
                    {...(principal ? { campo: fieldKey(principal) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="es-numero">{formatear(punto.values[0] ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
    </Marco>
  );
}

/** Circular — pastel y dona. */
export function Circular({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  onFiltrar,
  iconoDelObjeto,
  hueco,
}: ObjetoProps & { hueco?: number }) {
  const r = porRanura(instance, ranuras);
  const categoria = r ? r.uno('categoria') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('valor') : instance.binding.measures;
  const dimension = categoria ? aFieldRef(categoria) : undefined;

  const vm = toCategorical(
    result,
    dimension ? [dimension] : [],
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );
  const formatear = formateadorDeMedida(instance.presentacion, medidas[0] ?? '');

  /*
   * El hueco por defecto del objeto, que la presentacion anula.
   */
  const circular = {
    ...(hueco === undefined ? {} : { radioInterior: hueco }),
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
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
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
        <TablaDeRespaldo nombre={titulo}>
          <table className="tabla" data-testid="circular">
            <thead>
              <tr>
                <th scope="col">{dimension ? fieldKey(dimension) : 'Categoria'}</th>
                <th scope="col" className="es-numero">
                  {medidas[0] ?? 'Valor'}
                </th>
                <th scope="col" className="es-numero">
                  Parte
                </th>
              </tr>
            </thead>
            <tbody>
              {valores.map((punto) => (
                <tr key={punto.label}>
                  <CeldaDeCategoria
                    etiqueta={punto.label}
                    {...(dimension ? { campo: fieldKey(dimension) } : {})}
                    {...(onFiltrar ? { onFiltrar } : {})}
                  />
                  <td className="es-numero">{formatear(punto.valor)}</td>
                  <td className="es-numero">
                    {total === 0 ? '—' : `${((punto.valor / total) * 100).toFixed(1)} %`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeRespaldo>
      </Grafico>
    </Marco>
  );
}

/** La dona es el circular con hueco. Nada mas: mismo contrato, mismo dibujo, mismo respaldo. */
export function Dona(props: ObjetoProps) {
  return <Circular {...props} hueco={HUECO_DE_DONA} />;
}

/** Medidor — una cifra contra su meta. */
export function Medidor({
  titulo,
  result,
  instance,
  ranuras,
  agregaciones,
  iconoDelObjeto,
}: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  const medidas = r
    ? [r.uno('valor'), r.uno('objetivo')].filter((m): m is string => m !== undefined)
    : instance.binding.measures;

  const vm = toCategorical(
    result,
    [],
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );
  const formatear = formateadorDeMedida(instance.presentacion, medidas[0] ?? '');
  const punto = vm.points[0];
  const valor = punto?.values[0] ?? null;
  const objetivo = punto?.values[1] ?? instance.presentacion?.medidor?.objetivo ?? null;
  const escala = escalaDelMedidor(instance.presentacion?.medidor, valor, objetivo);

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <Grafico
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
        <dl className="medidor-respaldo" data-testid="medidor">
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
              {formatear(escala.minimo)} – {formatear(escala.maximo)}
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
      </Grafico>
    </Marco>
  );
}

export function Tabla({ titulo, result, instance, agregaciones, iconoDelObjeto }: ObjetoProps) {
  // La tabla dibuja SU proyeccion, no el dataset en crudo.
  //
  // Antes pintaba todas las columnas del dataset, incluidas las que su mapeo no declara, y las
  // filas sin agregar: un mapeo de dos dimensiones sobre un dataset con tres mostraba la tercera
  // y repetia cada combinacion. Es la misma funcion que usan la exportacion y el complemento de
  // tabla de datos, asi que lo que se ve y lo que se exporta no pueden separarse.
  const proyectado = proyectarObjeto(instance, result, agregaciones);

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      {/*
        Una tabla tiene varias medidas y cada una con su formato: el formateador se elige POR
        COLUMNA, no uno para toda la tabla. Es el caso que la forma anterior del formato no podia
        cubrir — casos y dias de resolucion salian iguales porque el formato era del objeto.
      */}
      <TablaOrdenable
        proyectado={proyectado}
        titulo={titulo}
        formatearColumna={(nombre) => formateadorDeMedida(instance.presentacion, nombre)}
        {...(instance.presentacion?.condicional
          ? { condicional: instance.presentacion.condicional }
          : {})}
      />
    </Marco>
  );
}

export function Matriz({ titulo, result, instance, ranuras, agregaciones, iconoDelObjeto }: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  // Varios niveles por pozo: es lo que convierte el cruce plano en una jerarquia.
  const dimsFila = (r ? r.varios('filas') : instance.binding.dimensions.slice(0, 1).map(fieldKey))
    .map(aFieldRef);
  const dimsColumna = (
    r ? r.varios('columnas') : instance.binding.dimensions.slice(1, 2).map(fieldKey)
  ).map(aFieldRef);
  const medidas = r ? r.varios('valores') : instance.binding.measures;

  const vm = construirMatriz(
    result,
    dimsFila,
    dimsColumna,
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );

  return (
    <Marco
      titulo={titulo}
      instance={instance}
      result={result}
      agregaciones={agregaciones}
      iconoDelObjeto={iconoDelObjeto}
    >
      <TablaDeMatriz vm={vm} titulo={titulo} instance={instance} />
    </Marco>
  );
}

export interface ObjetoProps {
  titulo: string;
  result: QueryResult;
  instance: ObjectInstance;
  /** Con que operador se resume cada medida, alineado con `instance.binding.measures`. */
  agregaciones: Agregacion[];
  /** Las ranuras que declara la version del objeto. */
  ranuras?: RanuraDeCampos[];
  /** Filtrado cruzado (4.4): anade un filtro a la query string, no a un estado paralelo. */
  onFiltrar?: (campo: string, valor: string) => void;
  /** El icono que declara la version del objeto en el catalogo. */
  iconoDelObjeto?: NombreDeIcono;
}

/** `FieldRef` -> 'Tabla.Campo', tolerando que no haya campo. */
const fieldKeyDe = (ref: { table: string; field: string } | undefined): string | undefined =>
  ref ? fieldKey(ref) : undefined;

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
