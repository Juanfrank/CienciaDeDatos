'use client';

import { useEffect, useState } from 'react';
import type { Aggregation } from '@app/data-contracts';
import { GRID_COLUMNS, type GridItem } from '@app/module-model';
import {
  DEFAULT_AGGREGATION,
  agregacionesPosibles,
  cabeEnRanura,
  fieldKey,
  withSlotField,
  slotsOf,
  defaultSlots,
  slotFieldWithout,
  type AttachedObjectInstance,
  type ObjectInstance,
  type FieldSlot,
} from '@app/ui-components';
import {
  type ObjectFamily,
  type ObjectCategory,
  isContainer,
  isElement,
} from '@app/ui-components';
import type { DatasetDePaleta, PaletteObject } from '../../server/editor';
import { Icono } from '../iconos/Icono';
import { ConfiguracionDeObjetoEditor } from './ConfiguracionDeObjetoEditor';
import { Pestanas, type DefinicionDePestana } from './Pestanas';
import { Pozo } from './Pozo';
import { Presentacion } from './Presentacion';
import type { MessageKey } from '@app/i18n';
import { useTraductor } from '../Idioma';
import { ProveedorDeFiltro, Section } from './Seccion';

/** El panel del editor: la tienda y el banco de trabajo, en uno. */

type Pestana = 'objetos' | 'datos' | 'formato' | 'complementos';

