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
import { configuracionInicial } from '@app/ui-components';
import type { PaletaDelEditor } from '../../server/editor';
import type { ObjetoSerializado } from '../../server/serializar';
import { CabeceraDeEditor } from './CabeceraDeEditor';
import { Lienzo } from './Lienzo';
import { PanelLateral } from './PanelLateral';

/** Editor de un modulo — seccion 4.2. */
export function EditorDeModulo({
  inicial,
  objetosIniciales,
  diagnosticos,
  bloqueos,
  palette,
  editable,
}: {
  inicial: ModuleDefinition;
  objetosIniciales: ObjetoSerializado[];
  diagnosticos: ModuleDiagnostics;
  bloqueos: PublishBlocker[];
  palette: PaletaDelEditor;
  editable: boolean;
}) {
  const router = useRouter();
  const [modulo, setModulo] = useState(inicial);
  const [objetos, setObjetos] = useState(objetosIniciales);
  const [diag, setDiag] = useState(diagnosticos);
  const [bloq, setBloq] = useState(bloqueos);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const pagina = modulo.pages[0];
  const items = pagina?.items ?? [];
  const chosen = items.find((i) => i.id === seleccion) ?? null;

  // Escape deselecciona, como en cualquier editor de bloques. Va en el documento y no en el
  // lienzo porque el foco suele estar en el panel cuando hace falta.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSeleccion(null);
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, []);

  const guardar = useCallback(
    async (paginas: ModuleDefinition['pages']) => {
      setError('');
      setGuardando(true);
      try {
        const r = await fetch(`/api/modulos/${modulo.slug}/edicion`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ paginas }),
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
          bloqueos: PublishBlocker[];
          objetos: ObjetoSerializado[];
        };
        setModulo(body.modulo);
        setDiag(body.diagnosticos);
        setBloq(body.bloqueos);
        setObjetos(body.objetos);
        router.refresh();
      } finally {
        setGuardando(false);
      }
    },
    [modulo.slug, router],
  );

  const conItems = (nuevos: GridItem[]): ModuleDefinition['pages'] =>
    modulo.pages.map((p, i) => (i === 0 ? { ...p, items: nuevos } : p));

  const anadir = async (objectId: string) => {
    const definicion = palette.objetos.find((o) => o.objectId === objectId);
    if (!definicion) return;
    /*
     * Un elemento o un contenedor no necesita dataset, y por eso no se exige uno.
     */
    const config = configuracionInicial(objectId);
    const sinDatos = definicion.dimensiones.max === 0 && definicion.medidas.max === 0;
    const dataset = palette.datasets[0];
    if (!sinDatos && !dataset) return;

    const id = `obj-${crypto.randomUUID().slice(0, 8)}`;
    // `findFreeSlot` busca el primer hueco de la rejilla en vez de apilar al final. Existia desde
    // que se escribio la rejilla y no lo llamaba nadie: el editor anterior apilaba, asi que dos
    // objetos de media anchura no se ponian nunca uno al lado del otro.
    const position = findFreeSlot(items, 6, 3);

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
          datasetId: sinDatos ? '' : (dataset?.datasetId ?? ''),
          // Se mapea el minimo que exige el contrato: asi el objeto nace valido y dibujando algo,
          // no bloqueando y en blanco.
          dimensions: (dataset?.dimensiones ?? []).slice(0, definicion.dimensiones.min).map(aFieldRef),
          measures: (dataset?.medidas ?? []).slice(0, definicion.medidas.min),
        },
        ...(config ? { configuracion: config } : {}),
      },
    };

    await guardar(conItems([...items, nuevo]));
    // Lo recien puesto queda elegido: es lo que se va a configurar a continuacion.
    setSeleccion(id);
  };

  const cambiar = async (itemId: string, cambio: (item: GridItem) => GridItem) => {
    await guardar(conItems(items.map((i) => (i.id === itemId ? cambio(i) : i))));
  };

  const quitar = async (itemId: string) => {
    setSeleccion(null);
    await guardar(conItems(items.filter((i) => i.id !== itemId)));
  };

  /*
   * Dos columnas de pantalla completa: el taller a la izquierda y el carril de objetos a la
   * derecha, los dos desde justo debajo del banner hasta el fondo.
   */
  return (
    <div className="taller">
      <div className="taller__obra">
        <CabeceraDeEditor />
        <section className="editor" data-guardando={guardando ? 'si' : 'no'}>
      <header className="editor__cabecera">
        <div>
          <h2>{modulo.name}</h2>
          <p className="texto-atenuado">
            <span className="pastilla-estado" data-estado={modulo.status}>
              {modulo.status}
            </span>{' '}
            · /m/{modulo.slug} · v{modulo.version}
          </p>
        </div>
        <div className="editor__cabecera-acciones">
          <p className="editor__estado" role="status" aria-live="polite" data-testid="editor-estado">
            {guardando ? 'Guardando…' : ''}
          </p>
          <Link href="/editor" className="boton-contorno">
            Volver a la lista
          </Link>
        </div>
      </header>

      {!editable ? (
        <p className="aviso" data-testid="editor-solo-lectura">
          Este modulo no se puede editar aqui: solo se editan los borradores propios. Un modulo
          publicado se retira before de cambiarlo, para que el cambio pase por aprobacion.
        </p>
      ) : null}

      {bloq.length > 0 ? (
        <div className="aviso aviso--problema" data-testid="editor-bloqueos">
          <p>Esto impide publicarlo:</p>
          <ul>
            {bloq.map((b, i) => (
              <li key={`${b.reason}-${i}`}>{b.detail}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="texto-atenuado" data-testid="editor-sin-bloqueos">
          Sin problems pendientes: el modulo se puede proponer para publicacion.
        </p>
      )}

      <p className="acceso__error" role="alert" data-testid="editor-error">
        {error}
      </p>

      <div className="editor__banco">
        <Lienzo
          items={items}
          objetos={objetos}
          seleccion={seleccion}
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
        <div className="aviso aviso--problema" data-testid="editor-problemas">
          <p>Objetos con problems de scheme:</p>
          <ul>
            {diag.items
              .filter((d) => d.broken)
              .map((d) => (
                <li key={d.itemId} data-testid={`problemas-${d.itemId}`}>
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
        <PanelLateral
          objetos={palette.objetos}
          datasets={palette.datasets}
          seleccionado={chosen}
          guardando={guardando}
          onAnadir={(objectId) => void anadir(objectId)}
          onCambiar={(itemId, cambio) => void cambiar(itemId, cambio)}
          onQuitar={(itemId) => void quitar(itemId)}
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
