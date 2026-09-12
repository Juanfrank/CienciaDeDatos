'use client';

import { useEffect, useRef, useState } from 'react';
import { GRID_COLUMNS, type GridItem } from '@app/module-model';
import type { ObjectInstance } from '@app/ui-components';
import type { DatasetDePaleta, ObjetoDePaleta } from '../../server/editor';
import { Icono, type NombreDeIcono } from '../iconos/Icono';
import { Presentacion } from './Presentacion';

/**
 * El panel del editor: la tienda y el banco de trabajo, en uno.
 *
 * Tres pestanas, y el corte entre ellas responde a tres preguntas distintas:
 *
 *   - **Visualizaciones** — «que quiero poner». Es la unica puerta por la que entra un objeto al
 *     modulo, y por eso es tambien donde se ve que existe un catalogo cerrado: no hay ninguna
 *     otra forma de anadir algo, igual que no hay ninguna caja donde escribir una consulta.
 *   - **Datos** — «que mide». Dataset, dimensiones y medidas del objeto elegido.
 *   - **Formato** — «como se ve». El contrato de presentacion, filtrado por lo que ese objeto
 *     admite.
 *
 * Sin nada elegido solo tiene sentido la primera, asi que las otras dos se deshabilitan en vez de
 * desaparecer: una barra de pestanas que cambia de numero segun lo que este seleccionado obliga a
 * volver a buscar donde estaba cada cosa.
 *
 * Las pestanas son `role="tablist"` de verdad, con flechas: es el patron que un lector de
 * pantalla anuncia como pestanas, y sin el serian tres botones que casualmente se parecen.
 */

type Pestana = 'visualizaciones' | 'datos' | 'formato';

const PESTANAS: { id: Pestana; etiqueta: string; icono: NombreDeIcono }[] = [
  { id: 'visualizaciones', etiqueta: 'Visualizaciones', icono: 'barras' },
  { id: 'datos', etiqueta: 'Datos', icono: 'tabla' },
  { id: 'formato', etiqueta: 'Formato', icono: 'indicador' },
];

/** Icono con el que cada tipo se ofrece en la tienda. */
const ICONO_DE_TIPO: Record<string, NombreDeIcono> = {
  'tarjeta-kpi': 'indicador',
  barras: 'barras',
  lineas: 'lineas',
  tabla: 'tabla',
  matriz: 'tabla',
  segmentador: 'filtro',
  'panel-de-filtros': 'filtro',
  mapa: 'lugar',
};

export function PanelLateral({
  objetos,
  datasets,
  seleccionado,
  guardando,
  onAnadir,
  onCambiar,
  onQuitar,
}: {
  objetos: ObjetoDePaleta[];
  datasets: DatasetDePaleta[];
  seleccionado: GridItem | null;
  guardando: boolean;
  onAnadir: (objectId: string) => void;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>('visualizaciones');
  const listaDePestanas = useRef<HTMLDivElement>(null);

  /*
   * Al elegir un objeto, el panel salta a «Datos».
   *
   * Es lo que se quiere hacer justo despues de colocar algo, y dejarlo en «Visualizaciones»
   * obligaria a un clic mas en el 100 % de los casos. Al deseleccionar vuelve a la tienda, porque
   * las otras dos pestanas ya no tienen contenido.
   */
  const idSeleccionado = seleccionado?.id ?? null;
  useEffect(() => {
    setPestana(idSeleccionado ? 'datos' : 'visualizaciones');
  }, [idSeleccionado]);

  const hayObjeto = seleccionado !== null;
  const definicion = seleccionado
    ? objetos.find((o) => o.objectId === seleccionado.instance.objectId)
    : undefined;
  const dataset = seleccionado
    ? datasets.find((d) => d.datasetId === seleccionado.instance.binding.datasetId)
    : undefined;

  const habilitada = (id: Pestana) => id === 'visualizaciones' || hayObjeto;

  // Flechas entre pestanas, como pide el patron de `tablist`. Solo salta a las habilitadas.
  const alPulsarTecla = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const posibles = PESTANAS.filter((p) => habilitada(p.id));
    const actual = posibles.findIndex((p) => p.id === pestana);
    const paso = e.key === 'ArrowRight' ? 1 : -1;
    const siguiente = posibles[(actual + paso + posibles.length) % posibles.length];
    if (!siguiente) return;
    setPestana(siguiente.id);
    listaDePestanas.current
      ?.querySelector<HTMLButtonElement>(`[data-pestana='${siguiente.id}']`)
      ?.focus();
  };

  return (
    <aside className="panel-editor" data-testid="panel-editor">
      <div
        className="panel-editor__pestanas"
        role="tablist"
        aria-label="Herramientas del editor"
        ref={listaDePestanas}
        onKeyDown={alPulsarTecla}
      >
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            id={`pestana-${p.id}`}
            data-pestana={p.id}
            aria-selected={pestana === p.id}
            aria-controls={`panel-${p.id}`}
            // Solo la pestana activa esta en el orden de tabulacion; dentro del grupo se navega
            // con flechas. Es lo que distingue una barra de pestanas de tres botones sueltos.
            tabIndex={pestana === p.id ? 0 : -1}
            disabled={!habilitada(p.id)}
            className="panel-editor__pestana"
            data-testid={`pestana-${p.id}`}
            onClick={() => setPestana(p.id)}
          >
            <Icono nombre={p.icono} tamano={18} />
            <span>{p.etiqueta}</span>
          </button>
        ))}
      </div>

      <div
        className="panel-editor__cuerpo"
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
        tabIndex={0}
      >
        {pestana === 'visualizaciones' ? (
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
          <Presentacion
            instance={seleccionado.instance}
            admitidas={definicion?.presentacion ?? []}
            tipos={dataset?.tipos ?? {}}
            guardando={guardando}
            onCambiar={(cambio) =>
              onCambiar(seleccionado.id, (i) => ({ ...i, instance: cambio(i.instance) }))
            }
          />
        ) : null}
      </div>
    </aside>
  );
}

