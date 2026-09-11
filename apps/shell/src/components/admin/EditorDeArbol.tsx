'use client';

import { useCallback, useState } from 'react';
import type { ManagedTree, NavNode, TreeOperation } from '@app/access-control';

/**
 * Editor de la organizacion general — seccion 4.10.8.
 *
 * Dos gestos para la MISMA operacion:
 *  - Arrastrar y soltar, que es lo que pide 4.10.8.
 *  - Botones de mover y un selector de destino, porque arrastrar y soltar es inaccesible por
 *    teclado y con lector de pantalla, y la seccion 4.9 dice que la accesibilidad no es opcional
 *    y no se pospone.
 *
 * Los dos caminos llaman al MISMO endpoint, que a su vez llama a la misma `applyTreeOperation`.
 * Si fueran dos implementaciones, podrian divergir y una de las dos acabaria saltandose la
 * auditoria o la comprobacion de permiso.
 */

interface Previsualizacion {
  moduleIds: string[];
  scopeAntes?: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] };
  scopeDespues?: { restrictions: { dimension: { table: string; field: string }; allowedValues: string[] }[] };
  cambiaElAmbito: boolean;
}

const describirAmbito = (scope: Previsualizacion['scopeAntes']): string => {
  if (!scope || scope.restrictions.length === 0) return 'sin restriccion propia';
  return scope.restrictions
    .map((r) => `${r.dimension.table}.${r.dimension.field} = ${r.allowedValues.join(', ') || '(nada)'}`)
    .join(' · ');
};

