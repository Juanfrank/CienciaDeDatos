'use client';

import { useEffect, useState } from 'react';
import { GRID_COLUMNS, type GridItem } from '@app/module-model';
import {
  cabeEnRanura,
  conCampoEnRanura,
  ranurasDe,
  ranurasPorDefecto,
  sinCampoEnRanura,
  type AttachedObjectInstance,
  type ObjectInstance,
  type RanuraDeCampos,
} from '@app/ui-components';
import type { DatasetDePaleta, ObjetoDePaleta } from '../../server/editor';
import { Icono, type NombreDeIcono } from '../iconos/Icono';
import { Pestanas, type DefinicionDePestana } from './Pestanas';
import { Pozo } from './Pozo';
import { Presentacion } from './Presentacion';
import { Seccion } from './Seccion';

/**
 * El panel del editor: la tienda y el banco de trabajo, en uno.
 *
 * Cuatro pestanas, y el corte responde a cuatro preguntas distintas:
 *
 *   - **Visualizaciones** — «que quiero poner». La unica puerta por la que entra un objeto al
 *     modulo, y por eso tambien donde se ve que el catalogo es cerrado.
 *   - **Datos** — «que mide». Los pozos con nombre del objeto elegido.
 *   - **Formato** — «como se ve». Presentacion, y el tamano y la posicion, que tambien son como se
 *     ve: cuanto ocupa un objeto en la rejilla no cambia lo que mide.
 *   - **Complementos** — «que lo acompana». Los objetos adjuntables, que no van en la rejilla.
 *
 * Sin nada elegido solo tiene sentido la primera, asi que las otras se deshabilitan en vez de
 * desaparecer: una barra que cambia de numero de pestanas obliga a volver a buscar donde estaba
 * cada cosa.
 */

type Pestana = 'visualizaciones' | 'datos' | 'formato' | 'complementos';

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
  'tooltip-explicativo': 'informacion',
  'tabla-de-datos': 'datos',
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

  /*
   * Al elegir un objeto, el panel salta a «Datos».
   *
   * Es lo que se quiere hacer justo despues de colocar algo, y dejarlo en «Visualizaciones»
   * obligaria a un clic mas en el 100 % de los casos. Al deseleccionar vuelve a la tienda, porque
   * las otras pestanas ya no tienen contenido.
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

  const PESTANAS: DefinicionDePestana<Pestana>[] = [
    { id: 'visualizaciones', etiqueta: 'Visualizaciones', icono: 'barras', habilitada: true },
    { id: 'datos', etiqueta: 'Datos', icono: 'tabla', habilitada: hayObjeto },
    { id: 'formato', etiqueta: 'Formato', icono: 'indicador', habilitada: hayObjeto },
    { id: 'complementos', etiqueta: 'Complementos', icono: 'informacion', habilitada: hayObjeto },
  ];

  return (
    <aside className="panel-editor" data-testid="panel-editor">
      <Pestanas pestanas={PESTANAS} activa={pestana} onElegir={setPestana} />

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
          <>
            {/* `Presentacion` ya trae sus propias subsecciones: envolverlo en otra repetiria el
                rotulo «Presentacion» dos veces seguidas. */}
            <Presentacion
              instance={seleccionado.instance}
              admitidas={definicion?.presentacion ?? []}
              tipos={dataset?.tipos ?? {}}
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
            <Seccion titulo="Tamano y posicion" prueba={`seccion-tamano-${seleccionado.id}`}>
              <Tamano item={seleccionado} guardando={guardando} onCambiar={onCambiar} />
            </Seccion>
          </>
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
  // rechaza, asi que tampoco se ofrecen aqui: tienen su propia pestana.
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
  definicion: ObjetoDePaleta | undefined;
  datasets: DatasetDePaleta[];
  guardando: boolean;
  onCambiar: (itemId: string, cambio: (item: GridItem) => GridItem) => void;
  onQuitar: (itemId: string) => void;
}) {
  const dataset = datasets.find((d) => d.datasetId === item.instance.binding.datasetId);
  const cambiarInstancia = (cambio: (i: ObjectInstance) => ObjectInstance) =>
    onCambiar(item.id, (it) => ({ ...it, instance: cambio(it.instance) }));

  const declaradas = definicion?.pozos ?? [];
  const ranuras =
    declaradas.length > 0
      ? declaradas
      : ranurasPorDefecto({
          dimensions: definicion?.dimensiones ?? { min: 0, max: 0 },
          measures: definicion?.medidas ?? { min: 0, max: 0 },
        });

  const deDimension = ranuras.filter((r) => r.tipo === 'dimension');
  const deMedida = ranuras.filter((r) => r.tipo === 'medida');
  const asignacion = ranurasDe(item.instance, ranuras);

  /*
   * Poner y quitar van POR RANURA, no por indice.
   *
   * Es todo el cambio: antes el editor insertaba en una posicion calculada del array y el pozo
   * era una particion sobre ese orden, asi que no habia forma de llenar el eje Y sin llenar antes
   * el eje X. Ahora el campo dice a que ranura pertenece y las demas pueden quedarse vacias.
   */
  const poner = (ranuraId: string, campo: string) =>
    cambiarInstancia((i) => conCampoEnRanura(i, ranuras, ranuraId, campo));

  const quitar = (ranuraId: string, campo: string) =>
    cambiarInstancia((i) => sinCampoEnRanura(i, ranuras, ranuraId, campo));

  return (
    <>
      <Seccion titulo="Origen" prueba={`seccion-origen-${item.id}`}>
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
      </Seccion>

      {deDimension.length > 0 ? (
        <Seccion titulo="Campos" prueba={`seccion-campos-${item.id}`}>
          {deDimension.map((ranura) => (
            <RanuraDeEdicion
              key={ranura.id}
              ranura={ranura}
              todas={ranuras}
              item={item}
              elegidos={asignacion.get(ranura.id) ?? []}
              disponibles={dataset?.dimensiones ?? []}
              guardando={guardando}
              onAnadir={poner}
              onQuitar={quitar}
            />
          ))}
        </Seccion>
      ) : null}

      {deMedida.length > 0 ? (
        <Seccion titulo="Cifras" prueba={`seccion-cifras-${item.id}`}>
          {deMedida.map((ranura) => (
            <RanuraDeEdicion
              key={ranura.id}
              ranura={ranura}
              todas={ranuras}
              item={item}
              elegidos={asignacion.get(ranura.id) ?? []}
              disponibles={dataset?.medidas ?? []}
              guardando={guardando}
              onAnadir={poner}
              onQuitar={quitar}
            />
          ))}
        </Seccion>
      ) : null}

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
}: {
  ranura: RanuraDeCampos;
  /**
   * TODAS las ranuras del objeto, no solo esta.
   *
   * `cabeEnRanura` necesita la lista completa: con una sola, la deduccion por orden —la que hace
   * que lo guardado antes de las ranuras se siga viendo— le asigna el primer campo del array, que
   * es el de otra ranura. El sintoma era una ranura vacia que se anunciaba completa.
   */
  todas: RanuraDeCampos[];
  item: GridItem;
  elegidos: string[];
  disponibles: string[];
  guardando: boolean;
  onAnadir: (ranuraId: string, campo: string) => void;
  onQuitar: (ranuraId: string, campo: string) => void;
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
      onAnadir={(campo) => onAnadir(ranura.id, campo)}
      onQuitar={(campo) => onQuitar(ranura.id, campo)}
    />
  );
}