/** La tienda: la unica puerta por la que entra un objeto al modulo. */
function Tienda({
  objetos,
  guardando,
  onAnadir,
}: {
  objetos: ObjetoDePaleta[];
  guardando: boolean;
  onAnadir: (objectId: string) => void;
}) {
  // Los complementos se adjuntan a otro objeto, no se colocan en la rejilla. La validacion lo
  // rechaza, asi que tampoco se ofrecen.
  const colocables = objetos.filter((o) => !o.attachable);

  return (
    <>
      <p className="texto-atenuado panel-editor__nota">
        Se enlazan a un dataset certificado del registro. Un modulo no construye consultas (4.2).
      </p>
      <ul className="tienda" data-testid="tienda">
        {colocables.map((o) => (
          <li key={o.objectId}>
            <button
              type="button"
              className="tienda__objeto"
              data-testid={`anadir-${o.objectId}`}
              disabled={guardando}
              title={o.description}
              onClick={() => onAnadir(o.objectId)}
            >
              <Icono nombre={ICONO_DE_TIPO[o.objectId] ?? 'barras'} tamano={22} />
              <span className="tienda__nombre">{o.name}</span>
              <span className="tienda__contrato">
                {o.dimensiones.min}–{o.dimensiones.max} dim · {o.medidas.min}–{o.medidas.max} med
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Dataset, campos y tamano del objeto elegido. */
function Datos({
  item,
  definicion,
  datasets,
  guardando,
  onCambiar,
  onQuitar,
}: {
  item: GridItem;
  definicion: ObjetoDePaleta | undefined;
  datasets: DatasetDePaleta[];
  guardando: boolean;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const dataset = datasets.find((d) => d.datasetId === item.instance.binding.datasetId);
  const cambiarInstancia = (cambio: (i: ObjectInstance) => ObjectInstance) =>
    onCambiar(item.id, (it) => ({ ...it, instance: cambio(it.instance) }));

  return (
    <>
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

      <fieldset className="editor__campos">
        <legend>
          Dimensiones ({definicion?.dimensiones.min}–{definicion?.dimensiones.max})
        </legend>
        {(dataset?.dimensiones ?? []).map((clave) => (
          <label key={clave}>
            <input
              type="checkbox"
              disabled={guardando}
              data-testid={`dim-${item.id}-${clave}`}
              checked={item.instance.binding.dimensions.some(
                (d) => `${d.table}.${d.field}` === clave,
              )}
              onChange={(e) =>
                cambiarInstancia((i) => ({
                  ...i,
                  binding: {
                    ...i.binding,
                    dimensions: e.target.checked
                      ? [...i.binding.dimensions, aFieldRef(clave)]
                      : i.binding.dimensions.filter((d) => `${d.table}.${d.field}` !== clave),
                  },
                }))
              }
            />{' '}
            {clave}
          </label>
        ))}
      </fieldset>

      <fieldset className="editor__campos">
        <legend>
          Medidas ({definicion?.medidas.min}–{definicion?.medidas.max})
        </legend>
        {(dataset?.medidas ?? []).map((medida) => (
          <label key={medida}>
            <input
              type="checkbox"
              disabled={guardando}
              data-testid={`med-${item.id}-${medida}`}
              checked={item.instance.binding.measures.includes(medida)}
              onChange={(e) =>
                cambiarInstancia((i) => ({
                  ...i,
                  binding: {
                    ...i.binding,
                    measures: e.target.checked
                      ? [...i.binding.measures, medida]
                      : i.binding.measures.filter((m) => m !== medida),
                  },
                }))
              }
            />{' '}
            {medida}
          </label>
        ))}
      </fieldset>

      <Tamano item={item} guardando={guardando} onCambiar={onCambiar} />

      <button
        type="button"
        className="boton-enlace"
        data-testid={`quitar-${item.id}`}
        disabled={guardando}
        onClick={() => onQuitar(item.id)}
      >
        Quitar del modulo
      </button>
    </>
  );
}

/**
 * Tamano y posicion, con numeros y con botones.
 *
 * Arrastrar seria mas directo con un raton y deja fuera a quien no lo usa: 4.9 dice que la
 * accesibilidad no se pospone, y un lienzo que solo se ordena arrastrando es un lienzo que solo
 * ordena parte de la gente. Los botones mueven de columna en columna y son el camino que
 * cualquiera puede recorrer; el arrastre puede venir despues SOBRE ESTAS MISMAS operaciones, no
 * como un segundo camino que pueda divergir.
 */
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
      // Se recorta contra los bordes aqui y no se deja que lo rechace la validacion: un boton
      // que guarda algo invalido y luego muestra un error hace trabajar a quien edita para
      // descubrir un limite que el editor ya conoce.
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
    <fieldset className="editor__campos">
      <legend>Tamano y posicion</legend>
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
    </fieldset>
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

/** 'Tabla.Campo' -> FieldRef. El editor trabaja con la clave, que es lo que se ve en pantalla. */
function aFieldRef(clave: string): { table: string; field: string } {
  const [table = '', field = ''] = clave.split('.');
  return { table, field };
}
