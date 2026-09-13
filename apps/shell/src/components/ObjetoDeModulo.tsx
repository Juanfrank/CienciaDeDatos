'use client';

import type { QueryResult } from '@app/data-contracts';
import {
  type ContainerSettings,
  type ElementSettings,
  fieldKey,
  toSlicerOptions,
} from '@app/ui-components';
import {
  ContenedorAmpliable,
  ContenedorConPestanas,
  ContenedorDesplazable,
  ContenedorSimple,
} from './contenedores';
import { CuadroDeTexto, FormaBasica, LineaDivisoria, TituloDeSeccion } from './elementos';
import { ConexionEnRejilla } from './ConexionEnRejilla';
import { PanelDeFiltros } from './PanelDeFiltros';
import { Segmentador } from './Segmentador';
import {
  Area,
  Barras,
  BarrasHorizontales,
  Cascada,
  Circular,
  Combinado,
  Dispersion,
  Dona,
  Embudo,
  MapaDeArbol,
  Lineas,
  Medidor,
  Matriz,
  ObjetoGenerandose,
  ObjetoNoDisponible,
  ObjetoRoto,
  Marco,
  Tabla,
  TarjetaKpi,
} from './objetos';
import type { ObjetoSerializado } from '../server/serializar';

/** Que componente dibuja cada instancia. */

/** Filtrado cruzado apagado: el objeto recibe siempre la funcion, y esta no hace nada. */
const SIN_FILTRADO = (): undefined => undefined;

export function ObjetoDeModulo({
  objeto,
  onFiltrar,
}: {
  objeto: ObjetoSerializado;
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
      <ObjetoRoto
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
        <Marco
          titulo={titulo}
          instance={objeto.instance}
          {...(objeto.icono ? { objectIcon: objeto.icono } : {})}
        >
          <CuadroDeTexto config={elemento?.textBox} />
        </Marco>
      );
    // Los cuatro siguientes van SIN marco: una linea, un conector, un titulo de seccion y una
    // forma son trazos. Metidos en una tarjeta con borde y sombra dejan de separar, conectar,
    // encabezar o senalar, y pasan a ser un bloque mas.
    case 'titulo-de-seccion':
      return <TituloDeSeccion config={elemento?.sectionTitle} />;
    case 'linea-divisoria':
      return <LineaDivisoria config={elemento?.lineDivider} />;
    case 'forma':
      return <FormaBasica config={elemento?.forma} />;
    case 'conexion':
      return <ConexionEnRejilla config={elemento?.conexion} />;
    default:
      break;
  }

  const contenedor = conf as (ContainerSettings & { objectId: string }) | undefined;
  const dibujarHijo = (hijo: ObjetoSerializado) => (
    <ObjetoDeModulo objeto={hijo} {...(onFiltrar ? { onFiltrar } : {})} />
  );
  const propsDeContenedor = { objeto, titulo, config: contenedor, dibujar: dibujarHijo };

  switch (objeto.instance.objectId) {
    case 'contenedor-simple':
      return <ContenedorSimple {...propsDeContenedor} />;
    case 'contenedor-desplazable':
      return <ContenedorDesplazable {...propsDeContenedor} />;
    case 'contenedor-ampliable':
      return <ContenedorAmpliable {...propsDeContenedor} />;
    case 'contenedor-con-pestanas':
      return <ContenedorConPestanas {...propsDeContenedor} />;
    default:
      break;
  }

  if (!objeto.result) return <ObjetoGenerandose titulo={titulo} />;

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
    onFiltrar: onFiltrar ?? SIN_FILTRADO,
  };

  switch (objeto.instance.objectId) {
    case 'tarjeta-kpi':
      return <TarjetaKpi {...props} />;
    case 'barras':
      return <Barras {...props} />;
    case 'barras-horizontales':
      return <BarrasHorizontales {...props} />;
    case 'area':
      return <Area {...props} />;
    case 'lineas':
      return <Lineas {...props} />;
    case 'embudo':
      return <Embudo {...props} />;
    case 'cascada':
      return <Cascada {...props} />;
    case 'mapa-de-arbol':
      return <MapaDeArbol {...props} />;
    case 'combinado':
      return <Combinado {...props} />;
    case 'dispersion':
      return <Dispersion {...props} />;
    case 'pastel':
      return <Circular {...props} />;
    case 'dona':
      return <Dona {...props} />;
    case 'medidor':
      return <Medidor {...props} />;
    case 'tabla':
      return <Tabla {...props} />;
    case 'matriz':
      return <Matriz {...props} />;
    case 'panel-de-filtros':
      return (
        <PanelDeFiltros
          titulo={titulo}
          instance={objeto.instance}
          result={result}
          {...(objeto.icono ? { objectIcon: objeto.icono } : {})}
        />
      );
    case 'segmentador': {
      const dimension = objeto.instance.binding.dimensions[0];
      if (!dimension) return <ObjetoRoto titulo={titulo} problems={[]} />;
      return (
        <Segmentador
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
      return <ObjetoNoDisponible titulo={titulo} objectId={objeto.instance.objectId} />;
  }
}
