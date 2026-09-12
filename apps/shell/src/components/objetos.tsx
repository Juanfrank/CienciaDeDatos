import type { Agregacion, QueryResult } from '@app/data-contracts';
import {
  type BindingProblem,
  type NombreDeIcono,
  type RanuraDeCampos,
  aFieldRef,
  agregacionesPara,
  campoDeRanura,
  estiloDeTexto,
  fieldKey,
  ranurasDe,
  formateadorDe,
  proyectarObjeto,
  construirMatriz,
  toCategorical,
  toKpi,
  toSlicerOptions,
} from '@app/ui-components';
import type { ObjectInstance } from '@app/ui-components';
import { Complementos } from './Complementos';
import { TablaDeMatriz } from './TablaDeMatriz';
import { TablaOrdenable } from './TablaOrdenable';
import { Grafico } from './Grafico';
import { Segmentador } from './Segmentador';
import { Icono } from './iconos/Icono';

/**
 * Objetos prediseñados — seccion 4.2.
 *
 * Envoltorios DELGADOS sobre los view-model puros, que son los que estan probados. Cada objeto
 * recibe filas ya leidas del cache y ya filtradas por el ambito de quien mira: ninguno conoce
 * la fuente, la consulta ni el conector activo.
 */

/**
 * El formato por defecto, para lo que no es una cifra de la instancia.
 *
 * Las cifras que el objeto MUESTRA salen de `formateadorDe(instance.presentacion?.formato)`, para
 * que la tarjeta, la etiqueta del grafico, la tabla y el archivo exportado no puedan divergir.
 * Este se queda para los rotulos que no pertenecen a ninguna instancia.
 */
/** Numero para pantalla. `null` es «no hay respuesta» y se dibuja como raya, no como cero. */
const formatearNumero = (n: number | null): string =>
  n === null ? '—' : new Intl.NumberFormat('es-DO').format(Math.round(n));

/**
 * Los campos de un objeto, LEIDOS POR RANURA.
 *
 * Antes se leia por posicion —`dimensions[0]` era el eje— y eso hacia imposible dejar el eje X
 * vacio con la serie llena: el unico campo del array habria pasado por eje. Preguntando por la
 * ranura, un eje vacio es un eje vacio y el objeto se marca roto en vez de dibujar otra cosa.
 *
 * Las ranuras llegan como prop desde el registro porque este componente no lo consulta: recibe una
 * instancia ya resuelta. `undefined` significa «este objeto no declara ranuras», y entonces se cae
 * al orden de siempre.
 */
function porRanura(instance: ObjectInstance, ranuras: RanuraDeCampos[] | undefined) {
  if (!ranuras || ranuras.length === 0) return null;
  return {
    uno: (id: string) => campoDeRanura(instance, ranuras, id),
    varios: (id: string) => ranurasDe(instance, ranuras).get(id) ?? [],
  };
}

/** Icono por defecto de cada tipo, cuando la instancia no elige otro. */
const ICONO_POR_TIPO: Record<string, NombreDeIcono> = {
  'tarjeta-kpi': 'indicador',
  barras: 'barras',
  lineas: 'lineas',
  tabla: 'tabla',
  matriz: 'tabla',
  segmentador: 'filtro',
  'panel-de-filtros': 'filtro',
};

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
/*
 * Se EXPORTA.
 *
 * El segmentador y el panel de filtros se dibujaban su propia cabecera a mano, asi que quedaban
 * fuera de todo lo que el marco hace: sin icono, sin acento, sin resaltado y sin subtitulo. El
 * estandar minimo solo es cierto si no hay forma de dibujar un objeto sin pasar por aqui.
 */