export function PanelLateral({
  objetos,
  datasets,
  seleccionado,
  guardando,
  onAnadir,
  onCambiar,
  onQuitar,
}: {
  objetos: PaletteObject[];
  datasets: DatasetDePaleta[];
  seleccionado: GridItem | null;
  guardando: boolean;
  onAnadir: (objectId: string) => void;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const t = useTraductor();
  const [pestana, setPestana] = useState<Pestana>('objetos');
  const [filtro, setFiltro] = useState('');

  /*
   * Al elegir un objeto, el panel salta a «Datos».
   */
  const idSeleccionado = seleccionado?.id ?? null;
  const objetoSeleccionado = seleccionado?.instance.objectId ?? null;
  useEffect(() => {
    if (!idSeleccionado) {
      setPestana('objetos');
      return;
    }
    // Lo que no lee datos salta a «Formato»: es su primera pestana util, y mandarlo a una
    // deshabilitada dejaria el panel en blanco justo despues de colocar algo.
    const sinDatos = objetoSeleccionado !== null && (isElement(objetoSeleccionado) || isContainer(objetoSeleccionado));
    setPestana(sinDatos ? 'formato' : 'datos');
  }, [idSeleccionado, objetoSeleccionado]);

  const hayObjeto = seleccionado !== null;
  const definicion = seleccionado
    ? objetos.find((o) => o.objectId === seleccionado.instance.objectId)
    : undefined;
  const dataset = seleccionado
    ? datasets.find((d) => d.datasetId === seleccionado.instance.binding.datasetId)
    : undefined;

  /*
   * «Datos» se deshabilita para lo que no consume datos.
   */
  const consumeDatos = (definicion?.dimensiones.max ?? 0) > 0 || (definicion?.medidas.max ?? 0) > 0;

  const PESTANAS: DefinicionDePestana<Pestana>[] = [
    { id: 'objetos', etiqueta: t('editor.pestana.objetos'), icono: 'barras', habilitada: true },
    {
      id: 'datos',
      etiqueta: t('editor.pestana.datos'),
      icono: 'tabla',
      habilitada: hayObjeto && consumeDatos,
    },
    { id: 'formato', etiqueta: t('editor.pestana.formato'), icono: 'indicador', habilitada: hayObjeto },
    {
      id: 'complementos',
      etiqueta: t('editor.pestana.complementos'),
      icono: 'informacion',
      habilitada: hayObjeto,
    },
  ];

  return (
    <aside className="panel-editor" data-testid="panel-editor">
      <Pestanas tabs={PESTANAS} activa={pestana} onElegir={setPestana} />

      <div
        className="panel-editor__cuerpo"
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
        tabIndex={0}
      >
        {pestana === 'objetos' ? (
          <Tienda objetos={objetos} guardando={guardando} onAnadir={onAnadir} />
        ) : null}

        {pestana === 'datos' && seleccionado ? (
          <Datos
            item={seleccionado}
            definicion={definicion}
            datasets={datasets}
            guardando={guardando}
            onCambiar={onCambiar}
            onQuitar={onQuitar}
          />
        ) : null}

        {pestana === 'formato' && seleccionado ? (
          <div className="editor__formato">
            {/*
              El buscador, PRIMERO y para la pestana ENTERA.

              La pestana llego a dieciocho secciones, y con esa cantidad la pregunta deja de ser
              «que opciones hay» y pasa a ser «donde esta la que quiero». Plegar no lo resuelve:
              plegado, encontrar algo obliga a abrir y cerrar una por una.

              Cubre las tres piezas de la pestana —la configuracion del objeto, la presentacion y
              el tamano— y no solo la del medio. Un buscador que dejara una seccion fuera seria
              peor que no tenerlo: quien no la encuentra concluye que no existe.

              No se guarda: el filtro es un gesto de un momento, no una preferencia.
            */}
            <label className="editor__buscador">
              <span className="editor__buscador-rotulo">Buscar un ajuste</span>
              <input
                type="search"
                value={filtro}
                placeholder="meta, decimales, leyenda…"
                data-testid="buscar-ajuste"
                onChange={(e) => setFiltro(e.target.value)}
              />
            </label>

            <ProveedorDeFiltro filtro={filtro}>
            {/* `Presentacion` ya trae sus propias subsecciones: envolverlo en otra repetiria el
                rotulo «Presentacion» dos veces seguidas. */}
            <ConfiguracionDeObjetoEditor
              instance={seleccionado.instance}
              guardando={guardando}
              onCambiar={(cambio) =>
                onCambiar(seleccionado.id, (i) => ({ ...i, instance: cambio(i.instance) }))
              }
            />

            <Presentacion
              instance={seleccionado.instance}
              admitidas={definicion?.presentacion ?? []}
              kinds={dataset?.kinds ?? {}}
              guardando={guardando}
              onCambiar={(cambio) =>
                onCambiar(seleccionado.id, (i) => ({ ...i, instance: cambio(i.instance) }))
              }
            />

            {/*
              El tamano y la posicion viven aqui, no en «Datos».
              Cuanto ocupa un objeto en la rejilla no cambia lo que mide: es como se ve.
            */}
            {/*
              Abierta por defecto: redimensionar es lo que mas se hace en esta pestana, y llegar a
              ella para encontrarse un titulo plegado anade un clic a cada ajuste.
            */}
            <Section
              titulo="Tamano y posicion"
              keys={['ancho', 'alto', 'columnas', 'filas', 'mover', 'rejilla', 'redimensionar']}
              prueba={`seccion-tamano-${seleccionado.id}`}
            >
              <Tamano item={seleccionado} guardando={guardando} onCambiar={onCambiar} />
            </Section>
            </ProveedorDeFiltro>

            {/*
              Una busqueda sin resultados no puede dejar la pestana en blanco.
              Vacia se lee como «este objeto no tiene ajustes», que es falso, y ademas no da la
              salida. QUIEN decide si se ve es el CSS, con `:has()`: preguntarlo aqui obligaria a
              repetir la lista de que secciones admite cada objeto, y dos listas que hay que
              mantener iguales acaban desincronizandose.
            */}
            {filtro.trim() !== '' ? (
              <div className="editor__vacio" data-testid="sin-resultados">
                <p>Nada coincide con «{filtro.trim()}».</p>
                <button
                  type="button"
                  className="md-boton md-boton--texto"
                  data-testid="limpiar-busqueda"
                  onClick={() => setFiltro('')}
                >
                  Ver todos los ajustes
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {pestana === 'complementos' && seleccionado ? (
          <Complementos
            item={seleccionado}
            objetos={objetos}
            guardando={guardando}
            onCambiar={onCambiar}
          />
        ) : null}
      </div>
    </aside>
  );
}

/** La tienda: la unica puerta por la que entra un objeto al modulo. */
/** Que pregunta responde cada familia, dicho en una linea. */
/**
 * Las familias de la paleta, en el orden en que se ofrecen.
 *
 * El rotulo sale del catalogo de mensajes —`familia.<id>`— y la linea que lo explica se queda
 * aqui hasta que se traduzca tambien. Que el orden viva en un array y no en el catalogo es
 * deliberado: es una decision de producto, no una cadena.
 */
const FAMILIAS: { family: ObjectFamily; que: string }[] = [
  { family: 'valor', que: 'El dato que hay que ver de un vistazo.' },
  { family: 'comparacion', que: 'Cuanto mide cada distrito, cada materia, cada tribunal.' },
  { family: 'evolucion', que: 'La trayectoria de una medida a lo largo de una dimension ordenada.' },
  { family: 'proporcion', que: 'Que parte aporta cada categoria, y donde se pierde.' },
  { family: 'relacion', que: 'Si dos cifras se mueven juntas, o cada una en su escala.' },
  { family: 'detalle', que: 'Cuando hace falta la cifra exacta.' },
  { family: 'ubicacion', que: 'La dimension geografica.' },
  { family: 'control', que: 'No dibujan datos: eligen cuales se ven.' },
];

/** Sin acentos y en minusculas, como el buscador del panel de formato y por lo mismo. */
const normalizar = (content: string): string =>
  content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function Tienda({
  objetos,
  guardando,
  onAnadir,
}: {
  objetos: PaletteObject[];
  guardando: boolean;
  onAnadir: (objectId: string) => void;
}) {
  const t = useTraductor();
  // Los complementos se adjuntan a otro objeto, no se colocan en la rejilla. La validacion lo
  // rechaza, asi que tampoco se ofrecen aqui: tienen su propia pestana.
  const colocables = objetos.filter((o) => !o.attachable);
  const [busqueda, setBusqueda] = useState('');

  /*
   * Se busca por nombre Y por descripcion.
   */
  const filtro = normalizar(busqueda.trim());
  const coincide = (o: PaletteObject) =>
    filtro === '' ||
    normalizar(o.name).includes(filtro) ||
    normalizar(o.description).includes(filtro);

  const visibles = colocables.filter(coincide);
  const de = (...categorias: ObjectCategory[]) =>
    visibles.filter((o) => categorias.includes(o.category));
  const withData = de('grafico', 'tabla', 'indicador', 'filtro', 'mapa');

  return (
    <>
      <label className="editor__buscador">
        <span className="editor__buscador-rotulo">{t('editor.buscarObjeto')}</span>
        <input
          type="search"
          value={busqueda}
          placeholder="barras, meta, etapas…"
          data-testid="buscar-objeto"
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </label>

      {visibles.length === 0 ? (
        <div className="editor__vacio editor__vacio--visible" data-testid="sin-objetos">
          <p>{t('editor.sinObjetos', { consulta: busqueda.trim() })}</p>
          <button
            type="button"
            className="md-boton md-boton--texto"
            data-testid="limpiar-busqueda-objeto"
            onClick={() => setBusqueda('')}
          >
            Ver todos los objetos
          </button>
        </div>
      ) : null}

      {withData.length > 0 ? (
        <Section titulo="Visualizaciones" prueba="seccion-visualizaciones">
          <p className="texto-atenuado panel-editor__nota">
            Se enlazan a un dataset certificado del registro. Un modulo no construye consultas (4.2).
          </p>

          {/*
            Agrupadas por la PREGUNTA que responden, no por tipo.
            Quince visualizaciones en una lista plana convierten elegir un objeto en recordar su
            nombre: «Grafico de columnas» y «Grafico de barras» solo se distinguen por el icono.
            Por pregunta se elige por lo que se quiere contar, que es como llega la necesidad.
          */}
          {/*
            Cada familia es una seccion COLAPSABLE, el mismo `<details>` del resto del panel.
            Ocho familias abiertas son una lista larga en un carril de 340 px; plegar las que no
            interesan deja a la vista las que si, sin que nada desaparezca por defecto — que el
            catalogo sea cerrado es justo el motivo por el que hay que poder verlo entero.

            El filtro del buscador se les pasa por el MISMO contexto que usa la pestana de
            Formato, y va aqui dentro y no envolviendo la tienda entera: fuera, «Visualizaciones»
            y «Elementos» desapareceran al buscar «barras», porque sus titulos no coinciden.
          */}
          <ProveedorDeFiltro filtro={busqueda}>
            {FAMILIAS.map(({ family, que }) => {
              const dela = withData.filter((o) => o.family === family);
              if (dela.length === 0) return null;
              return (
                <Section
                  key={family}
                  titulo={t(`familia.${family}` as MessageKey)}
                  nivel={2}
                  prueba={`familia-${family}`}
                  /*
                   * Las claves son los objetos que la familia contiene EN ESTA busqueda.
                   */
                  keys={dela.flatMap((o) => [o.name, o.description])}
                >
                  <p className="tienda__familia-que">{que}</p>
                  <ListaDeObjetos
                    objetos={dela}
                    prueba={`tienda-${family}`}
                    conContrato
                    guardando={guardando}
                    onAnadir={onAnadir}
                  />
                </Section>
              );
            })}
          </ProveedorDeFiltro>
        </Section>
      ) : null}

      {de('elemento').length > 0 ? (
        <Section titulo="Elementos" prueba="seccion-elementos">
          <p className="texto-atenuado panel-editor__nota">
            No se enlazan a datos: componen la pagina. Texto, titulos, lineas, formas y conexiones.
          </p>
          <ListaDeObjetos
            objetos={de('elemento')}
            prueba="tienda-elementos"
            guardando={guardando}
            onAnadir={onAnadir}
          />
        </Section>
      ) : null}

      {de('contenedor').length > 0 ? (
        <Section titulo="Contenedores" prueba="seccion-contenedores">
          <p className="texto-atenuado panel-editor__nota">
            Agrupan elementos y visualizaciones en su propia rejilla.
          </p>
          <ListaDeObjetos
            objetos={de('contenedor')}
            prueba="tienda-contenedores"
            guardando={guardando}
            onAnadir={onAnadir}
          />
        </Section>
      ) : null}
    </>
  );
}

function ListaDeObjetos({
  objetos,
  prueba,
  conContrato = false,
  guardando,
  onAnadir,
}: {
  objetos: PaletteObject[];
  prueba: string;
  /*
   * El contrato solo se ensena donde significa algo.
   */
  conContrato?: boolean;
  guardando: boolean;
  onAnadir: (objectId: string) => void;
}) {
  return (
    <ul className="tienda" data-testid={prueba}>
      {objetos.map((o) => (
        <li key={o.objectId}>
          <button
            type="button"
            className="tienda__objeto"
            data-testid={`anadir-${o.objectId}`}
            disabled={guardando}
            title={o.description}
            onClick={() => onAnadir(o.objectId)}
          >
            {/* El icono lo declara el OBJETO. Habia un mapa aqui y otro en la tarjeta, y publicar
                un objeto nuevo dejaba a los dos sin entrada. */}
            <Icono nombre={o.icono} tamano={22} />
            <span className="tienda__nombre">{o.name}</span>
            {conContrato ? (
              <span className="tienda__contrato">
                {o.dimensiones.min}–{o.dimensiones.max} dim · {o.medidas.min}–{o.medidas.max} med
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Dataset y pozos de campos del objeto elegido. */
function Datos({
  item,
  definicion,
  datasets,
  guardando,
  onCambiar,
  onQuitar,
}: {
  item: GridItem;
  definicion: PaletteObject | undefined;
  datasets: DatasetDePaleta[];
  guardando: boolean;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const dataset = datasets.find((d) => d.datasetId === item.instance.binding.datasetId);
  const cambiarInstancia = (cambio: (i: ObjectInstance) => ObjectInstance) =>
    onCambiar(item.id, (it) => ({ ...it, instance: cambio(it.instance) }));

  const declaradas = definicion?.wells ?? [];
  const slots =
    declaradas.length > 0
      ? declaradas
      : defaultSlots({
          dimensions: definicion?.dimensiones ?? { min: 0, max: 0 },
          measures: definicion?.medidas ?? { min: 0, max: 0 },
        });

  const deDimension = slots.filter((r) => r.tipo === 'dimension');
  const deMedida = slots.filter((r) => r.tipo === 'medida');
  const asignacion = slotsOf(item.instance, slots);

  /*
   * Poner y quitar van POR RANURA, no por indice.
   */
  const poner = (slotId: string, fieldName: string) =>
    cambiarInstancia((i) => withSlotField(i, slots, slotId, fieldName));

  const quitar = (slotId: string, fieldName: string) =>
    cambiarInstancia((i) => slotFieldWithout(i, slots, slotId, fieldName));

  /*
   * Como se resume cada medida.
   */
  const agregacionDe = (fieldName: string): Aggregation =>
    item.instance.binding.aggregations?.[fieldName] ??
    dataset?.aggregations[fieldName] ??
    DEFAULT_AGGREGATION;

  /*
   * Los operadores que el desplegable puede ofrecer, de la MISMA regla que valida al guardar.
   */
  const posibles = agregacionesPosibles({
    colapsa: (dataset?.dimensiones ?? []).some(
      (d) => !item.instance.binding.dimensions.map(fieldKey).includes(d),
    ),
    dataGrain: dataset?.grain ?? 'atomico',
  });

  const cambiarAgregacion = (fieldName: string, aggregation: Aggregation) =>
    cambiarInstancia((i) => {
      const resto = { ...(i.binding.aggregations ?? {}) };
      // Volver a la del esquema se guarda BORRANDO la anulacion, no copiando el mismo valor: si
      // se copiara, el modulo dejaria de seguir a la fuente sin que nadie lo hubiera pedido.
      if (aggregation === (dataset?.aggregations[fieldName] ?? DEFAULT_AGGREGATION)) {
        delete resto[fieldName];
      } else {
        resto[fieldName] = aggregation;
      }
      // Se reconstruye el binding SIN la clave, en vez de extenderlo: con un spread, quitar la
      // ultima anulacion habria dejado la del objeto anterior intacta — el `...i.binding` la
      // vuelve a traer y el `{ agregaciones }` condicional no llega a pisarla.
      const { aggregations: _previas, ...binding } = i.binding;
      const quedan = Object.keys(resto).length > 0;
      return {
        ...i,
        binding: quedan ? { ...binding, aggregations: resto } : binding,
      };
    });

  return (
    <>
      <Section titulo="Origen" prueba={`seccion-origen-${item.id}`}>
        <label className="formulario__campo">
          <span>Titulo</span>
          <input
            defaultValue={item.instance.title}
            disabled={guardando}
            data-testid={`titulo-${item.id}`}
            onBlur={(e) => cambiarInstancia((i) => ({ ...i, title: e.target.value }))}
          />
        </label>

        <label className="formulario__campo">
          <span>Dataset</span>
          <select
            value={item.instance.binding.datasetId}
            disabled={guardando}
            data-testid={`dataset-${item.id}`}
            onChange={(e) =>
              cambiarInstancia((i) => ({
                ...i,
                // Al cambiar de dataset se limpia el mapeo: los campos del anterior no existen en
                // el nuevo, y conservarlos dejaria el objeto roto sin que nadie hiciera nada mal.
                binding: { datasetId: e.target.value, dimensions: [], measures: [] },
              }))
            }
          >
            {datasets.map((d) => (
              <option key={d.datasetId} value={d.datasetId}>
                {d.datasetId}
              </option>
            ))}
          </select>
        </label>
      </Section>

      {deDimension.length > 0 ? (
        <Section titulo="Campos" prueba={`seccion-campos-${item.id}`}>
          {deDimension.map((ranura) => (
            <RanuraDeEdicion
              key={ranura.id}
              ranura={ranura}
              todas={slots}
              item={item}
              elegidos={asignacion.get(ranura.id) ?? []}
              disponibles={dataset?.dimensiones ?? []}
              guardando={guardando}
              onAnadir={poner}
              onQuitar={quitar}
            />
          ))}
        </Section>
      ) : null}

      {deMedida.length > 0 ? (
        <Section titulo="Cifras" prueba={`seccion-cifras-${item.id}`}>
          {deMedida.map((ranura) => (
            <RanuraDeEdicion
              key={ranura.id}
              ranura={ranura}
              todas={slots}
              item={item}
              elegidos={asignacion.get(ranura.id) ?? []}
              disponibles={dataset?.medidas ?? []}
              guardando={guardando}
              onAnadir={poner}
              onQuitar={quitar}
              agregacionDe={agregacionDe}
              onAgregacion={cambiarAgregacion}
              posibles={posibles}
            />
          ))}
        </Section>
      ) : null}

      {/*
        Quitar es DESTRUCTIVO, y lo parecia menos que cualquier otra cosa del panel.
        Era un texto azul suelto al final de la columna, indistinguible de un rotulo. Lo que borra
        el trabajo de alguien tiene que verse como un boton y llevar el color de la advertencia,
        no esconderse en el peso visual mas bajo de la interfaz.
      */}
      <button
        type="button"
        className="boton-peligro panel-editor__quitar"
        data-testid={`quitar-${item.id}`}
        disabled={guardando}
        onClick={() => onQuitar(item.id)}
      >
        <Icono nombre="close" tamano={14} />
        Quitar del modulo
      </button>
    </>
  );
}

/** Un `Pozo` atado a su ranura: traduce el callback generico a «esta ranura». */
function RanuraDeEdicion({
  ranura,
  todas,
  item,
  elegidos,
  disponibles,
  guardando,
  onAnadir,
  onQuitar,
  agregacionDe,
  onAgregacion,
  posibles,
}: {
  ranura: FieldSlot;
  /** TODAS las ranuras del objeto, no solo esta. */
  todas: FieldSlot[];
  item: GridItem;
  elegidos: string[];
  disponibles: string[];
  guardando: boolean;
  onAnadir: (slotId: string, fieldName: string) => void;
  onQuitar: (slotId: string, fieldName: string) => void;
  agregacionDe?: (fieldName: string) => Aggregation;
  onAgregacion?: (fieldName: string, aggregation: Aggregation) => void;
  posibles?: Aggregation[];
}) {
  return (
    <Pozo
      pozo={ranura}
      prueba={`pozo-${item.id}-${ranura.id}`}
      elegidos={elegidos}
      disponibles={disponibles}
      // Solo `guardando`. Pasar aqui tambien «esta llena» apagaba los botones de QUITAR de la
      // propia ranura, asi que una ranura completa no se podia vaciar. El componente ya sabe si
      // esta llena y apaga solo lo que corresponde: el `+`.
      guardando={guardando}
      lleno={!cabeEnRanura(item.instance, todas, ranura.id)}
      onAnadir={(fieldName) => onAnadir(ranura.id, fieldName)}
      onQuitar={(fieldName) => onQuitar(ranura.id, fieldName)}
      {...(agregacionDe ? { agregacionDe } : {})}
      {...(onAgregacion ? { onAgregacion } : {})}
      {...(posibles ? { posibles } : {})}
    />
  );
}

/** Los objetos ADJUNTABLES del objeto elegido. */
function Complementos({
  item,
  objetos,
  guardando,
  onCambiar,
}: {
  item: GridItem;
  objetos: PaletteObject[];
  guardando: boolean;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
}) {
  const adjuntables = objetos.filter((o) => o.attachable);
  const puestos = item.instance.attachments ?? [];

  const conAdjuntos = (siguientes: AttachedObjectInstance[]) =>
    onCambiar(item.id, (it) => ({
      ...it,
      instance: { ...it.instance, attachments: siguientes },
    }));

  const anadir = (objectId: string, version: string) => {
    const instanceId = `${objectId}-${item.id}`;
    if (objectId === 'tooltip-explicativo') {
      conAdjuntos([
        ...puestos,
        {
          instanceId,
          objectId: 'tooltip-explicativo',
          version,
          // Un tooltip sin texto no es nada, y la validacion lo rechaza. Se crea con un texto de
          // partida en vez de vacio para que el objeto nazca valido y se pueda ver dibujado.
          text: `Que muestra «${item.instance.title ?? item.instance.objectId}».`,
        },
      ]);
      return;
    }
    conAdjuntos([
      ...puestos,
      // Alcance de objeto por defecto: es el unico que vale para cualquier anfitrion. El de
      // subobjeto necesita una dimension mapeada, y la validacion lo rechaza sin ella.
      { instanceId, objectId: 'tabla-de-datos', version, scope: 'objeto' },
    ]);
  };

  const quitar = (instanceId: string) =>
    conAdjuntos(puestos.filter((a) => a.instanceId !== instanceId));

  return (
    <>
      <p className="texto-atenuado panel-editor__nota">
        Acompanan a este objeto y no ocupan celda en la rejilla. Se dibujan como iconos en su
        pageHeader.
      </p>

      <Section titulo="Puestos" prueba={`seccion-complementos-${item.id}`}>
        {puestos.length === 0 ? (
          <p className="texto-atenuado" data-testid={`sin-complementos-${item.id}`}>
            Este objeto no lleva ninguno.
          </p>
        ) : (
          <ul className="panel-editor__adjuntos">
            {puestos.map((a) => (
              <li key={a.instanceId}>
                <Section
                  titulo={objetos.find((o) => o.objectId === a.objectId)?.name ?? a.objectId}
                  nivel={2}
                  prueba={`adjunto-${item.id}-${a.objectId}`}
                >
                  {a.objectId === 'tooltip-explicativo' ? (
                    <label className="formulario__campo">
                      <span>Texto</span>
                      <textarea
                        rows={3}
                        defaultValue={a.text}
                        disabled={guardando}
                        data-testid={`texto-${item.id}`}
                        onBlur={(e) =>
                          conAdjuntos(
                            puestos.map((x) =>
                              x.instanceId === a.instanceId && x.objectId === 'tooltip-explicativo'
                                ? { ...x, text: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ) : (
                    <label className="formulario__campo">
                      <span>Alcance</span>
                      <select
                        value={a.objectId === 'tabla-de-datos' ? a.scope : 'objeto'}
                        disabled={guardando}
                        data-testid={`alcance-${item.id}`}
                        onChange={(e) =>
                          conAdjuntos(
                            puestos.map((x) =>
                              x.instanceId === a.instanceId && x.objectId === 'tabla-de-datos'
                                ? { ...x, scope: e.target.value as 'objeto' | 'subobjeto' }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="objeto">Todo el objeto</option>
                        <option value="subobjeto">La categoria elegida</option>
                      </select>
                    </label>
                  )}

                  <button
                    type="button"
                    className="boton-enlace"
                    disabled={guardando}
                    data-testid={`quitar-adjunto-${item.id}-${a.objectId}`}
                    onClick={() => quitar(a.instanceId)}
                  >
                    Quitar
                  </button>
                </Section>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titulo="Anadir" prueba={`seccion-anadir-complemento-${item.id}`}>
        <ul className="tienda">
          {adjuntables.map((o) => {
            const yaPuesto = puestos.some((a) => a.objectId === o.objectId);
            return (
              <li key={o.objectId}>
                <button
                  type="button"
                  className="tienda__objeto"
                  // Uno de cada tipo: dos tooltips sobre el mismo objeto se dibujarian uno encima
                  // del otro y no habria forma de saber cual se esta leyendo.
                  disabled={guardando || yaPuesto}
                  title={o.description}
                  data-testid={`adjuntar-${o.objectId}-${item.id}`}
                  onClick={() => anadir(o.objectId, o.version)}
                >
                  <Icono nombre={o.icono} tamano={22} />
                  <span className="tienda__nombre">{o.name}</span>
                  <span className="tienda__contrato">{yaPuesto ? 'ya puesto' : 'anadir'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>
    </>
  );
}

/** Tamano y posicion, con numeros y con botones. */
function Tamano({
  item,
  guardando,
  onCambiar,
}: {
  item: GridItem;
  guardando: boolean;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
}) {
  const mover = (dx: number, dw: number) =>
    onCambiar(item.id, (it) => {
      // Se recorta contra los bordes aqui y no se deja que lo rechace la validacion: un boton que
      // guarda algo invalido y luego muestra un error hace trabajar a quien edita para descubrir
      // un limite que el editor ya conoce.
      const w = Math.min(GRID_COLUMNS, Math.max(1, it.position.w + dw));
      const x = Math.min(GRID_COLUMNS - w, Math.max(0, it.position.x + dx));
      return { ...it, position: { ...it.position, x, w } };
    });

  const alto = (dh: number) =>
    onCambiar(item.id, (it) => ({
      ...it,
      position: { ...it.position, h: Math.max(1, it.position.h + dh) },
    }));

  const enElBorde = item.position.x + item.position.w >= GRID_COLUMNS;

  return (
    <>
      <p className="texto-atenuado panel-editor__nota" data-testid={`posicion-${item.id}`}>
        Columna {item.position.x + 1}–{item.position.x + item.position.w} de {GRID_COLUMNS} ·{' '}
        {item.position.h} {item.position.h === 1 ? 'fila' : 'filas'}
      </p>
      <div className="panel-editor__pasos">
        <Paso etiqueta="Menos ancho" prueba={`estrechar-${item.id}`} desactivado={guardando || item.position.w <= 1} onPulsar={() => mover(0, -1)} />
        <Paso etiqueta="Mas ancho" prueba={`ensanchar-${item.id}`} desactivado={guardando || enElBorde} onPulsar={() => mover(0, 1)} />
        <Paso etiqueta="Mover a la izquierda" prueba={`izquierda-${item.id}`} desactivado={guardando || item.position.x <= 0} onPulsar={() => mover(-1, 0)} />
        <Paso etiqueta="Mover a la derecha" prueba={`derecha-${item.id}`} desactivado={guardando || enElBorde} onPulsar={() => mover(1, 0)} />
        <Paso etiqueta="Menos alto" prueba={`bajar-${item.id}`} desactivado={guardando || item.position.h <= 1} onPulsar={() => alto(-1)} />
        <Paso etiqueta="Mas alto" prueba={`subir-${item.id}`} desactivado={guardando} onPulsar={() => alto(1)} />
      </div>
    </>
  );
}

function Paso({
  etiqueta,
  prueba,
  desactivado,
  onPulsar,
}: {
  etiqueta: string;
  prueba: string;
  desactivado: boolean;
  onPulsar: () => void;
}) {
  return (
    <button
      type="button"
      className="md-chip"
      data-testid={prueba}
      disabled={desactivado}
      onClick={onPulsar}
    >
      {etiqueta}
    </button>
  );
}

