'use client';

import { useId, useState } from 'react';
import {
  type ContainerSettings,
  type Axis,
  DEFAULT_COLUMN_INTERNAL,
  columnsOf,
  fieldKey,
  rowsOnExpand,
} from '@app/ui-components';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { Icon } from './icons/Icon';
import { Frame } from './objects';
import type { SerializedObject, SerializedPanel } from '../server/serialize';
import { useTranslator } from './Locale';

/** Los contenedores: objetos que llevan otros objetos dentro. */

/**
 * Si algun objeto de dentro esta acotando lo que se ve.
 *
 * Se mira por las DIMENSIONES que mapea cada objeto de dentro contra lo que hay en la URL, que es
 * donde vive el estado de filtros. Preguntarle a cada tipo de objeto si «esta filtrando» habria
 * exigido un metodo en los dieciseis renderizadores; el mapeo ya dice de que campo va cada uno.
 */
function algoFiltraDentro(objeto: SerializedObject, params: URLSearchParams): boolean {
  const puestos = new Set(params.keys());
  const dentro = (o: SerializedObject): boolean =>
    o.instance.binding.dimensions.some((d) => puestos.has(fieldKey(d))) ||
    (o.panels ?? []).some((p) => p.objetos.some(dentro));

  return (objeto.panels ?? []).some((p) => p.objetos.some(dentro));
}

