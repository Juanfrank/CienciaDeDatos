'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { QueryResult } from '@app/data-contracts';
import { effectivePickers, type IconName, type ObjectInstance } from '@app/ui-components';
import {
  NAVIGATOR_IS_PANEL,
  type PageNavigatorSettings,
  type PanelBehavior,
} from '@app/module-model';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useTranslator } from './Locale';
import { FieldPicker, optionsOf } from './FiltersPanel';
import { Icon } from './icons/Icon';

/**
 * Navegador de pagina — como se pasa de una pagina de un modulo a otra (4.2).
 *
 * Cuatro formas de lo mismo, y la eleccion no es de gusto: un panel lateral se lee de un vistazo y
 * cuesta ancho; unas pestanas debajo no cuestan ancho pero se pierden con muchas paginas; un menu
 * ocupa una linea sea cual sea el numero. Por eso se elige por modulo y no hay un unico acierto.
 *
 * Las paginas son ENLACES, no botones que cambian un estado local: cada pagina tiene su URL
 * (4.11), asi que se puede marcar, compartir y abrir en otra pestana, y el boton de atras del
 * navegador hace lo que se espera. Un navegador de estado local se lleva por delante las tres
 * cosas sin que nadie lo pida.
 */
export interface PaginaNavegable {
  slug: string;
  name: string;
  icon?: string;
}

