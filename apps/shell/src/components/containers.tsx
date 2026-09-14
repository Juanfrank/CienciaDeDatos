'use client';

import { useId, useState } from 'react';
import {
  type ContainerSettings,
  type Axis,
  COLUMNAS_INTERNAS_POR_DEFECTO,
  columnsOf,
} from '@app/ui-components';
import { Icon } from './icons/Icon';
import { Frame } from './objects';
import type { ObjetoSerializado, PanelSerializado } from '../server/serializar';

/** Los contenedores: objetos que llevan otros objetos dentro. */

/** La rejilla interna. La misma para los cinco: un contenedor es una rejilla con una cabecera. */
function RejillaInterna({
  panel,
  gridColumns,
  draw,
}: {
  panel: PanelSerializado | undefined;
  gridColumns: number;
  draw: (objeto: ObjetoSerializado) => React.ReactNode;
}) {
  const items = panel?.objetos ?? [];

  if (items.length === 0) {
    return (
      <p className="container__empty" data-testid="empty-container">
        Sin contenido. Arrastre objetos aqui desde el panel.
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

interface PropsDeContenedor {
  objeto: ObjetoSerializado;
  titulo: string;
  config: ContainerSettings | undefined;
  draw: (hijo: ObjetoSerializado) => React.ReactNode;
}

/* ── Simple ────────────────────────────────────────────────────────────────────────────────── */

export function SimpleContainer({ objeto, titulo, config, draw }: PropsDeContenedor) {
  return (
    <Frame titulo={titulo} instance={objeto.instance}>
      <div className="contenedor" data-testid="contenedor-simple">
        <RejillaInterna
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
export function ScrollableContainer({ objeto, titulo, config, draw }: PropsDeContenedor) {
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
          <RejillaInterna panel={objeto.panels?.[0]} gridColumns={gridColumns} draw={draw} />
        </div>
      </div>
    </Frame>
  );
}

/* ── Ampliable ─────────────────────────────────────────────────────────────────────────────── */

/** Ensena parte de su contenido y se amplia a una ventana con SU PROPIA rejilla. */
export function ExpandableContainer({ objeto, titulo, config, draw }: PropsDeContenedor) {
  const [ampliado, setAmpliado] = useState(false);
  const gridColumns = columnsOf('contenedor-ampliable', config);
  const columnasAmpliado = Math.max(1, config?.expandable?.columnasAmpliado ?? COLUMNAS_INTERNAS_POR_DEFECTO * 2);

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
          <RejillaInterna panel={objeto.panels?.[0]} gridColumns={gridColumns} draw={draw} />
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
          <div className="ampliado__box">
            <div className="ampliado__header">
              <h2>{titulo}</h2>
              <button
                type="button"
                className="boton-contorno"
                data-testid="cerrar-ampliado"
                autoFocus
                onClick={() => setAmpliado(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="contenedor contenedor--ampliado">
              <RejillaInterna
                panel={objeto.panels?.[0]}
                gridColumns={columnasAmpliado}
                draw={draw}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ── Con pestanas ──────────────────────────────────────────────────────────────────────────── */

/** Varias pestanas, cada una con su contenido y su disposicion. */
export function TabContainer({ objeto, titulo, config, draw }: PropsDeContenedor) {
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
            <RejillaInterna panel={panel} gridColumns={gridColumns} draw={draw} />
          </div>
        ))}
      </div>
    </Frame>
  );
}