/** La rejilla interna. La misma para los cinco: un contenedor es una rejilla con una cabecera. */
function InternalGrid({
  panel,
  gridColumns,
  draw,
}: {
  panel: SerializedPanel | undefined;
  gridColumns: number;
  draw: (objeto: SerializedObject) => React.ReactNode;
}) {
  const t = useTranslator();
  const items = panel?.objetos ?? [];

  if (items.length === 0) {
    return (
      <p className="container__empty" data-testid="empty-container">
        {t('editor.dropHere')}
      </p>
    );
  }

  return (
    <div
      className="container__grid"
      style={{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))` }}
    >
      {items.map((objeto) => (
        <div
          key={objeto.itemId}
          className="container__cell"
          style={{
            gridColumn: `${objeto.position.x + 1} / span ${objeto.position.w}`,
            gridRow: `${objeto.position.y + 1} / span ${objeto.position.h}`,
          }}
        >
          {draw(objeto)}
        </div>
      ))}
    </div>
  );
}

interface ContainerProps {
  objeto: SerializedObject;
  titulo: string;
  config: ContainerSettings | undefined;
  draw: (child: SerializedObject) => React.ReactNode;
}

/* ── Simple ────────────────────────────────────────────────────────────────────────────────── */

export function SimpleContainer({ objeto, titulo, config, draw }: ContainerProps) {
  return (
    <Frame titulo={titulo} instance={objeto.instance}>
      <div className="contenedor" data-testid="contenedor-simple">
        <InternalGrid
          panel={objeto.panels?.[0]}
          gridColumns={columnsOf('contenedor-simple', config)}
          draw={draw}
        />
      </div>
    </Frame>
  );
}

/* ── Desplazable ───────────────────────────────────────────────────────────────────────────── */

/** Se desplaza por UN eje. */
export function ScrollableContainer({ objeto, titulo, config, draw }: ContainerProps) {
  const axis: Axis = config?.scrollable?.axis === 'x' ? 'x' : 'y';
  const gridColumns = columnsOf('contenedor-desplazable', config);

  return (
    <Frame titulo={titulo} instance={objeto.instance}>
      <div
        className="contenedor scrollable-container"
        data-testid="contenedor-desplazable"
        data-axis={axis}
        // Una region desplazable tiene que alcanzarse con el teclado (2.1.1). Aqui SIEMPRE lo es
        // —para eso se eligio este contenedor—, asi que la parada de tabulacion no se mide: se pone.
        tabIndex={0}
        role="region"
        aria-label={titulo}
      >
        <div
          className="container__pista"
          // En el eje X la pista mide lo que pidan sus columnas y no se comprime: si se repartiera
          // el ancho visible, no habria nada que desplazar y el contenedor no haria nada.
          style={axis === 'x' ? { minWidth: `${gridColumns * 180}px` } : undefined}
        >
          <InternalGrid panel={objeto.panels?.[0]} gridColumns={gridColumns} draw={draw} />
        </div>
      </div>
    </Frame>
  );
}

/* ── Ampliable ─────────────────────────────────────────────────────────────────────────────── */

/** Ensena parte de su contenido y se amplia a una ventana con SU PROPIA rejilla. */
export function ExpandableContainer({ objeto, titulo, config, draw }: ContainerProps) {
  const t = useTranslator();
  const [ampliado, setAmpliado] = useState(false);
  const gridColumns = columnsOf('contenedor-ampliable', config);
  const expandedColumns = Math.max(1, config?.expandable?.expandedColumns ?? DEFAULT_COLUMN_INTERNAL * 2);

  return (
    <>
      <Frame
        titulo={titulo}
        instance={objeto.instance}
        accion={
          <button
            type="button"
            className="object__addon"
            aria-label={`Ampliar ${titulo}`}
            title={config?.expandable?.textoDeAmpliar ?? 'Ampliar'}
            data-testid="ampliar"
            onClick={() => setAmpliado(true)}
          >
            <Icon nombre="expandir" tamano={16} />
          </button>
        }
      >
        <div className="contenedor" data-testid="contenedor-ampliable">
          <InternalGrid panel={objeto.panels?.[0]} gridColumns={gridColumns} draw={draw} />
        </div>
      </Frame>

      {ampliado ? (
        <div
          className="ampliado"
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          data-testid="ampliado"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setAmpliado(false);
          }}
        >
          <div className="expanded__box">
            <div className="expanded__header">
              <h2>{titulo}</h2>
              <button
                type="button"
                className="boton-contorno"
                data-testid="close-expanded"
                autoFocus
                onClick={() => setAmpliado(false)}
              >
                {t('action.close')}
              </button>
            </div>
            <div className="contenedor container--expanded">
              <InternalGrid
                panel={objeto.panels?.[0]}
                gridColumns={expandedColumns}
                draw={draw}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── Expandible en su sitio ────────────────────────────────────────────────────────────────── */

/**
 * Un chiclet que se abre EN SU SITIO y empuja hacia abajo lo que tiene debajo.
 *
 * No es el ampliable. El ampliable abre una ventana encima: lo de debajo sigue donde estaba y
 * queda tapado. Este crece dentro de la rejilla del modulo, y los objetos que tiene debajo se
 * desplazan para hacerle hueco — que es lo que hace falta cuando lo que se abre es un panel de
 * filtros y hay que seguir viendo lo que filtra.
 *
 * El desplazamiento no lo hace este componente: lo hace la rejilla. Las celdas se colocan con
 * `grid-row: span N` y sin linea de inicio, asi que el navegador las va acomodando en orden; al
 * crecer el `span` de una, las siguientes bajan solas. Lo unico que hay que hacer desde aqui es
 * decir cuantas filas ocupa, y eso viaja hacia arriba en un atributo que la hoja de estilo lee
 * sobre `.grid__cell`. Calcular posiciones a mano habria sido reimplementar la rejilla.
 */
export function ExpandableInPlaceContainer({ objeto, titulo, config, draw }: ContainerProps) {
  const ajustes = config?.expandableInPlace;
  const [abierto, setAbierto] = useState(ajustes?.abiertoAlCargar === true);
  const id = useId();
  const filas = rowsOnExpand(config);
  const filtrado = algoFiltraDentro(objeto, useUrlFilters().searchParams);

  return (
    <div
      className="contenedor-expandible"
      data-testid="contenedor-expandible"
      // Lo lee la hoja de estilo sobre la celda que lo contiene, con `:has()`. Es lo que convierte
      // «este contenedor esta abierto» en «esta celda ocupa mas filas».
      data-expandido={abierto ? 'si' : 'no'}
      style={{ '--filas-al-expandir': filas } as React.CSSProperties}
    >
      {/*
        Plegado, el chiclet dice SI HAY algo elegido dentro.

        Un chiclet cerrado tapa lo que lleva: si dentro hay un filtro con «Penal» puesto, las
        cifras de alrededor estan recortadas y en la pantalla no queda ni una senal de por que.
        Con el color puesto, se ve antes de abrirlo.

        El color no es lo unico que lo dice: `aria-pressed` lleva la misma informacion para quien
        no lo ve, que es lo que pide 4.9.
      */}
      <button
        type="button"
        className="chiclet"
        aria-expanded={abierto}
        aria-pressed={filtrado}
        aria-controls={`${id}-panel`}
        data-filtrado={filtrado ? 'si' : 'no'}
        data-testid="chiclet"
        onClick={() => setAbierto((previo) => !previo)}
      >
        <Icon nombre="filtro" tamano={16} />
        <span className="chiclet__rotulo">{ajustes?.rotulo?.trim() || titulo}</span>
        {/*
          El chevron gira, no se cambia por otro icono: girar dice que es el MISMO control en otro
          estado. `aria-expanded` ya lo cuenta, asi que el icono se esconde del lector de pantalla
          en vez de anunciarse dos veces.
        */}
        <span className="chiclet__chevron" aria-hidden="true">
          <Icon nombre="chevron-abajo" tamano={16} />
        </span>
      </button>

      {/*
        El panel se OCULTA con `hidden`, no se desmonta.
        Desmontarlo tiraria lo que alguien hubiera escrito en un campo del contenido al plegarlo,
        que en un panel de filtros es justo lo que no puede pasar.
      */}
      <div id={`${id}-panel`} className="contenedor-expandible__panel" hidden={!abierto}>
        <InternalGrid
          panel={objeto.panels?.[0]}
          gridColumns={columnsOf('contenedor-expandible', config)}
          draw={draw}
        />
      </div>
    </div>
  );
}

/* ── Con pestanas ──────────────────────────────────────────────────────────────────────────── */

/** Varias pestanas, cada una con su contenido y su disposicion. */
export function TabContainer({ objeto, titulo, config, draw }: ContainerProps) {
  const panels = objeto.panels ?? [];
  const initial = config?.tabs?.initialTab;
  const [activa, setActiva] = useState(
    panels.some((p) => p.panelId === initial) ? (initial as string) : (panels[0]?.panelId ?? ''),
  );
  const gridColumns = columnsOf('contenedor-con-pestanas', config);
  const id = useId();

  return (
    <Frame titulo={titulo} instance={objeto.instance}>
      <div className="contenedor tab-container" data-testid="contenedor-con-pestanas">
        <div className="container__tabs" role="tablist" aria-label={titulo}>
          {panels.map((panel) => (
            <button
              key={panel.panelId}
              type="button"
              role="tab"
              id={`${id}-${panel.panelId}`}
              aria-selected={activa === panel.panelId}
              aria-controls={`${id}-panel-${panel.panelId}`}
              // Solo la pestana activa esta en el orden de tabulacion: dentro de un `tablist` se
              // cambia con las flechas, no tabulando una por una.
              tabIndex={activa === panel.panelId ? 0 : -1}
              className="container__tab"
              data-testid={`tab-${panel.panelId}`}
              onClick={() => setActiva(panel.panelId)}
              onKeyDown={(e) => {
                const i = panels.findIndex((p) => p.panelId === activa);
                const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (salto === 0) return;
                e.preventDefault();
                const destino = panels[(i + salto + panels.length) % panels.length];
                if (destino) setActiva(destino.panelId);
              }}
            >
              {panel.nombre}
            </button>
          ))}
        </div>

        {panels.map((panel) => (
          <div
            key={panel.panelId}
            id={`${id}-panel-${panel.panelId}`}
            role="tabpanel"
            aria-labelledby={`${id}-${panel.panelId}`}
            className="container__panel"
            hidden={activa !== panel.panelId}
          >
            <InternalGrid panel={panel} gridColumns={gridColumns} draw={draw} />
          </div>
        ))}
      </div>
    </Frame>
  );
}