export function PageNavigator({
  navegador,
  paginas,
  moduleSlug,
  actual,
  filtros,
  embedded,
}: {
  navegador: PageNavigatorSettings;
  paginas: PaginaNavegable[];
  moduleSlug: string;
  /** El slug de la pagina abierta, para marcarla. */
  actual: string;
  /** La seccion de filtros del panel, ya leida por el servidor. */
  filtros?: { instance: ObjectInstance; result: QueryResult; titulo: string };
  /**
   * El cromo de la vista incrustada, si se dibuja dentro de un marco.
   *
   * Cambia A DONDE apuntan los enlaces, que es lo unico que no puede salir mal aqui: dentro de un
   * iframe, un enlace a `/m/...` se llevaria la aplicacion entera al hueco del portal anfitrion —
   * exactamente lo que la vista incrustada existe para no hacer—. Ir de una pagina a otra del
   * mismo modulo es moverse dentro de lo que se incrusto, y eso si.
   */
  embedded?: 'completo' | 'limpio';
}) {
  const t = useTranslator();
  const comportamiento: PanelBehavior = navegador.comportamiento ?? 'grilla';
  // Un drawer empieza abierto: plegado por defecto esconde la navegacion entera a quien entra por
  // primera vez, que es justo cuando mas falta hace saber que hay mas paginas.
  const [abierto, setAbierto] = useState(true);

  const hrefDe = (slug: string) =>
    embedded
      ? `/embed/m/${moduleSlug}?pagina=${slug}${embedded === 'limpio' ? '&cromo=limpio' : ''}`
      : `/m/${moduleSlug}/${slug}`;

  const enlaces = (
    <ul className="navegador__paginas">
      {paginas.map((pagina) => {
        const es = pagina.slug === actual;
        return (
          <li key={pagina.slug}>
            <Link
              href={hrefDe(pagina.slug)}
              /*
                Sin PREFETCH, y no es una micro-optimizacion.
                Cada pagina de un modulo es un render dinamico entero: resuelve ambito, lee el
                cache de cada objeto y los proyecta. Un navegador de once paginas que las precargue
                todas al aparecer dispara once de esos renders para usar uno — y en la vista
                incrustada, donde las once comparten ruta y solo cambia la query, el navegador los
                lanza a la vez y se queda sin recursos antes de terminar de dibujar.
              */
              prefetch={false}
              className={`navegador__pagina ${es ? 'is-active' : ''}`}
              {...(es ? { 'aria-current': 'page' as const } : {})}
              data-testid={`nav-pagina-${pagina.slug}`}
            >
              {pagina.icon ? <Icon nombre={pagina.icon as IconName} tamano={18} /> : null}
              <span>{pagina.name}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (!NAVIGATOR_IS_PANEL(navegador.tipo)) {
    return (
      <nav
        className={`navegador navegador--${navegador.tipo}`}
        aria-label={t('nav.pages')}
        data-testid="navegador-de-pagina"
        data-tipo={navegador.tipo}
      >
        {navegador.tipo === 'menu' ? (
          /*
            El menu es un `<details>` y no un desplegable hecho a mano.
            Abre y cierra con teclado, lo anuncia un lector de pantalla y no necesita ni una linea
            de JavaScript. Un div con `onClick` habria que volver a ensenarle las tres cosas.
          */
          <details className="navegador__menu" data-testid="navegador-menu">
            <summary>
              {paginas.find((p) => p.slug === actual)?.name ?? t('nav.pages')}
              <Icon nombre="expandir" tamano={16} />
            </summary>
            {enlaces}
          </details>
        ) : (
          enlaces
        )}
      </nav>
    );
  }

  return (
    <nav
      className={`navegador navegador--panel navegador--${navegador.tipo}`}
      aria-label={t('nav.pages')}
      data-testid="navegador-de-pagina"
      data-tipo={navegador.tipo}
      data-comportamiento={comportamiento}
      data-abierto={abierto ? 'si' : 'no'}
    >
      {/*
        El boton de plegar existe SOLO donde puede hacer algo.
        En `grilla` el panel es fijo por definicion: un boton que no pliega nada es peor que no
        tenerlo, porque quien lo pulsa cree que se rompio.
      */}
      {comportamiento === 'grilla' ? null : (
        <button
          type="button"
          className="navegador__plegar"
          aria-expanded={abierto}
          aria-label={abierto ? t('nav.fold') : t('nav.unfold')}
          data-testid="navegador-plegar"
          onClick={() => setAbierto((previo) => !previo)}
        >
          <Icon nombre="sandwich" tamano={18} />
        </button>
      )}

      <div className="navegador__contenido" {...(abierto ? {} : { hidden: true })}>
        {enlaces}
        {filtros ? <SeccionDeFiltros {...filtros} /> : null}
      </div>
    </nav>
  );
}

/**
 * La seccion de filtros del panel, con los MISMOS controles que el objeto «Panel de filtros».
 *
 * No es una copia: importa `FieldPicker` y `optionsOf` de alli. Si tuviera los suyos, un rango de
 * fechas se comportaria distinto segun estuviera en el panel o en el lienzo, y nadie lo habria
 * decidido — es la clase de diferencia que aparece sola y no se descubre hasta que alguien
 * compara las dos pantallas.
 */
function SeccionDeFiltros({
  instance,
  result,
  titulo,
}: {
  instance: ObjectInstance;
  result: QueryResult;
  titulo: string;
}) {
  const t = useTranslator();
  const { valuesOf, toggle, clearField, fijar, searchParams, clearAll } = useUrlFilters();
  const fieldKinds = Object.fromEntries(result.columns.map((c) => [c.name, c.type]));
  const pickers = effectivePickers(
    instance,
    instance.settings?.objectId === 'panel-de-filtros' ? instance.settings : undefined,
    fieldKinds,
  );

  const FROM = (fieldName: string) => `${fieldName}.desde`;
  const HASTA = (fieldName: string) => `${fieldName}.hasta`;

  return (
    <section className="navegador__filtros" data-testid="navegador-filtros">
      <div className="navegador__filtros-cabecera">
        <h2>{titulo}</h2>
        <button
          type="button"
          className="boton-contorno"
          data-testid="navegador-filtros-limpiar"
          onClick={() => clearAll()}
        >
          {t('nav.clear')}
        </button>
      </div>

      {pickers.map((picker) => (
        <FieldPicker
          key={picker.fieldName}
          picker={picker}
          opciones={optionsOf(result, picker.fieldName)}
          valores={valuesOf(picker.fieldName)}
          desde={searchParams.get(FROM(picker.fieldName)) ?? ''}
          hasta={searchParams.get(HASTA(picker.fieldName)) ?? ''}
          onAlternar={(valor) => toggle(picker.fieldName, valor)}
          onFijar={(valor) => fijar(picker.fieldName, valor)}
          onFijarFecha={(cual, valor) =>
            fijar(cual === 'desde' ? FROM(picker.fieldName) : HASTA(picker.fieldName), valor)
          }
          onLimpiar={() => {
            clearField(picker.fieldName);
            clearField(FROM(picker.fieldName));
            clearField(HASTA(picker.fieldName));
          }}
        />
      ))}
    </section>
  );
}
