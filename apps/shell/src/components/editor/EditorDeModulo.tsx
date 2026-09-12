'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GridItem, ModuleDefinition, ModuleDiagnostics, PublishBlocker } from '@app/module-model';
import type { PaletaDelEditor } from '../../server/editor';
import { Presentacion } from './Presentacion';

/**
 * Editor de un modulo — seccion 4.2.
 *
 * Las tres cosas que la seccion exige y que aqui se ven:
 *
 * 1. Un PANEL DE OBJETOS PREDISEÑADOS. Se colocan de una lista; no hay forma de inventar uno.
 * 2. El enlace es a un DATASET y a sus campos, elegidos de desplegables. No hay ninguna caja
 *    donde escribir una consulta, porque "nunca SQL libre construido por el modulo".
 * 3. VALIDACION DE ESQUEMA EN CADA CARGA: los objetos con un campo que ya no existe salen
 *    marcados rotos, con el problema escrito, y el resto del modulo se sigue editando.
 *
 * Cada objeto se muestra con los limites de su contrato —cuantas dimensiones y medidas admite—
 * porque un mapeo que incumple el contrato es un bloqueo de publicacion, y descubrirlo al
 * intentar publicar llega tarde.
 */
export function EditorDeModulo({
  inicial,
  diagnosticos,
  bloqueos,
  paleta,
  editable,
}: {
  inicial: ModuleDefinition;
  diagnosticos: ModuleDiagnostics;
  bloqueos: PublishBlocker[];
  paleta: PaletaDelEditor;
  editable: boolean;
}) {
  const router = useRouter();
  const [modulo, setModulo] = useState(inicial);
  const [diag, setDiag] = useState(diagnosticos);
  const [bloq, setBloq] = useState(bloqueos);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const pagina = modulo.pages[0];
  const items = pagina?.items ?? [];

  // Los complementos no se colocan sueltos en la rejilla: se adjuntan a otro objeto. La
  // validacion lo rechaza, asi que tampoco se ofrecen aqui.
  const colocables = paleta.objetos.filter((o) => !o.attachable);

  const problemasDe = (itemId: string) => diag.items.find((d) => d.itemId === itemId);

  const guardar = async (paginas: ModuleDefinition['pages']) => {
    setError('');
    setGuardando(true);
    try {
      const r = await fetch(`/api/modulos/${modulo.slug}/edicion`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paginas }),
      });
      if (!r.ok) {
        const cuerpo = (await r.json()) as { error?: string };
        setError(cuerpo.error ?? 'No se pudo guardar.');
        return;
      }
      const cuerpo = (await r.json()) as {
        modulo: ModuleDefinition;
        diagnosticos: ModuleDiagnostics;
        bloqueos: PublishBlocker[];
      };
      setModulo(cuerpo.modulo);
      setDiag(cuerpo.diagnosticos);
      setBloq(cuerpo.bloqueos);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  };

  const conItems = (nuevos: GridItem[]): ModuleDefinition['pages'] =>
    modulo.pages.map((p, i) => (i === 0 ? { ...p, items: nuevos } : p));

  const anadir = async (objectId: string) => {
    const definicion = colocables.find((o) => o.objectId === objectId);
    const dataset = paleta.datasets[0];
    if (!definicion || !dataset) return;

    const id = `obj-${crypto.randomUUID().slice(0, 8)}`;
    // Se coloca en la siguiente fila libre. La rejilla es de doce columnas y la validacion
    // rechaza los solapes, asi que apilar es lo unico seguro sin un gesto de arrastre.
    const y = items.reduce((max, i) => Math.max(max, i.position.y + i.position.h), 0);

    const nuevo: GridItem = {
      id,
      position: { x: 0, y, w: 6, h: 3 },
      instance: {
        instanceId: id,
        objectId: definicion.objectId,
        version: definicion.version,
        title: definicion.name,
        binding: {
          datasetId: dataset.datasetId,
          // Se mapea el minimo que exige el contrato: asi el objeto nace valido y no bloqueando.
          dimensions: dataset.dimensiones.slice(0, definicion.dimensiones.min).map(aFieldRef),
          measures: dataset.medidas.slice(0, definicion.medidas.min),
        },
      },
    };

    await guardar(conItems([...items, nuevo]));
  };

  const cambiar = async (itemId: string, cambio: (item: GridItem) => GridItem) => {
    await guardar(conItems(items.map((i) => (i.id === itemId ? cambio(i) : i))));
  };

  const quitar = async (itemId: string) => {
    await guardar(conItems(items.filter((i) => i.id !== itemId)));
  };

  return (
    /*
     * `data-guardando` no es solo para las pruebas.
     *
     * Cada cambio guarda el modulo entero contra el servidor y mientras tanto todos los controles
     * se deshabilitan. Sin decirlo, el editor se queda muerto durante unas decimas sin motivo
     * aparente, y quien esta cambiando varias cosas seguidas cree que la interfaz ha fallado.
     */
    <section className="editor" data-guardando={guardando ? 'si' : 'no'}>
      <p className="editor__estado" role="status" aria-live="polite" data-testid="editor-estado">
        {guardando ? 'Guardando…' : ''}
      </p>
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
        <Link href="/editor" className="boton-enlace">
          Volver a la lista
        </Link>
      </header>

      {!editable ? (
        <p className="aviso" data-testid="editor-solo-lectura">
          Este modulo no se puede editar aqui: solo se editan los borradores propios. Un modulo
          publicado se retira antes de cambiarlo, para que el cambio pase por aprobacion.
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
          Sin problemas pendientes: el modulo se puede proponer para publicacion.
        </p>
      )}

      <p className="acceso__error" role="alert" data-testid="editor-error">
        {error}
      </p>

      {editable ? (
        <div className="editor__paleta">
          <h3>Objetos prediseñados</h3>
          <p className="texto-atenuado">
            Se enlazan a un dataset certificado del registro. No hay consultas escritas a mano: un
            modulo no construye SQL (4.2).
          </p>
          <ul className="editor__catalogo">
            {colocables.map((o) => (
              <li key={o.objectId}>
                <button
                  type="button"
                  className="boton-enlace"
                  data-testid={`anadir-${o.objectId}`}
                  disabled={guardando}
                  onClick={() => void anadir(o.objectId)}
                >
                  {o.name}
                </button>
                <span className="texto-atenuado">
                  {' '}
                  · {o.dimensiones.min}–{o.dimensiones.max} dim, {o.medidas.min}–{o.medidas.max} med
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="editor__objetos" data-testid="objetos-del-modulo">
        {items.map((item) => {
          const problemas = problemasDe(item.id);
          const definicion = paleta.objetos.find((o) => o.objectId === item.instance.objectId);
          const dataset = paleta.datasets.find(
            (d) => d.datasetId === item.instance.binding.datasetId,
          );

          return (
            <li
              key={item.id}
              className={problemas?.broken ? 'editor__objeto editor__objeto--roto' : 'editor__objeto'}
              data-testid={`objeto-${item.id}`}
              data-roto={problemas?.broken ? 'si' : 'no'}
            >
              <h4>
                {item.instance.title}{' '}
                <span className="texto-atenuado">
                  ({definicion?.name ?? item.instance.objectId} v{item.instance.version})
                </span>
              </h4>

              {problemas?.broken ? (
                <ul className="editor__problemas" data-testid={`problemas-${item.id}`}>
                  {problemas.unresolvedObject ? <li>{problemas.unresolvedObject}</li> : null}
                  {problemas.bindingProblems.map((p, i) => (
                    <li key={`${p.slot}-${i}`}>{p.problem}</li>
                  ))}
                </ul>
              ) : null}

              {editable ? (
                <div className="editor__mapeo">
                  <label className="formulario__campo">
                    <span>Titulo</span>
                    <input
                      defaultValue={item.instance.title}
                      data-testid={`titulo-${item.id}`}
                      onBlur={(e) =>
                        void cambiar(item.id, (i) => ({
                          ...i,
                          instance: { ...i.instance, title: e.target.value },
                        }))
                      }
                    />
                  </label>

                  <label className="formulario__campo">
                    <span>Dataset</span>
                    <select
                      value={item.instance.binding.datasetId}
                      data-testid={`dataset-${item.id}`}
                      onChange={(e) =>
                        void cambiar(item.id, (i) => ({
                          ...i,
                          instance: {
                            ...i.instance,
                            // Al cambiar de dataset se limpia el mapeo: los campos del anterior
                            // no existen en el nuevo, y conservarlos dejaria el objeto roto sin
                            // que nadie hubiera hecho nada mal.
                            binding: { datasetId: e.target.value, dimensions: [], measures: [] },
                          },
                        }))
                      }
                    >
                      {paleta.datasets.map((d) => (
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
                          data-testid={`dim-${item.id}-${clave}`}
                          checked={item.instance.binding.dimensions.some(
                            (d) => `${d.table}.${d.field}` === clave,
                          )}
                          onChange={(e) =>
                            void cambiar(item.id, (i) => ({
                              ...i,
                              instance: {
                                ...i.instance,
                                binding: {
                                  ...i.instance.binding,
                                  dimensions: e.target.checked
                                    ? [...i.instance.binding.dimensions, aFieldRef(clave)]
                                    : i.instance.binding.dimensions.filter(
                                        (d) => `${d.table}.${d.field}` !== clave,
                                      ),
                                },
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
                          data-testid={`med-${item.id}-${medida}`}
                          checked={item.instance.binding.measures.includes(medida)}
                          onChange={(e) =>
                            void cambiar(item.id, (i) => ({
                              ...i,
                              instance: {
                                ...i.instance,
                                binding: {
                                  ...i.instance.binding,
                                  measures: e.target.checked
                                    ? [...i.instance.binding.measures, medida]
                                    : i.instance.binding.measures.filter((m) => m !== medida),
                                },
                              },
                            }))
                          }
                        />{' '}
                        {medida}
                      </label>
                    ))}
                  </fieldset>

                  {/*
                    La presentacion, junto al mapeo y no en otra pantalla.

                    Es la diferencia entre «este objeto muestra estos datos» y «este objeto se ve
                    asi», y las dos se deciden a la vez: quien elige medir casos pendientes elige
                    en el mismo momento que la tarjeta lleve un expediente y salga en azul.
                  */}
                  <Presentacion
                    instance={item.instance}
                    admitidas={definicion?.presentacion ?? []}
                    tipos={dataset?.tipos ?? {}}
                    guardando={guardando}
                    onCambiar={(cambio) =>
                      void cambiar(item.id, (i) => ({ ...i, instance: cambio(i.instance) }))
                    }
                  />

                  <button
                    type="button"
                    className="boton-enlace"
                    data-testid={`quitar-${item.id}`}
                    disabled={guardando}
                    onClick={() => void quitar(item.id)}
                  >
                    Quitar del modulo
                  </button>
                </div>
              ) : (
                <p className="texto-atenuado">
                  {item.instance.binding.datasetId} ·{' '}
                  {item.instance.binding.dimensions.map((d) => `${d.table}.${d.field}`).join(', ') ||
                    'sin dimensiones'}{' '}
                  · {item.instance.binding.measures.join(', ') || 'sin medidas'}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {items.length === 0 ? (
        <p className="texto-atenuado" data-testid="modulo-vacio">
          Este modulo no tiene todavia ningun objeto.
        </p>
      ) : null}
    </section>
  );
}

/** 'Tabla.Campo' -> FieldRef. El editor trabaja con la clave, que es lo que se ve en pantalla. */
function aFieldRef(clave: string): { table: string; field: string } {
  const [table = '', field = ''] = clave.split('.');
  return { table, field };
}
