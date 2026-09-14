'use client';

import type { QueryResult } from '@app/data-contracts';
import {
  type ContainerSettings,
  type ElementSettings,
  fieldKey,
  toSlicerOptions,
} from '@app/ui-components';
import {
  ExpandableContainer,
  TabContainer,
  ScrollableContainer,
  SimpleContainer,
  ExpandableInPlaceContainer,
} from './containers';
import { TextBox, BasicShape, DividerLine, SectionTitle } from './elements';
import { GridConnection } from './GridConnection';
import { FiltersPanel } from './FiltersPanel';
import { Slicer } from './Slicer';
import {
  Area,
  Bars,
  HorizontalBars,
  Waterfall,
  Pie,
  Combo,
  Scatter,
  Donut,
  Funnel,
  TreeMap,
  Lines,
  Gauge,
  Matrix,
  GeneratingObject,
  ObjectNotAvailable,
  BrokenObject,
  Frame,
  Table,
  KpiCard,
} from './objects';
import type { SerializedObject } from '../server/serialize';

/** Que componente dibuja cada instancia. */

/** Filtrado cruzado apagado: el objeto recibe siempre la funcion, y esta no hace nada. */
const WITHOUT_FILTERED = (): undefined => undefined;

export function ModuleObject({
  objeto,
  onFiltrar,
}: {
  objeto: SerializedObject;
  /** Opcional a proposito: en la vista previa del editor no hay filtrado cruzado. */
  onFiltrar?: (fieldName: string, valor: string) => void;
}) {
  const titulo = objeto.titulo;

  /*
   * Los elementos y los contenedores se resuelven ANTES de exigir `result`.
   */
  const conf = objeto.instance.settings;

  if (objeto.unresolvedObject || objeto.problems.length > 0) {
    return (
      <BrokenObject
        titulo={titulo}
        problems={objeto.problems}
        {...(objeto.unresolvedObject ? { unresolvedObject: objeto.unresolvedObject } : {})}
      />
    );
  }

  const elemento = conf as (ElementSettings & { objectId: string }) | undefined;
  switch (objeto.instance.objectId) {
    case 'cuadro-de-texto':
      return (
        <Frame
          titulo={titulo}
          instance={objeto.instance}
          {...(objeto.icono ? { objectIcon: objeto.icono } : {})}
        >
          <TextBox config={elemento?.textBox} />
        </Frame>
      );
    // Los cuatro siguientes van SIN marco: una linea, un conector, un titulo de seccion y una
    // forma son trazos. Metidos en una tarjeta con borde y sombra dejan de separar, conectar,
    // encabezar o senalar, y pasan a ser un bloque mas.
    case 'titulo-de-seccion':
      return <SectionTitle config={elemento?.sectionTitle} />;
    case 'linea-divisoria':
      return <DividerLine config={elemento?.lineDivider} />;
    case 'forma':
      return <BasicShape config={elemento?.forma} />;
    case 'conexion':
      return <GridConnection config={elemento?.conexion} />;
    default:
      break;
  }

  const contenedor = conf as (ContainerSettings & { objectId: string }) | undefined;
  const drawChild = (child: SerializedObject) => (
    <ModuleObject objeto={child} {...(onFiltrar ? { onFiltrar } : {})} />
  );
  const containerProps = { objeto, titulo, config: contenedor, draw: drawChild };

  switch (objeto.instance.objectId) {
    case 'contenedor-simple':
      return <SimpleContainer {...containerProps} />;
    case 'contenedor-desplazable':
      return <ScrollableContainer {...containerProps} />;
    case 'contenedor-ampliable':
      return <ExpandableContainer {...containerProps} />;
    case 'contenedor-expandible':
      return <ExpandableInPlaceContainer {...containerProps} />;
    case 'contenedor-con-pestanas':
      return <TabContainer {...containerProps} />;
    default:
      break;
  }

  if (!objeto.result) return <GeneratingObject titulo={titulo} />;

  const result = objeto.result as QueryResult;
  const props = {
    titulo,
    result,
    instance: objeto.instance,
    // Los operadores de agregacion viajan con el objeto por el mismo motivo que las ranuras: el
    // cliente no tiene el esquema, y deducirlos aqui abriria la puerta a que lo dibujado y lo
    // exportado resumieran distinto.
    aggregations: objeto.aggregations,
    // Las ranuras viajan con el objeto: sin ellas los renderizadores volverian a leer por posicion.
    ...(objeto.slots ? { slots: objeto.slots } : {}),
    // Y el icono, por lo mismo: el cliente no tiene el registro.
    ...(objeto.icono ? { objectIcon: objeto.icono } : {}),
    // Los objetos esperan un `onFiltrar`; sin filtrado cruzado se les pasa uno que no hace nada,
    // y ellos deciden no ofrecer el gesto por su cuenta cuando no hay dimension.
    onFiltrar: onFiltrar ?? WITHOUT_FILTERED,
  };

  switch (objeto.instance.objectId) {
    case 'tarjeta-kpi':
      return <KpiCard {...props} />;
    case 'barras':
      return <Bars {...props} />;
    case 'barras-horizontales':
      return <HorizontalBars {...props} />;
    case 'area':
      return <Area {...props} />;
    case 'lineas':
      return <Lines {...props} />;
    case 'embudo':
      return <Funnel {...props} />;
    case 'cascada':
      return <Waterfall {...props} />;
    case 'mapa-de-arbol':
      return <TreeMap {...props} />;
    case 'combinado':
      return <Combo {...props} />;
    case 'dispersion':
      return <Scatter {...props} />;
    case 'pastel':
      return <Pie {...props} />;
    case 'dona':
      return <Donut {...props} />;
    case 'medidor':
      return <Gauge {...props} />;
    case 'tabla':
      return <Table {...props} />;
    case 'matriz':
      return <Matrix {...props} />;
    case 'panel-de-filtros':
      return (
        <FiltersPanel
          titulo={titulo}
          instance={objeto.instance}
          result={result}
          {...(objeto.icono ? { objectIcon: objeto.icono } : {})}
        />
      );
    case 'segmentador': {
      const dimension = objeto.instance.binding.dimensions[0];
      if (!dimension) return <BrokenObject titulo={titulo} problems={[]} />;
      return (
        <Slicer
          titulo={titulo}
          fieldName={fieldKey(dimension)}
          opciones={toSlicerOptions(result, dimension)}
          instance={objeto.instance}
          result={result}
          {...(objeto.icono ? { objectIcon: objeto.icono } : {})}
        />
      );
    }
    default:
      return <ObjectNotAvailable titulo={titulo} objectId={objeto.instance.objectId} />;
  }
}
