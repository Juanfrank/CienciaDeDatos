'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GridItem,
  ModuleDefinition,
  ModuleDiagnostics,
  ModuleOperation,
  PublishBlocker,
} from '@app/module-model';
import { applyModuleOperation, findFreeSlot } from '@app/module-model';
import { defaultSize, initialSettings } from '@app/ui-components';
import type { EditorPalette } from '../../server/editor';
import type { SerializedObject } from '../../server/serialize';
import { EditorHeader } from './EditorHeader';
import { Canvas } from './Canvas';
import { SidebarPanel } from './SidebarPanel';
import { Icon } from '../icons/Icon';
import { useTranslator } from '../Locale';

/*
 * Lo que espera el autoguardado antes de escribir.
 *
 * Suficiente para que una rafaga de gestos —arrastrar, teclear un titulo— sea UNA escritura, y
 * poco para que nadie llegue a cerrar la pestana creyendo que lo suyo se perdio.
 */
const MS_AUTOGUARDADO = 800;

/**
 * Si el foco esta escribiendo en algun sitio.
 *
 * Dentro de un campo, Suprimir borra un caracter. Un atajo global que no lo compruebe se lleva el
 * objeto entero mientras alguien corrige un titulo — y eso no se deshace solo, porque el objeto ya
 * salio del borrador.
 */
