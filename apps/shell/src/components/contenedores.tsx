'use client';

import { useId, useState } from 'react';
import {
  type ConfiguracionDeContenedor,
  type Eje,
  COLUMNAS_INTERNAS_POR_DEFECTO,
  columnasDe,
} from '@app/ui-components';
import { Icono } from './iconos/Icono';
import { Marco } from './objetos';
import type { ObjetoSerializado, PanelSerializado } from '../server/serializar';

/** Los contenedores: objetos que llevan otros objetos dentro. */

/** La rejilla interna. La misma para los cinco: un contenedor es una rejilla con una cabecera. */
function RejillaInterna({
  panel,
  columnas,
  dibujar,
}: {
  panel: PanelSerializado | undefined;
  columnas: number;
  dibujar: (objeto: ObjetoSerializado) => React.ReactNode;
}) {
  const items = panel?.objetos ?? [];

  if (items.length === 0) {
    return (
      <p className="contenedor__vacio" data-testid="contenedor-vacio">
        Sin contenido. Arrastre objetos aqui desde el panel.
      </p>
    );
  }

  return (
    <div
      className="contenedor__rejilla"
      style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
    >
      {items.map((objeto) => (
        <div
          key={objeto.itemId}
          className="contenedor__celda"
          style={{
            gridColumn: `${objeto.position.x + 1} / span ${objeto.position.w}`,
            gridRow: `${objeto.position.y + 1} / span ${objeto.position.h}`,
          }}
        >
          {dibujar(objeto)}
        </div>
      ))}
    </div>
  );
}

interface PropsDeContenedor {
  objeto: ObjetoSerializado;
  titulo: string;
  config: ConfiguracionDeContenedor | undefined;
  dibujar: (hijo: ObjetoSerializado) => React.ReactNode;
}

/* ── Simple ────────────────────────────────────────────────────────────────────────────────── */

export function ContenedorSimple({ objeto, titulo, config, dibujar }: PropsDeContenedor) {
  return (
    <Marco titulo={titulo} instance={objeto.instance}>
      <div className="contenedor" data-testid="contenedor-simple">
        <RejillaInterna
          panel={objeto.paneles?.[0]}
          columnas={columnasDe('contenedor-simple', config)}
          dibujar={dibujar}
        />
      </div>
    </Marco>
  );
}

/* ── Desplazable ───────────────────────────────────────────────────────────────────────────── */

/** Se desplaza por UN eje. */
export function ContenedorDesplazable({ objeto, titulo, config, dibujar }: PropsDeContenedor) {
  const eje: Eje = config?.desplazable?.eje === 'x' ? 'x' : 'y';
  const columnas = columnasDe('contenedor-desplazable', config);

  return (
    <Marco titulo={titulo} instance={objeto.instance}>
      <div
        className="contenedor contenedor--desplazable"
        data-testid="contenedor-desplazable"
        data-eje={eje}
        // Una region desplazable tiene que alcanzarse con el teclado (2.1.1). Aqui SIEMPRE lo es
        // —para eso se eligio este contenedor—, asi que la parada de tabulacion no se mide: se pone.
        tabIndex={0}
        role="region"
        aria-label={titulo}
      >
        <div
          className="contenedor__pista"
          // En el eje X la pista mide lo que pidan sus columnas y no se comprime: si se repartiera
          // el ancho visible, no habria nada que desplazar y el contenedor no haria nada.
          style={eje === 'x' ? { minWidth: `${columnas * 180}px` } : undefined}
        >
          <RejillaInterna panel={objeto.paneles?.[0]} columnas={columnas} dibujar={dibujar} />
        </div>
      </div>
    </Marco>
  );
}

/* ── Ampliable ─────────────────────────────────────────────────────────────────────────────── */

/** Ensena parte de su contenido y se amplia a una ventana con SU PROPIA rejilla. */
export function ContenedorAmpliable({ objeto, titulo, config, dibujar }: PropsDeContenedor) {
  const [ampliado, setAmpliado] = useState(false);
  const columnas = columnasDe('contenedor-ampliable', config);
  const columnasAmpliado = Math.max(1, config?.ampliable?.columnasAmpliado ?? COLUMNAS_INTERNAS_POR_DEFECTO * 2);

  return (
    <>
      <Marco
        titulo={titulo}
        instance={objeto.instance}
        accion={
          <button
            type="button"
            className="objeto__complemento"
            aria-label={`Ampliar ${titulo}`}
            title={config?.ampliable?.textoDeAmpliar ?? 'Ampliar'}
            data-testid="ampliar"
            onClick={() => setAmpliado(true)}
          >
            <Icono nombre="expandir" tamano={16} />
          </button>
        }
      >
        <div className="contenedor" data-testid="contenedor-ampliable">
          <RejillaInterna panel={objeto.paneles?.[0]} columnas={columnas} dibujar={dibujar} />
        </div>
      </Marco>

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
          <div className="ampliado__caja">
            <div className="ampliado__cabecera">
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
                panel={objeto.paneles?.[0]}
                columnas={columnasAmpliado}
                dibujar={dibujar}
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
export function ContenedorConPestanas({ objeto, titulo, config, dibujar }: PropsDeContenedor) {
  const paneles = objeto.paneles ?? [];
  const inicial = config?.pestanas?.pestanaInicial;
  const [activa, setActiva] = useState(
    paneles.some((p) => p.panelId === inicial) ? (inicial as string) : (paneles[0]?.panelId ?? ''),
  );
  const columnas = columnasDe('contenedor-con-pestanas', config);
  const id = useId();

  return (
    <Marco titulo={titulo} instance={objeto.instance}>
      <div className="contenedor contenedor--pestanas" data-testid="contenedor-con-pestanas">
        <div className="contenedor__pestanas" role="tablist" aria-label={titulo}>
          {paneles.map((panel) => (
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
              className="contenedor__pestana"
              data-testid={`pestana-${panel.panelId}`}
              onClick={() => setActiva(panel.panelId)}
              onKeyDown={(e) => {
                const i = paneles.findIndex((p) => p.panelId === activa);
                const salto = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (salto === 0) return;
                e.preventDefault();
                const destino = paneles[(i + salto + paneles.length) % paneles.length];
                if (destino) setActiva(destino.panelId);
              }}
            >
              {panel.nombre}
            </button>
          ))}
        </div>

        {paneles.map((panel) => (
          <div
            key={panel.panelId}
            id={`${id}-panel-${panel.panelId}`}
            role="tabpanel"
            aria-labelledby={`${id}-${panel.panelId}`}
            className="contenedor__panel"
            hidden={activa !== panel.panelId}
          >
            <RejillaInterna panel={panel} columnas={columnas} dibujar={dibujar} />
          </div>
        ))}
      </div>
    </Marco>
  );
}