export function EditorDeArbol({ inicial }: { inicial: ManagedTree }) {
  const [arbol, setArbol] = useState<ManagedTree>(inicial);
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<{ op: TreeOperation; previo: Previsualizacion } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enviar = useCallback(async (op: TreeOperation) => {
    setError(null);
    const r = await fetch('/api/admin/arbol', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(op),
    });
    const cuerpo = await r.json();
    if (!r.ok) {
      setError(cuerpo.error ?? 'No se pudo aplicar la operacion.');
      return false;
    }
    setArbol(cuerpo.arbol as ManagedTree);
    return true;
  }, []);

  /**
   * Mover pasa SIEMPRE por una previsualizacion.
   *
   * Mover es estructural (4.1.2): si el destino tiene otro ambito, lo que se mueve lo hereda de
   * inmediato. Confirmar a ciegas es como se cambia el acceso de un modulo "solo para ordenar".
   */
  const pedirMovimiento = useCallback(async (nodeId: string, newParentId: string | null) => {
    setError(null);
    const op: TreeOperation = { type: 'mover', nodeId, newParentId };
    const r = await fetch('/api/admin/arbol?previsualizar=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(op),
    });
    const previo = (await r.json()) as Previsualizacion;
    if (!r.ok) {
      setError((previo as unknown as { error?: string }).error ?? 'No se pudo previsualizar.');
      return;
    }
    if (!previo.cambiaElAmbito) {
      await enviar(op);
      return;
    }
    setPendiente({ op, previo });
  }, [enviar]);

  const carpetas = recogerCarpetas(arbol.nodes);

  return (
    <div className="editor-arbol">
      {error ? (
        <p className="aviso aviso--error" role="alert" data-testid="error-arbol">
          {error}
        </p>
      ) : null}

      {pendiente ? (
        <div className="aviso aviso--atencion" role="alert" data-testid="confirmar-movimiento">
          <p>
            <strong>Esto cambia el acceso.</strong> Mover afecta a{' '}
            {pendiente.previo.moduleIds.length} modulo(s):{' '}
            <code>{pendiente.previo.moduleIds.join(', ')}</code>
          </p>
          <p className="texto-atenuado">
            Antes: {describirAmbito(pendiente.previo.scopeAntes)}
            <br />
            Despues: {describirAmbito(pendiente.previo.scopeDespues)}
          </p>
          <div className="aviso__acciones">
            <button
              type="button"
              data-testid="confirmar-movimiento-si"
              onClick={async () => {
                const ok = await enviar(pendiente.op);
                if (ok) setPendiente(null);
              }}
            >
              Mover de todas formas
            </button>
            <button type="button" className="boton-enlace" onClick={() => setPendiente(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <Nodos
        nodos={arbol.nodes}
        seleccionado={seleccionado}
        onSeleccionar={setSeleccionado}
        onMover={pedirMovimiento}
        onOperacion={enviar}
        carpetas={carpetas}
      />

      {arbol.trash.length > 0 ? (
        <section className="papelera" data-testid="papelera">
          <h3>Papelera ({arbol.trash.length})</h3>
          <p className="texto-atenuado">
            Nada se borra al eliminar: se puede restaurar a su carpeta original.
          </p>
          <ul className="lista-simple">
            {arbol.trash.map((t) => (
              <li key={t.node.id}>
                {t.node.type === 'folder' ? t.node.name : t.node.moduleRef.name}
                <button
                  type="button"
                  className="boton-enlace"
                  data-testid={`restaurar-${t.node.id}`}
                  onClick={() => void enviar({ type: 'restaurar', trashedNodeId: t.node.id })}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function recogerCarpetas(nodos: NavNode[], acumulado: { id: string; name: string }[] = []) {
  for (const nodo of nodos) {
    if (nodo.type === 'folder') {
      acumulado.push({ id: nodo.id, name: nodo.name });
      recogerCarpetas(nodo.children, acumulado);
    }
  }
  return acumulado;
}

function Nodos({
  nodos,
  seleccionado,
  onSeleccionar,
  onMover,
  onOperacion,
  carpetas,
  nivel = 0,
}: {
  nodos: NavNode[];
  seleccionado: string | null;
  onSeleccionar: (id: string) => void;
  onMover: (nodeId: string, newParentId: string | null) => void;
  onOperacion: (op: TreeOperation) => Promise<boolean>;
  carpetas: { id: string; name: string }[];
  nivel?: number;
}) {
  return (
    <ul className="editor-arbol__lista" data-nivel={nivel}>
      {nodos.map((nodo) => {
        const nombre = nodo.type === 'folder' ? nodo.name : nodo.moduleRef.name;
        const esCarpeta = nodo.type === 'folder';
        const activo = seleccionado === nodo.id;

        return (
          <li key={nodo.id}>
            <div
              className={`editor-arbol__nodo ${activo ? 'es-activo' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', nodo.id);
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                if (esCarpeta) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!esCarpeta) return;
                e.preventDefault();
                e.stopPropagation();
                const origen = e.dataTransfer.getData('text/plain');
                if (origen && origen !== nodo.id) onMover(origen, nodo.id);
              }}
            >
              <button
                type="button"
                className="editor-arbol__nombre"
                data-testid={`nodo-${nodo.id}`}
                aria-pressed={activo}
                onClick={() => onSeleccionar(nodo.id)}
              >
                {esCarpeta ? '📁' : '📄'} {nombre}
                {esCarpeta && nodo.scope ? (
                  <span className="insignia" title="Esta carpeta tiene ambito propio">
                    ambito
                  </span>
                ) : null}
              </button>

              {activo ? (
                <div className="editor-arbol__acciones">
                  {/* Alternativa accesible a arrastrar y soltar: misma operacion, con teclado. */}
                  <label>
                    <span className="visually-hidden">Mover a</span>
                    <select
                      data-testid={`mover-${nodo.id}`}
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        onMover(nodo.id, e.target.value === '__raiz__' ? null : e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Mover a…</option>
                      <option value="__raiz__">(raiz)</option>
                      {carpetas
                        .filter((c) => c.id !== nodo.id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className="boton-enlace"
                    data-testid={`renombrar-${nodo.id}`}
                    onClick={() => {
                      const nuevo = window.prompt('Nuevo nombre', nombre);
                      if (nuevo?.trim()) {
                        void onOperacion({ type: 'renombrar', nodeId: nodo.id, name: nuevo.trim() });
                      }
                    }}
                  >
                    Renombrar
                  </button>

                  <button
                    type="button"
                    className="boton-enlace"
                    data-testid={`papelera-${nodo.id}`}
                    onClick={() => void onOperacion({ type: 'enviar-a-papelera', nodeId: nodo.id })}
                  >
                    A la papelera
                  </button>
                </div>
              ) : null}
            </div>

            {esCarpeta ? (
              <Nodos
                nodos={nodo.children}
                seleccionado={seleccionado}
                onSeleccionar={onSeleccionar}
                onMover={onMover}
                onOperacion={onOperacion}
                carpetas={carpetas}
                nivel={nivel + 1}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