function escribiendo(destino: EventTarget | null): boolean {
  const el = destino as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  if (el.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

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
  const hayObjetosRotos = diag.items.some((d) => d.broken);
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

  /*
   * Que pagina se esta editando.
   *
   * Por SLUG y no por indice: el indice sobrevive a que alguien reordene o quite una pagina
   * apuntando a otra distinta, sin avisar, y lo que se estaria editando no seria lo que la pantalla
   * dice. Con el slug, si la pagina deja de existir se cae a la primera, que es visible.
   *
   * Hasta ahora era `paginas[0]` fijo: un modulo de once paginas se editaba en la primera y las
   * otras diez no tenian forma de abrirse desde aqui. La definicion las guardaba enteras, asi que
   * lo que faltaba era exactamente esto.
   */
  const [slugActual, setSlugActual] = useState<string>(modulo.pages[0]?.slug ?? '');
  const indice = Math.max(0, paginas.findIndex((p) => p.slug === slugActual));
  const pagina = paginas[indice];
  const items = pagina?.items ?? [];
  const chosen = items.find((i) => i.id === selection) ?? null;

  /*
   * Escape deselecciona y Suprimir quita el objeto elegido, como en cualquier editor de bloques.
   *
   * Van en el documento y no en el lienzo porque el foco suele estar en el panel cuando hacen
   * falta. Y Suprimir se DESCARTA si el foco esta escribiendo: dentro de un campo de texto o de un
   * `contenteditable`, esa tecla borra un caracter, y llevarse el objeto entero mientras alguien
   * corrige un titulo es la peor forma de obedecer.
   */
  useEffect(() => {
    const clickTo = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSeleccion(null);
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (escribiendo(e.target)) return;

      // El estado vive en una referencia porque este oyente se registra UNA vez: leerlo de la
      // clausura daria siempre la seleccion que hubiera en el primer dibujo, que es ninguna.
      const elegido = seleccionViva.current;
      if (!elegido || !editableViva.current) return;
      e.preventDefault();
      void quitarViva.current(elegido);
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
    async (cuales: ModuleDefinition['pages'], cual: string) => {
      setDibujando(true);
      try {
        const r = await fetch(`/api/modules/${modulo.slug}/preview`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          // QUE pagina dibujar. Sin esto el servidor devolvia siempre la primera, asi que cambiar
          // de pagina movia los huecos de la rejilla y dejaba debajo los objetos de la otra.
          body: JSON.stringify({ paginas: cuales, pagina: cual }),
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
    (cuales: ModuleDefinition['pages'], pagina?: string) => {
      setPaginas(cuales);
      void dibujar(cuales, pagina ?? slugActual);
    },
    [dibujar, slugActual],
  );

  /*
   * Lo que falta por mandar, como OPERACIONES y no como la definicion entera — apartado 2.3.
   *
   * Cada gesto encola lo que CAMBIA. El servidor las aplica sobre el borrador guardado, asi que
   * dos personas que tocan cosas distintas ya no se pisan: antes cada envio decia «el modulo es
   * exactamente esto» y el segundo en llegar borraba al primero. Y lo que viaja deja de crecer
   * con el tamano del modulo: mover una caja mandaba las doce paginas.
   *
   * En una referencia y no en estado: encolar no tiene que redibujar nada —lo que se dibuja es el
   * borrador, que ya cambio— y con estado cada gesto daria dos pinturas en vez de una.
   */
  const pendientes = useRef<ModuleOperation[]>([]);

  /*
   * Reemplazo del borrador ENTERO, que es otra cosa y tiene su sitio.
   *
   * Solo lo usa «descartar»: volver al punto de retorno no es una secuencia de cambios, es decir
   * cual es el estado. Expresarlo como operaciones seria inventar un historial inverso que nadie
   * pidio, y aplicarlo sobre un borrador que otro haya tocado daria un resultado que no es ni lo
   * de uno ni lo del otro.
   */
  const reemplazo = useRef<ModuleDefinition['pages'] | null>(null);

  /**
   * Aplica UNA operacion: al borrador que se ve y a la cola que se enviara.
   *
   * La misma funcion pura que corre el servidor, para que lo que se dibuja y lo que se guarda no
   * puedan diferir. Si la operacion no se puede, se dice y no se encola: encolar algo que el
   * servidor va a rechazar deja el editor ensenando un estado que nunca existira.
   */
  const operar = useCallback(
    (op: ModuleOperation, pagina?: string): boolean => {
      const resultado = applyModuleOperation(paginas, op);
      if (!resultado.ok) {
        setError(resultado.error);
        return false;
      }
      pendientes.current = [...pendientes.current, op];
      editar(resultado.pages, pagina);
      return true;
    },
    [editar, paginas],
  );

  /*
   * Una pagina nueva, al final y ya abierta.
   *
   * Nace vacia y con nombre provisional: lo que hace falta al crearla es tener donde poner algo,
   * y bautizarla antes de saber que lleva dentro es una pregunta que no se puede contestar
   * todavia. El rotulo se cambia aqui mismo, en el campo de al lado.
   *
   * El slug sale del reloj y no del nombre: dos paginas llamadas igual darian el mismo slug, y el
   * slug es lo que las distingue en la URL y lo que fija a cual apunta un salto.
   */
  const anadirPagina = () => {
    const n = paginas.length + 1;
    const nueva = {
      pageId: `pag-${crypto.randomUUID()}`,
      slug: `pagina-${Date.now().toString(36)}`,
      name: `Pagina ${n}`,
      items: [],
    };
    if (!operar({ kind: 'page-add', page: nueva }, nueva.slug)) return;
    setSlugActual(nueva.slug);
    setSeleccion(null);
  };

  /*
   * Duplicar un objeto: la copia va al primer hueco libre, no encima del original.
   *
   * Identificadores nuevos —el del bloque y el de la instancia—: dos objetos con el mismo id son
   * el mismo objeto para la rejilla, para el panel y para los complementos, asi que la copia
   * heredaria los cambios del original y al quitar uno desaparecerian los dos.
   *
   * Lo que NO se copia son los saltos ni nada que apunte fuera: eso si se hereda, porque apuntar
   * al mismo sitio desde una copia es lo que se espera al duplicar.
   */
  const duplicar = (itemId: string) => {
    const original = items.find((i) => i.id === itemId);
    if (!original) return;
    const id = `obj-${crypto.randomUUID().slice(0, 8)}`;
    const { w, h } = original.position;
    const copia = {
      ...original,
      id,
      position: findFreeSlot(items, w, h),
      instance: { ...original.instance, instanceId: id },
    };
    if (!operar({ kind: 'item-add', pageSlug: slugActual, item: copia })) return;
    setSeleccion(id);
  };

  /*
   * La barra se ensena si hay entre que elegir, o si se puede crear.
   *
   * En una constante con nombre y no dentro del JSX: el trinquete de cadenas sueltas busca prosa
   * entre `>` y `<`, y una comparacion dentro de una llave se le parece lo suficiente como para
   * contarla. Ademas se lee mejor el nombre que la condicion.
   */
  const hayBarraDePaginas = paginas.length > 1 || editable;

  /** Renombrar la pagina abierta. El slug NO cambia: hay saltos y marcadores que lo apuntan. */
  const renombrarPagina = (name: string) => {
    operar({ kind: 'page-rename', pageSlug: slugActual, name });
  };

  /*
   * Quitar la pagina abierta, con lo que tenga dentro.
   *
   * La ultima no se puede quitar: un modulo sin ninguna pagina no se puede dibujar, y el editor
   * se quedaria sin lienzo donde volver a empezar.
   */
  const quitarPagina = () => {
    const destino = paginas.find((p) => p.slug !== slugActual);
    if (!destino) return;
    if (!operar({ kind: 'page-remove', pageSlug: slugActual }, destino.slug)) return;
    setSlugActual(destino.slug);
    setSeleccion(null);
  };

  /*
   * Cambiar de pagina: se redibuja y se suelta lo elegido.
   *
   * La seleccion es de un objeto de la pagina que se deja, y arrastrarla a la siguiente dejaria el
   * panel lateral configurando algo que ya no esta en pantalla.
   */
  const irAPagina = (cual: string) => {
    if (cual === slugActual) return;
    setSlugActual(cual);
    setSeleccion(null);
    void dibujar(paginas, cual);
  };

  const guardar = useCallback(
    async (cuales: ModuleDefinition['pages']) => {
      setError('');
      setGuardando(true);
      try {
        /*
         * Lo que se manda es la COLA, no las paginas — 2.3.
         *
         * Se toma una foto de la cola ANTES de enviar y solo se quita esa foto al terminar: lo
         * que se encole mientras la peticion viaja tiene que sobrevivir, o el gesto que alguien
         * hizo durante ese segundo se perderia sin decir nada.
         *
         * `paginas` sigue siendo el cuerpo de «descartar», que no es una secuencia de cambios
         * sino la declaracion de un estado.
         */
        const vuelta = reemplazo.current;
        const cola = pendientes.current;
        if (!vuelta && cola.length === 0) return;

        const r = await fetch(`/api/modules/${modulo.slug}/edit`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(vuelta ? { paginas: vuelta } : { operaciones: cola }),
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
        // Lo enviado ya esta guardado: sale de la cola, y lo encolado despues se queda.
        if (vuelta) reemplazo.current = null;
        else pendientes.current = pendientes.current.slice(cola.length);

        setModulo(body.modulo);
        /*
         * Lo guardado se adopta SOLO si nadie escribio mientras la peticion viajaba.
         *
         * `setPaginas(body.modulo.pages)` a secas pisaba lo que se hubiera hecho entre el envio y
         * la respuesta: quitar un campo justo despues de anadir otro deshacia el quitado sin
         * decir nada, porque llegaba la foto de antes y se ponia encima. Con el autoguardado de
         * por medio, esa ventana es de un segundo largo — basta con dos gestos seguidos.
         *
         * Se compara contra lo que se ENVIO, que es de lo que esta respuesta habla. Si no
         * coincide, lo local es mas nuevo y manda: `modulo` ya lleva la referencia guardada, asi
         * que `sucio` vuelve a ser cierto y el autoguardado se rearma solo con lo que hay ahora.
         */
        setPaginas((actuales) =>
          JSON.stringify(actuales) === JSON.stringify(cuales) ? body.modulo.pages : actuales,
        );
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
          /*
           * NADA mapeado: el objeto nace vacio y dice que le falta.
           *
           * Antes se le metia el primer campo del dataset para que naciera valido y dibujando
           * algo. Lo que dibujaba era una respuesta a una pregunta que nadie habia hecho —el
           * primer campo del dataset, por orden alfabetico de la tabla—, y quien la veia tenia que
           * adivinar si ese era el campo que queria o el que le tocaba por estar primero. Peor: si
           * era el que le tocaba, el modulo se podia publicar asi.
           *
           * Vacio, el objeto se dibuja como marcador de posicion diciendo que falta, no se puede
           * publicar, y la eleccion la hace quien sabe cual es.
           */
          dimensions: [],
          measures: [],
        },
        /*
         * La presentacion de salida que fijo la institucion, si hay alguna.
         *
         * No congela nada: quien edita la cambia objeto por objeto como siempre. Lo que evita es
         * que la misma correccion —la leyenda abajo, la rejilla fuera— se repita una vez por cada
         * grafico que alguien coloque, y que salga distinta segun quien se acuerde.
         */
        ...(definicion.defaultPresentation
          ? { presentation: definicion.defaultPresentation }
          : {}),
        ...(config ? { settings: config } : {}),
      },
    };

    if (!operar({ kind: 'item-add', pageSlug: slugActual, item: nuevo })) return;
    // Lo recien puesto queda elegido: es lo que se va a configurar a continuacion.
    setSeleccion(id);
  };

  const cambiar = async (itemId: string, change: (item: GridItem) => GridItem) => {
    const actual = items.find((i) => i.id === itemId);
    if (!actual) return;
    const siguiente = change(actual);

    /*
     * Mover se manda como `item-move` y no como un reemplazo entero.
     *
     * Es la operacion mas frecuente —cada arrastre emite decenas— y la mas barata de todas: lleva
     * cuatro numeros en vez de la instancia completa con su binding y su presentacion.
     */
    const soloPosicion =
      JSON.stringify({ ...siguiente, position: actual.position }) === JSON.stringify(actual);
    operar(
      soloPosicion
        ? { kind: 'item-move', pageSlug: slugActual, itemId, position: siguiente.position }
        : { kind: 'item-replace', pageSlug: slugActual, item: siguiente },
    );
  };

  const remove = async (itemId: string) => {
    setSeleccion(null);
    operar({ kind: 'item-remove', pageSlug: slugActual, itemId });
  };

  /*
   * Lo que el oyente de teclado necesita leer, en referencias vivas.
   *
   * El oyente se registra una sola vez —si se volviera a registrar en cada cambio de seleccion,
   * escribir en el panel lo desmontaria y montaria en cada pulsacion—, asi que lo que lea de la
   * clausura seria siempre el primer valor. Las referencias se actualizan en cada dibujo.
   */
  const seleccionViva = useRef(selection);
  seleccionViva.current = selection;
  const editableViva = useRef(editable);
  editableViva.current = editable;
  const quitarViva = useRef(remove);
  quitarViva.current = remove;

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
    // Lo encolado deja de valer: se vuelve a un estado, no se deshace paso a paso.
    pendientes.current = [];
    reemplazo.current = puntoDeRetorno;
    editar(puntoDeRetorno);
  };

  /** Guarda y, acto seguido, pide la transicion. Enviar algo sin guardar enviaria lo viejo. */
  const transicion = async (cual: 'enviar' | 'publicar') => {
    setError('');
    setGuardando(true);
    try {
      if (sucio) {
        const vuelta = reemplazo.current;
        const cola = pendientes.current;
        const guardado = await fetch(`/api/modules/${modulo.slug}/edit`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(vuelta ? { paginas: vuelta } : { operaciones: cola }),
        });
        if (!guardado.ok) {
          const body = (await guardado.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'No se pudo guardar antes de enviar.');
          return;
        }
        reemplazo.current = null;
        pendientes.current = pendientes.current.slice(cola.length);
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
      pendientes.current = [];
      reemplazo.current = null;
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
          <p>{t('editor.locks')}</p>
          <ul>
            {bloq.map((b, i) => (
              <li key={`${b.reason}-${i}`}>{b.detail}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted-text" data-testid="editor-without-locks">
          {t('editor.noLocks')}
        </p>
      )}

      <p className="aviso-error" role="alert" data-testid="editor-error">
        {error}
      </p>

      {/*
        Las paginas del modulo, y cual se esta editando.

        Son BOTONES y no un desplegable: con dos o tres paginas —que es lo normal— un desplegable
        esconde tras un clic lo que cabe a la vista, y ademas no deja ver de un vistazo en cual se
        esta. Va encima del lienzo porque es lo que manda sobre el lienzo.

        Solo aparece con mas de una: un modulo de una pagina no tiene entre que elegir, y una barra
        con un unico boton pulsado sugiere que falta algo.
      */}
      {hayBarraDePaginas ? (
        <nav className="editor__paginas" aria-label={t('editor.pages')} data-testid="paginas-editor">
          {paginas.map((p) => (
            <button
              key={p.slug}
              type="button"
              className="editor__pagina"
              aria-current={p.slug === pagina?.slug ? 'page' : undefined}
              disabled={saving}
              data-testid={`pagina-${p.slug}`}
              onClick={() => irAPagina(p.slug)}
            >
              {p.name}
            </button>
          ))}

          {editable ? (
            <button
              type="button"
              className="editor__pagina editor__pagina--anadir"
              disabled={saving}
              data-testid="anadir-pagina"
              onClick={anadirPagina}
            >
              {t('editor.pages.add')}
            </button>
          ) : null}

          {/*
            El rotulo de la pagina abierta y su papelera, en la MISMA fila que las pestanas.

            En una fila aparte quedaban mejor repartidos, y costaban una linea entera encima del
            lienzo: el editor se mira de arriba abajo y cada franja que se interpone empuja el
            lienzo hacia el pliegue. Aqui ocupan el hueco que ya sobraba a la derecha.

            `key` con el slug: el campo no es controlado —escribir en un controlado con autoguardado
            de por medio devuelve el cursor al principio en cada rebote—, asi que al cambiar de
            pagina hay que rehacerlo para que tome el nombre de la nueva.
          */}
          {editable && pagina ? (
            <span className="editor__pagina-rotulo">
              <input
                key={pagina.slug}
                type="text"
                defaultValue={pagina.name}
                disabled={saving}
                aria-label={t('editor.pages.name')}
                data-testid="pagina-nombre"
                onChange={(e) => renombrarPagina(e.target.value)}
              />
              {/*
                La ultima pagina no se puede quitar: un modulo sin ninguna no se puede dibujar, y
                el editor se quedaria sin lienzo. Deshabilitado y no escondido — que exista y no se
                pueda explica la regla; que desaparezca deja pensando donde estaba.
              */}
              <button
                type="button"
                className="button-link"
                disabled={saving || paginas.length < 2}
                title={paginas.length < 2 ? t('editor.pages.last') : t('editor.pages.remove')}
                aria-label={t('editor.pages.remove')}
                data-testid="quitar-pagina"
                onClick={quitarPagina}
              >
                <Icon nombre="papelera" tamano={16} />
              </button>
            </span>
          ) : null}
        </nav>
      ) : null}

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
          {...(editable ? { onDuplicar: duplicar, onQuitar: (id) => void remove(id) } : {})}
        />
      </div>

      {/*
        Extraido a una constante: la guarda del catalogo cuenta el texto suelto de un JSX con una
        expresion regular, y una condicion escrita en linea le parece prosa. Con nombre se lee
        mejor y ademas deja de contarse.
      */}
      {/*
        Los problemas de esquema, en texto y fuera del lienzo.

        En el lienzo cada objeto roto ya se dibuja marcado, que es lo que pide 4.2. Esta lista los
        reune para que se puedan leer todos sin ir pulsando bloque por bloque, y es la que un
        lector de pantalla recorre de una vez.
      */}
      {hayObjetosRotos ? (
        <div className="aviso problem-notice" data-testid="problems-editor">
          <p>{t('editor.schemaProblems')}</p>
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
          // Sin el modulo que se esta editando: un salto a la misma pagina no lleva a ninguna
          // parte, y ofrecerlo invita a declarar el salto que `drillProblems` marca como roto.
          modulos={palette.modulos.filter((m) => m.slug !== modulo.slug)}
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

