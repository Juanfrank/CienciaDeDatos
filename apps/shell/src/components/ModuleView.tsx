'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useTranslator } from './Locale';
import { CreateNotice, type WatchableObject } from './CreateNotice';
import { Export } from './Export';
import { Embed } from './Embed';
import { ProvenanceBadge } from './ProvenanceBadge';
import { Ask } from './Ask';
import { Bookmarks } from './Bookmarks';
import { MyView } from './MyView';
import { ModuleObject } from './ModuleObject';
import { DrillTargetsProvider } from './ObjectView';
import { Grid } from './Grid';
import { IconButton } from './icons/IconButton';
import { IconLink } from './icons/IconLink';
import { Reorganizar } from './Reorganizar';
import { moduleOptionOn, type GridPosition, type ModuleDefinition } from '@app/module-model';
import type { SerializedObject } from '../server/serialize';
import { motivoDeFallo, pedir } from './pedir';

/** Interruptor de la consulta en lenguaje natural (4.9). */
const VISIBLE_QUERY = false;

/** Vista de un modulo. */
export function ModuleView({
  objetos,
  provenance,
  insignias,
  moduleSlug,
  pageSlug,
  options,
  embedded = false,
  administracion,
  drillTargets,
}: {
  objetos: SerializedObject[];
  provenance: { isPersonalized: boolean; label: string };
  /** Las insignias de procedencia y ambito, ya renderizadas en el servidor. */
  insignias?: React.ReactNode;
  moduleSlug: string;
  pageSlug?: string;
  /*
   * Lo que este modulo ofrece, decidido en su configuracion.
   *
   * Viaja desde el servidor y se pregunta con `moduleOptionOn`, que trata «ausente» como
   * encendido: leyendo `options.marcadores` a secas, un modulo que nunca se configuro se quedaria
   * sin marcadores — y eso son todos los que hay hoy.
   */
  options?: ModuleDefinition['options'];
  /** true cuando la vista se dibuja dentro del portal de otra institucion (4.9). */
  embedded?: boolean;
  /**
   * Las pantallas de gestion de ESTE modulo a las que quien mira tiene permiso.
   *
   * Las decide el servidor y llegan ya resueltas: si el cliente decidiera que puede administrar,
   * estaria escondiendo un enlace en vez de proteger una ruta, y ocultar no es proteger. Lo que
   * de verdad guarda cada destino es su propia puerta.
   */
  administracion?: { editar?: string; configuracion?: string; permisos?: string };
  /**
   * Los modulos a los que los saltos de esta pagina llevan a QUIEN MIRA, de slug a nombre (4.4).
   *
   * Los decide el servidor. Si el cliente decidiera a que alcanza una persona, un salto a un
   * modulo no concedido se dibujaria igual y la pagina de destino lo rechazaria al llegar: una
   * puerta cerrada anunciada como abierta es peor que no anunciarla.
   */
  drillTargets?: Record<string, string>;
}) {
  const ofrece = (opcion: Parameters<typeof moduleOptionOn>[1]) =>
    moduleOptionOn({ ...(options ? { options } : {}) }, opcion);
  const t = useTranslator();
  const { toggle, clearAll, searchParams } = useUrlFilters();
  const filtersHas = [...searchParams.keys()].length > 0;

  /*
   * Colocar los objetos en la propia vista — 4.6, apartado 2.2.
   *
   * El estado arranca de las posiciones que YA se estan viendo, que son las institucionales con la
   * personalizacion aplicada. Partir de las institucionales habria hecho que abrir el modo
   * deshiciera de golpe una colocacion anterior, sin tocar nada.
   */
  const router = useRouter();
  const [colocando, setColocando] = useState(false);
  const [posiciones, setPosiciones] = useState<Record<string, GridPosition>>({});
  const [errorAlColocar, setErrorAlColocar] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardarPosiciones = async () => {
    setErrorAlColocar('');
    setGuardando(true);
    try {
      /*
       * Se manda la disposicion ENTERA, no solo lo que se movio.
       *
       * Un objeto que no se toco tiene la posicion que se esta viendo, y esa ya puede venir de una
       * colocacion anterior. Mandando solo lo movido, el servidor conservaria las de antes para
       * todo lo demas —que es lo mismo— salvo si el modulo institucional cambio entretanto: ahi
       * la vista guardada y la que se acaba de ver dejarian de coincidir sin que nadie lo pidiera.
       */
      const cuerpo = Object.fromEntries(
        objetos.map((o) => [o.itemId, posiciones[o.itemId] ?? o.position]),
      );
      const r = await pedir(`/api/modules/${moduleSlug}/view`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ posiciones: cuerpo }),
      });
      if (!r || !r.ok) {
        setErrorAlColocar(await motivoDeFallo(r, t('module.place.failed')));
        return;
      }
      setColocando(false);
      setPosiciones({});
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  const items = objetos.map((o) => ({ id: o.itemId, position: o.position }));

  // Solo se puede vigilar lo que tiene una cifra. Un segmentador mapea dimensiones y ninguna
  // medida: ofrecerlo daria una alerta que no puede dispararse nunca.
  const vigilables: WatchableObject[] = objetos
    .filter((o) => o.instance.binding.measures.length > 0 && o.result)
    .map((o) => ({
      instanceId: o.instance.instanceId,
      titulo: o.titulo,
      measures: o.instance.binding.measures,
    }));

  const byId = new Map(objetos.map((o) => [o.itemId, o]));

  return (
    /*
      Los destinos bajan por contexto y se ponen UNA vez aqui.

      El marco de un objeto lo dibujan los dieciseis renderizadores, y pasarlos de mano en mano
      seria tocarlos todos y confiar en que ninguno se olvide: el que se olvidara dejaria un objeto
      con su salto configurado y sin ofrecerlo, que es la forma de fallar que no se nota.
    */
    <DrillTargetsProvider value={drillTargets ?? {}}>
      {/*
        La consulta en lenguaje natural queda FUERA de la vista mientras no responda de verdad.

        El campo esta construido y su ruta funciona, pero lo que devuelve todavia no es una
        respuesta util, y un campo de busqueda visible es una promesa: quien lo ve escribe en el.
        Se retira de la pagina, no del repositorio — `VISIBLE_QUERY` es lo unico que hay que
        cambiar cuando la funcionalidad este.
      */}
      {VISIBLE_QUERY && !embedded ? <Ask moduleSlug={moduleSlug} /> : null}

      {/*
        Una sola fila: de donde salen los datos, y que se puede hacer con ellos.

        Las insignias dicen que se esta viendo y los iconos que se puede hacer con ello. Estaban
        en dos lineas seguidas, cada una con su propio ritmo vertical, para tres elementos y cinco
        botones; en una sola fila con la divisoria debajo se lee como lo que es, la cabecera de
        los datos.

        `role="toolbar"` envuelve SOLO los botones, no las insignias: una barra de herramientas se
        anuncia por su numero de elementos, y meter dentro dos etiquetas que no se pulsan la
        convierte en un grupo de siete cosas de las que dos no hacen nada.
      */}
      {embedded ? null : (
        <div className="module-bar">
          {insignias}

          <div className="module-bar__actions" role="toolbar" aria-label={t('module.actions')}>
            {ofrece('personalizacion') ? (
              <>
                <MyView moduleSlug={moduleSlug} personalizada={provenance.isPersonalized} />
                {/*
                  Colocar es un gesto sobre el LIENZO, no una casilla en un dialogo: se hace
                  mirando el modulo y viendo donde cae cada cosa. Por eso entra desde aqui y no
                  desde «Mi vista», que es donde se decide QUE se ve, no donde.
                */}
                <IconButton
                  icono="mover"
                  etiqueta={t('module.place')}
                  presionado={colocando}
                  data-testid="colocar"
                  onClick={() => {
                    setErrorAlColocar('');
                    setColocando((antes) => !antes);
                  }}
                />
              </>
            ) : null}
            {ofrece('marcadores') ? (
              <Bookmarks moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            ) : null}
            {ofrece('exportacion') ? (
              <Export moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            ) : null}
            {ofrece('alertas') ? (
              <CreateNotice
                moduleSlug={moduleSlug}
                {...(pageSlug ? { pageSlug } : {})}
                vigilables={vigilables}
              />
            ) : null}
            {ofrece('embebido') ? (
              <Embed moduleSlug={moduleSlug} {...(pageSlug ? { pageSlug } : {})} />
            ) : null}

            {/*
              Lo de ADMINISTRAR el modulo, separado de lo que se hace con sus datos.

              Van aqui y no solo en el panel de administracion porque es donde se descubre que
              hacen falta: se esta mirando el modulo, se ve que un objeto sobra o que el nombre
              esta mal, y buscarlo otra vez desde una tabla de treinta filas para cambiarlo es un
              rodeo que nadie da — lo que se hace es dejarlo como esta.

              Llevan a la MISMA pantalla que el panel, no a una copia: un segundo formulario de
              configuracion seria un segundo sitio donde arreglar el dia que algo cambie.
            */}
            {administracion ? (
              <span className="module-bar__gestion">
                {administracion.editar ? (
                  <IconLink
                    icono="editar"
                    etiqueta="Editar el modulo"
                    href={administracion.editar}
                    data-testid="modulo-editar"
                  />
                ) : null}
                {administracion.configuracion ? (
                  <IconLink
                    icono="tuerca"
                    etiqueta="Configuracion del modulo"
                    href={administracion.configuracion}
                    data-testid="modulo-configuracion"
                  />
                ) : null}
                {administracion.permisos ? (
                  <IconLink
                    icono="llave"
                    etiqueta="Permisos del modulo"
                    href={administracion.permisos}
                    data-testid="modulo-permisos"
                  />
                ) : null}
              </span>
            ) : null}
          </div>

          {filtersHas ? (
            <button
              type="button"
              className="button-link module-bar__clear"
              data-testid="clear-filters"
              onClick={clearAll}
            >
              {t('module.clearFilters')}
            </button>
          ) : null}
        </div>
      )}

      {/*
        Dentro de un portal ajeno no hay cabecera de modulo donde ponerla, asi que la procedencia
        se dibuja aqui. Es lo unico de esta barra que sobrevive a la incrustacion: 4.6 pide que se
        sepa siempre si lo que se ve es la vista institucional.
      */}
      {embedded ? (
        <div className="status-bar">
          <ProvenanceBadge provenance={provenance} />
        </div>
      ) : null}

      {colocando ? (
        <>
          <div className="module-bar module-bar--colocando">
            <p className="muted-text">{t('module.place.intro')}</p>
            <div className="module-bar__actions">
              <button
                type="button"
                className="pastilla"
                data-testid="colocar-guardar"
                disabled={guardando}
                onClick={() => void guardarPosiciones()}
              >
                {t('module.place.save')}
              </button>
              <button
                type="button"
                className="button-link"
                data-testid="colocar-cancelar"
                disabled={guardando}
                onClick={() => {
                  setPosiciones({});
                  setErrorAlColocar('');
                  setColocando(false);
                }}
              >
                {t('action.cancel')}
              </button>
            </div>
          </div>

          {errorAlColocar ? (
            <p className="aviso-error" role="alert" data-testid="colocar-error">
              {errorAlColocar}
            </p>
          ) : null}

          <Reorganizar
            objetos={objetos}
            posiciones={posiciones}
            onColocar={(itemId, position) =>
              setPosiciones((actuales) => ({ ...actuales, [itemId]: position }))
            }
          />
        </>
      ) : (
        <Grid items={items}>
          {(id) => {
            const objeto = byId.get(id);
            if (!objeto) return null;
            return <ModuleObject objeto={objeto} onFiltrar={toggle} />;
          }}
        </Grid>
      )}
    </DrillTargetsProvider>
  );
}
