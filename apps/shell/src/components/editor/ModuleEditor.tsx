'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type {
  GridItem,
  ModuleDefinition,
  ModuleDiagnostics,
  PublishBlocker,
} from '@app/module-model';
import { findFreeSlot } from '@app/module-model';
import { defaultSize, initialSettings } from '@app/ui-components';
import type { EditorPalette } from '../../server/editor';
import type { SerializedObject } from '../../server/serialize';
import { EditorHeader } from './EditorHeader';
import { Canvas } from './Canvas';
import { SidebarPanel } from './SidebarPanel';
import { useTranslator } from '../Locale';

/*
 * Lo que espera el autoguardado antes de escribir.
 *
 * Suficiente para que una rafaga de gestos —arrastrar, teclear un titulo— sea UNA escritura, y
 * poco para que nadie llegue a cerrar la pestana creyendo que lo suyo se perdio.
 */
const MS_AUTOGUARDADO = 800;

/** Editor de un modulo — seccion 4.2. */
export function ModuleEditor({
  initial,
  objetosIniciales,
  diagnosticos,
  locks,
  palette,
  editable,
  puedePublicar,
}: {
  initial: ModuleDefinition;
  objetosIniciales: SerializedObject[];
  diagnosticos: ModuleDiagnostics;
  locks: PublishBlocker[];
  palette: EditorPalette;
  editable: boolean;
  /** Si quien mira puede aprobar. Lo decide el servidor, no el componente. */
  puedePublicar: boolean;
}) {
  const router = useRouter();
  const t = useTranslator();
  const [modulo, setModulo] = useState(initial);
  const [objetos, setObjetos] = useState(objetosIniciales);
  const [diag, setDiag] = useState(diagnosticos);
  const [bloq, setBloq] = useState(locks);
  const [selection, setSeleccion] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setGuardando] = useState(false);
  const [dibujando, setDibujando] = useState(false);

  /*
   * El borrador VIVE aqui, y ademas se guarda solo.
   *
   * `paginas` es lo que se esta editando; `modulo.pages` es lo ultimo que acepto el servidor. Que
   * el borrador viva en el cliente es lo que permite dibujar sin escribir; que se guarde solo es
   * lo que impide perder una tarde de trabajo al cerrar una pestana.
   *
   * `puntoDeRetorno` es como estaba el modulo al abrir el editor. Es lo que «descartar» deshace:
   * con autoguardado, «volver a lo ultimo guardado» no significaria nada —lo ultimo guardado es
   * lo que hay en pantalla un segundo despues de cada gesto—, mientras que «deshacer todo lo que
   * he hecho en esta sesion» si es una pregunta que alguien se hace de verdad.
   */
  const [paginas, setPaginas] = useState<ModuleDefinition['pages']>(modulo.pages);
  const [puntoDeRetorno] = useState<ModuleDefinition['pages']>(initial.pages);
  const sucio = JSON.stringify(paginas) !== JSON.stringify(modulo.pages);
  const desviado = JSON.stringify(paginas) !== JSON.stringify(puntoDeRetorno);

  const pagina = paginas[0];
  const items = pagina?.items ?? [];
  const chosen = items.find((i) => i.id === selection) ?? null;

  // Escape deselecciona, como en cualquier editor de bloques. Va en el documento y no en el
  // lienzo porque el foco suele estar en el panel cuando hace falta.
  useEffect(() => {
    const clickTo = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSeleccion(null);
    };
    document.addEventListener('keydown', clickTo);
    return () => document.removeEventListener('keydown', clickTo);
  }, []);

  /**
   * Dibuja lo que hay en el borrador, sin guardarlo.
   *
   * El lienzo se dibujaba con lo que devolvia el guardado: el dibujo era un efecto secundario de
   * escribir. Separadas las dos cosas, hace falta pedir el dibujo aparte — y esa llamada no
   * escribe nada, asi que puede correr en cada cambio sin que nadie pierda nada.
   */
  const dibujar = useCallback(
    async (cuales: ModuleDefinition['pages']) => {
      setDibujando(true);
      try {
        const r = await fetch(`/api/modules/${modulo.slug}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ paginas: cuales }),
        });
        if (!r.ok) return;
        const body = (await r.json()) as {
          diagnosticos: ModuleDiagnostics;
          locks: PublishBlocker[];
          objetos: SerializedObject[];
        };
        setDiag(body.diagnosticos);
        setBloq(body.locks);
        setObjetos(body.objetos);
      } finally {
        setDibujando(false);
      }
    },
    [modulo.slug],
  );

  /** Cambia el borrador y redibuja. No escribe. */
  const editar = useCallback(
    (cuales: ModuleDefinition['pages']) => {
      setPaginas(cuales);
      void dibujar(cuales);
    },
    [dibujar],
  );

  const guardar = useCallback(
    async (cuales: ModuleDefinition['pages']) => {
      setError('');
      setGuardando(true);
      try {
        const r = await fetch(`/api/modules/${modulo.slug}/edit`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ paginas: cuales }),
        });
        if (!r.ok) {
          /*
           * El cuerpo de un error puede no ser JSON.
           */
          const body = await r.json().catch(() => ({}) as { error?: string });
          setError(body.error ?? `No se pudo guardar (${r.status}).`);
          return;
        }
        const body = (await r.json()) as {
          modulo: ModuleDefinition;
          diagnosticos: ModuleDiagnostics;
          locks: PublishBlocker[];
          objetos: SerializedObject[];
        };
        setModulo(body.modulo);
        setPaginas(body.modulo.pages);
        setDiag(body.diagnosticos);
        setBloq(body.locks);
        setObjetos(body.objetos);
        router.refresh();
      } catch {
        /*
         * Si `fetch` lanza —no hay red, el servidor se cayo, la maquina desperto del suspendido—
         * no hay respuesta que mirar. Sin esto, el editor se quedaba diciendo «Sin guardar» y sin
         * decir por que: la promesa rechazada subia sin dueno y el mensaje de error se habia
         * limpiado al empezar.
         *
         * Lo que estaba escrito NO se pierde: `sucio` se deduce comparando lo que hay con lo
         * guardado, no es una marca que se baje al terminar. Como sigue en cierto, el
         * autoguardado se rearma y lo vuelve a intentar solo. Eso es lo que dice el mensaje.
         */
        setError(t('editor.withoutNetwork'));
      } finally {
        setGuardando(false);
      }
    },
    [modulo.slug, router, t],
  );

  /*
   * El autoguardado.
   *
   * Con rebote, no en cada tecla: arrastrar una caja por la rejilla emite decenas de posiciones y
   * cada una seria una escritura. El temporizador se rearma con cada cambio, asi que se guarda
   * cuando la mano para, no mientras se mueve.
   *
   * No corre si no se puede editar, ni encima de un guardado en curso: dos PUT simultaneos al
   * mismo modulo tienen un orden de llegada que nadie controla, y el que llegue segundo gana.
   */
  useEffect(() => {
    if (!editable || !sucio || saving) return;
    const temporizador = setTimeout(() => void guardar(paginas), MS_AUTOGUARDADO);
    return () => clearTimeout(temporizador);
  }, [editable, sucio, saving, paginas, guardar]);

  const conItems = (nuevos: GridItem[]): ModuleDefinition['pages'] =>
    paginas.map((p, i) => (i === 0 ? { ...p, items: nuevos } : p));

  const add = async (objectId: string) => {
    const definicion = palette.objetos.find((o) => o.objectId === objectId);
    if (!definicion) return;
    /*
     * Un elemento o un contenedor no necesita dataset, y por eso no se exige uno.
     */
    const config = initialSettings(objectId);
    const withoutData = definicion.dimensiones.max === 0 && definicion.medidas.max === 0;
    const dataset = palette.datasets[0];
    if (!withoutData && !dataset) return;

    const id = `obj-${crypto.randomUUID().slice(0, 8)}`;
    // `findFreeSlot` busca el primer hueco de la rejilla en vez de apilar al final. Existia desde
    // que se escribio la rejilla y no lo llamaba nadie: el editor anterior apilaba, asi que dos
    // objetos de media anchura no se ponian nunca uno al lado del otro.
    //
    // El tamano sale de lo que el objeto declara, no de un 6x3 para todos: un titulo de seccion
    // ocupaba media pagina para una linea de texto y una tabla de doce columnas nacia con sitio
    // para cuatro. Se puede cambiar despues; es la talla de salida, no un minimo.
    const { w, h } = defaultSize(definicion);
    const position = findFreeSlot(items, w, h);

    const nuevo: GridItem = {
      id,
      position,
      instance: {
        instanceId: id,
        objectId: definicion.objectId,
        version: definicion.version,
        title: definicion.name,
        binding: {
          // Cadena vacia cuando no consume datos: es lo que lee `datasetsConsumedBy` para no
          // pedirle al cache un dataset que este objeto nunca declaro.
          datasetId: withoutData ? '' : (dataset?.datasetId ?? ''),
          // Se mapea el minimo que exige el contrato: asi el objeto nace valido y dibujando algo,
          // no bloqueando y en blanco.
          dimensions: (dataset?.dimensiones ?? []).slice(0, definicion.dimensiones.min).map(aFieldRef),
          measures: (dataset?.medidas ?? []).slice(0, definicion.medidas.min),
        },
        ...(config ? { settings: config } : {}),
      },
    };

    editar(conItems([...items, nuevo]));
    // Lo recien puesto queda elegido: es lo que se va a configurar a continuacion.
    setSeleccion(id);
  };

  const cambiar = async (itemId: string, change: (item: GridItem) => GridItem) => {
    editar(conItems(items.map((i) => (i.id === itemId ? change(i) : i))));
  };

  const remove = async (itemId: string) => {
    setSeleccion(null);
    editar(conItems(items.filter((i) => i.id !== itemId)));
  };

  /**
   * Deshace todo lo hecho desde que se abrio el editor.
   *
   * No revierte «a lo ultimo guardado», que con autoguardado seria lo de hace un segundo y no
   * serviria de nada: revierte al `puntoDeRetorno`. Y la vuelta atras se guarda, como cualquier
   * otro cambio — si no, el autoguardado volveria a escribirla igualmente medio segundo despues,
   * y tener dos caminos para lo mismo es como se acaba con dos comportamientos distintos.
   */
  const descartar = () => {
    setSeleccion(null);
    setError('');
    editar(puntoDeRetorno);
  };

  /** Guarda y, acto seguido, pide la transicion. Enviar algo sin guardar enviaria lo viejo. */
  const transicion = async (cual: 'enviar' | 'publicar') => {
    setError('');
    setGuardando(true);
    try {
      if (sucio) {
        const guardado = await fetch(`/api/modules/${modulo.slug}/edit`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ paginas }),
        });
        if (!guardado.ok) {
          const body = (await guardado.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'No se pudo guardar antes de enviar.');
          return;
        }
      }
      const r = await fetch(`/api/modules/${modulo.slug}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transition: cual }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `No se pudo ${cual}.`);
        return;
      }
      const body = (await r.json()) as { modulo: ModuleDefinition };
      setModulo(body.modulo);
      setPaginas(body.modulo.pages);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  /*
   * Dos columnas de pantalla completa: el taller a la izquierda y el carril de objetos a la
   * derecha, los dos desde justo debajo del banner hasta el fondo.
   */
  return (
    <div className="taller">
      <div className="taller__obra">
        <EditorHeader />
        <section
          className="editor"
          data-saving={saving ? 'si' : 'no'}
          /*
            `data-drawing` existe porque dibujar dejo de ser un efecto secundario de guardar.
            Antes bastaba con `data-saving` para saber que el servidor habia contestado; ahora hay
            dos esperas distintas, y una prueba que solo mire la de guardar lee el lienzo viejo.
          */
          data-drawing={dibujando ? 'si' : 'no'}
          /*
            Y `data-dirty` porque el autoguardado anade una tercera espera: entre el gesto y la
            escritura hay un rebote en el que no se esta guardando NI dibujando. Una prueba que
            solo mirase las otras dos leeria «al dia» sobre un cambio que todavia no ha salido del
            navegador, que es exactamente como se escribe una prueba que no comprueba nada.
          */
          data-dirty={sucio ? 'si' : 'no'}
        >
      <header className="editor__header">
        <div>
          <h2>{modulo.name}</h2>
          <p className="muted-text">
            <span className="pastilla-estado" data-status={modulo.status}>
              {modulo.status}
            </span>{' '}
            · /m/{modulo.slug} · v{modulo.version}
          </p>
        </div>
        <div className="editor__actions-header">
          {/*
            El estado dice si hay algo sin guardar, no si se esta guardando.
            «Guardando…» aparecia y desaparecia solo, y con el guardado automatico era lo unico
            que informaba. Ahora la pregunta que importa es otra: ¿lo que veo esta guardado?
          */}
          <p className="editor__status" role="status" aria-live="polite" data-testid="status-editor">
            {saving ? t('editor.saving') : sucio ? t('editor.unsaved') : t('editor.saved')}
          </p>

          {/* Guardar y descartar son de quien EDITA. */}
          {editable ? (
            <>
              {/*
                El boton no es OTRO camino de guardado: dispara el mismo que el rebote, solo que
                ahora. Existe porque «se guarda solo» es algo que hay que creerse, y pulsar y ver
                «Guardado» es como se cree.
              */}
              <button
                type="button"
                className="pastilla"
                disabled={saving || !sucio}
                data-testid="guardar-borrador"
                onClick={() => void guardar(paginas)}
              >
                {t('editor.saveDraft')}
              </button>
              {/*
                Descartar se habilita con `desviado`, no con `sucio`: lo que deshace es la sesion
                entera, y el autoguardado deja `sucio` en falso casi siempre. Con la condicion
                vieja el boton habria estado apagado justo cuando hace falta.
              */}
              <button
                type="button"
                className="boton-contorno"
                disabled={saving || !desviado}
                title={t('editor.discard.help')}
                data-testid="descartar-borrador"
                onClick={descartar}
              >
                {t('editor.discard')}
              </button>
              {modulo.status === 'borrador' ? (
                <button
                  type="button"
                  className="pastilla"
                  disabled={saving || bloq.length > 0}
                  data-testid="enviar-aprobacion"
                  onClick={() => void transicion('enviar')}
                >
                  {t('editor.submit')}
                </button>
              ) : null}
            </>
          ) : null}

          {/*
            Aprobar es de quien APRUEBA, y por eso va fuera del gate de edicion: quien revisa una
            propuesta no la esta editando —no es suya— y aun asi tiene que poder publicarla desde
            la pantalla donde la esta mirando.
          */}
          {modulo.status === 'pendiente-de-aprobacion' && puedePublicar ? (
            <button
              type="button"
              className="pastilla"
              disabled={saving || bloq.length > 0}
              data-testid="aprobar-modulo"
              onClick={() => void transicion('publicar')}
            >
              {t('editor.approve')}
            </button>
          ) : null}

          <Link href="/editor" className="boton-contorno">
            {t('editor.backToList')}
          </Link>
        </div>
      </header>

      {!editable ? (
        <p className="aviso" data-testid="editor-solo-lectura">
          Este modulo no se puede editar aqui: solo se editan los borradores propios. Un modulo
          publicado se retira antes de cambiarlo, para que el cambio pase por aprobacion.
        </p>
      ) : null}

      {bloq.length > 0 ? (
        <div className="aviso problem-notice" data-testid="locks-editor">
          <p>Esto impide publicarlo:</p>
          <ul>
            {bloq.map((b, i) => (
              <li key={`${b.reason}-${i}`}>{b.detail}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted-text" data-testid="editor-without-locks">
          Sin problemas pendientes: el modulo se puede proponer para publicacion.
        </p>
      )}

      <p className="aviso-error" role="alert" data-testid="editor-error">
        {error}
      </p>

      <div className="editor__banco">
        <Canvas
          items={items}
          objetos={objetos}
          selection={selection}
          editable={editable}
          onSeleccionar={editable ? setSeleccion : () => undefined}
          // El arrastre entrega una posicion y la aplica el MISMO camino que los botones del
          // panel. Es la condicion con la que se aplazo: un solo sitio donde se decide donde
          // queda un objeto, no dos que puedan divergir.
          onColocar={(itemId, position) =>
            void cambiar(itemId, (i) => ({ ...i, position }))
          }
        />
      </div>

      {/*
        Los problemas de esquema, en texto y fuera del lienzo.

        En el lienzo cada objeto roto ya se dibuja marcado, que es lo que pide 4.2. Esta lista los
        reune para que se puedan leer todos sin ir pulsando bloque por bloque, y es la que un
        lector de pantalla recorre de una vez.
      */}
      {diag.items.some((d) => d.broken) ? (
        <div className="aviso problem-notice" data-testid="problems-editor">
          <p>Objetos con problemas de esquema:</p>
          <ul>
            {diag.items
              .filter((d) => d.broken)
              .map((d) => (
                <li key={d.itemId} data-testid={`problems-${d.itemId}`}>
                  <strong>{items.find((i) => i.id === d.itemId)?.instance.title ?? d.itemId}</strong>
                  {': '}
                  {d.unresolvedObject ?? d.bindingProblems.map((p) => p.problem).join(' ')}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
        </section>
      </div>

      {editable ? (
        <SidebarPanel
          objetos={palette.objetos}
          datasets={palette.datasets}
          iconos={palette.iconos}
          selected={chosen}
          saving={saving}
          onAnadir={(objectId) => void add(objectId)}
          onCambiar={(itemId, change) => void cambiar(itemId, change)}
          onQuitar={(itemId) => void remove(itemId)}
        />
      ) : null}
    </div>
  );
}

/** 'Tabla.Campo' -> FieldRef. El editor trabaja con la clave, que es lo que se ve en pantalla. */
function aFieldRef(clave: string): { table: string; field: string } {
  const [table = '', field = ''] = clave.split('.');
  return { table, field };
}