export function Marco({
  titulo,
  children,
  pie,
  accion,
  instance,
  result,
  agregaciones,
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
}) {
  /*
   * La presentacion se dibuja AQUI, en el marco comun, y no en cada objeto.
   *
   * Es el mismo motivo por el que los complementos viven aqui: asi un objeto nuevo hereda icono,
   * acento, resaltado y subtitulo por el hecho de existir, y no hay forma de anadir uno que se
   * los deje sin querer. Es lo que hace que el minimo del contrato sea cierto en pantalla y no
   * solo en el tipo.
   */
  const presentacion = instance?.presentacion;
  const icono = presentacion?.icono ?? (instance ? ICONO_POR_TIPO[instance.objectId] : undefined);
  const acento = presentacion?.acento ?? 'primario';

  return (
    <div
      className="objeto"
      data-acento={acento}
      data-resaltado={presentacion?.resaltado ? 'si' : undefined}
    >
      <div className="objeto__cabecera">
        {icono ? (
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
      <div className="objeto__cuerpo">{children}</div>
      {pie ? <div className="objeto__pie">{pie}</div> : null}
    </div>
  );
}

export function TarjetaKpi({ titulo, result, instance, ranuras, agregaciones }: ObjetoProps) {
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
  const formatear = formateadorDe(instance.presentacion?.formato);

  return (
    <Marco titulo={titulo} instance={instance} result={result} agregaciones={agregaciones}>
      <p
        className="kpi__valor"
        data-testid="kpi-valor"
        style={estiloDeTexto(instance.presentacion?.textos?.cifra)}
      >
        {formatear(kpi.value)}
      </p>
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

export function Barras({ titulo, result, instance, onFiltrar, ranuras, agregaciones }: ObjetoProps) {
  /*
   * El eje X sale de SU ranura, no de la primera dimension.
   *
   * `toCategorical` sigue recibiendo arrays ordenados —eje primero, serie despues— porque asi es
   * como agrega. Lo que cambia es quien decide ese orden: la ranura, no el orden en que alguien
   * mapeo los campos.
   */
  const r = porRanura(instance, ranuras);
  const ejeX = r ? r.uno('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const serie = r ? r.uno('serie') : fieldKeyDe(instance.binding.dimensions[1]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  const dimensiones = [ejeX, serie].filter((c): c is string => c !== undefined).map(aFieldRef);
  const vm = toCategorical(
    result,
    dimensiones,
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );
  // Los huecos no entran en el maximo: `Math.max` con un null lo convierte en 0, y con todos los
  // valores en hueco daria 0 y todas las barras a escala completa.
  const maximo = Math.max(
    1,
    ...vm.points.flatMap((p) => p.values.filter((v): v is number => v !== null)),
  );
  const dimension = ejeX ? aFieldRef(ejeX) : undefined;

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

export function Lineas({ titulo, result, instance, ranuras, agregaciones }: ObjetoProps) {
  const r = porRanura(instance, ranuras);
  const ejeX = r ? r.uno('eje-x') : fieldKeyDe(instance.binding.dimensions[0]);
  const medidas = r ? r.varios('eje-y') : instance.binding.measures;

  const dimension = ejeX ? aFieldRef(ejeX) : undefined;
  const vm = toCategorical(
    result,
    dimension ? [dimension] : [],
    medidas,
    agregacionesPara(medidas, instance.binding.measures, agregaciones),
  );

  return (
    <Marco titulo={titulo} instance={instance} result={result} agregaciones={agregaciones}>
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
                      {formatearNumero(punto.values[s] ?? null)}
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

export function Tabla({ titulo, result, instance, agregaciones }: ObjetoProps) {
  // La tabla dibuja SU proyeccion, no el dataset en crudo.
  //
  // Antes pintaba todas las columnas del dataset, incluidas las que su mapeo no declara, y las
  // filas sin agregar: un mapeo de dos dimensiones sobre un dataset con tres mostraba la tercera
  // y repetia cada combinacion. Es la misma funcion que usan la exportacion y el complemento de
  // tabla de datos, asi que lo que se ve y lo que se exporta no pueden separarse.
  const proyectado = proyectarObjeto(instance, result, agregaciones);

  return (
    <Marco titulo={titulo} instance={instance} result={result} agregaciones={agregaciones}>
      <TablaOrdenable
        proyectado={proyectado}
        titulo={titulo}
        formatear={formateadorDe(instance.presentacion?.formato)}
      />
    </Marco>
  );
}

export function Matriz({ titulo, result, instance, ranuras, agregaciones }: ObjetoProps) {
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
    <Marco titulo={titulo} instance={instance} result={result} agregaciones={agregaciones}>
      <TablaDeMatriz vm={vm} titulo={titulo} instance={instance} />
    </Marco>
  );
}

export interface ObjetoProps {
  titulo: string;
  result: QueryResult;
  instance: ObjectInstance;
  /**
   * Con que operador se resume cada medida, alineado con `instance.binding.measures`.
   *
   * Llega resuelto del servidor, que es quien tiene el esquema. Los objetos consumen sus medidas
   * por ranura y no por orden, asi que aqui se reordena con `agregacionesPara` en vez de indexar.
   */
  agregaciones: Agregacion[];
  /**
   * Las ranuras que declara la version del objeto.
   *
   * Llegan como dato desde el servidor, que es quien tiene el registro. Un objeto que no las
   * declare recibe `undefined` y se dibuja leyendo por orden, como siempre.
   */
  ranuras?: RanuraDeCampos[];
  /** Filtrado cruzado (4.4): anade un filtro a la query string, no a un estado paralelo. */
  onFiltrar?: (campo: string, valor: string) => void;
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