/**
 * Los objetos ADJUNTABLES del objeto elegido.
 *
 * Estaban en el catalogo y en el modelo desde F3.4, con su validacion y sus pruebas, y no habia
 * forma de anadir uno desde el editor: los del seed se escribieron a mano. Octavo caso de codigo
 * construido al que no llamaba nada.
 *
 * Tienen pestana propia y no se mezclan con la tienda porque no son lo mismo: un complemento no
 * ocupa celda en la rejilla, acompana a otro objeto, y la validacion rechaza colocarlo suelto.
 */
function Complementos({
  item,
  objetos,
  guardando,
  onCambiar,
}: {
  item: GridItem;
  objetos: ObjetoDePaleta[];
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
        cabecera.
      </p>

      <Seccion titulo="Puestos" prueba={`seccion-complementos-${item.id}`}>
        {puestos.length === 0 ? (
          <p className="texto-atenuado" data-testid={`sin-complementos-${item.id}`}>
            Este objeto no lleva ninguno.
          </p>
        ) : (
          <ul className="panel-editor__adjuntos">
            {puestos.map((a) => (
              <li key={a.instanceId}>
                <Seccion
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
                </Seccion>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Anadir" prueba={`seccion-anadir-complemento-${item.id}`}>
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
                  <Icono nombre={ICONO_DE_TIPO[o.objectId] ?? 'informacion'} tamano={22} />
                  <span className="tienda__nombre">{o.name}</span>
                  <span className="tienda__contrato">{yaPuesto ? 'ya puesto' : 'anadir'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Seccion>
    </>
  );
}

/**
 * Tamano y posicion, con numeros y con botones.
 *
 * Arrastrar seria mas directo con un raton y deja fuera a quien no lo usa: 4.9 dice que la
 * accesibilidad no se pospone. Los botones mueven de columna en columna y son el camino que
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

