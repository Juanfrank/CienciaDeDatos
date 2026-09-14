'use client';

import { useCallback, useState } from 'react';
import type { ManagedTree, NavNode, TreeOperation } from '@app/access-control';

/** Editor de la organizacion general — seccion 4.10.8. */

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

export function TreeEditor({ initial }: { initial: ManagedTree }) {
  const [arbol, setArbol] = useState<ManagedTree>(initial);
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
    const body = await r.json();
    if (!r.ok) {
      setError(body.error ?? 'No se pudo aplicar la operacion.');
      return false;
    }
    setArbol(body.arbol as ManagedTree);
    return true;
  }, []);

  /** Mover pasa SIEMPRE por una previsualizacion. */
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
    <div className="tree-editor">
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="error-arbol">
          {error}
        </p>
      ) : null}

      {pendiente ? (
        <div className="aviso notice-atencion" role="alert" data-testid="confirmar-movimiento">
          <p>
            <strong>Esto cambia el acceso.</strong> Mover afecta a{' '}
            {pendiente.previo.moduleIds.length} modulo(s):{' '}
            <code>{pendiente.previo.moduleIds.join(', ')}</code>
          </p>
          <p className="muted-text">
            Antes: {describirAmbito(pendiente.previo.scopeAntes)}
            <br />
            Despues: {describirAmbito(pendiente.previo.scopeDespues)}
          </p>
          <div className="notice__actions">
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

      <Nodes
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
          <p className="muted-text">
            Nada se borra al eliminar: se puede restaurar a su carpeta original.
          </p>
          <ul className="simple-list">
            {arbol.trash.map((t) => (
              <li key={t.node.id}>
                {t.node.type === 'folder' ? t.node.name : t.node.moduleRef.name}
                <button
                  type="button"
                  className="boton-enlace"
                  data-testid={`restore-${t.node.id}`}
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
  for (const node of nodos) {
    if (node.type === 'folder') {
      acumulado.push({ id: node.id, name: node.name });
      recogerCarpetas(node.children, acumulado);
    }
  }
  return acumulado;
}

function Nodes({
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
    <ul className="tree-editor__list" level-data={nivel}>
      {nodos.map((node) => {
        const nombre = node.type === 'folder' ? node.name : node.moduleRef.name;
        const esCarpeta = node.type === 'folder';
        const activo = seleccionado === node.id;

        return (
          <li key={node.id}>
            <div
              className={`tree-editor__node ${activo ? 'is-active' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', node.id);
                e.stopPropagation();
              }}
              onDragOver={(e) => {
                if (esCarpeta) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!esCarpeta) return;
                e.preventDefault();
                e.stopPropagation();
                const source = e.dataTransfer.getData('text/plain');
                if (source && source !== node.id) onMover(source, node.id);
              }}
            >
              <button
                type="button"
                className="tree-editor__name"
                data-testid={`node-${node.id}`}
                aria-pressed={activo}
                onClick={() => onSeleccionar(node.id)}
              >
                {esCarpeta ? '📁' : '📄'} {nombre}
                {esCarpeta && node.scope ? (
                  <span className="insignia" title="Esta carpeta tiene ambito propio">
                    ambito
                  </span>
                ) : null}
              </button>

              {activo ? (
                <div className="tree-editor__actions">
                  {/* Alternativa accesible a arrastrar y soltar: misma operacion, con teclado. */}
                  <label>
                    <span className="visually-hidden">Mover a</span>
                    <select
                      data-testid={`move-${node.id}`}
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return;
                        onMover(node.id, e.target.value === '__raiz__' ? null : e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Mover a…</option>
                      <option value="__raiz__">(raiz)</option>
                      {carpetas
                        .filter((c) => c.id !== node.id)
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
                    data-testid={`rename-${node.id}`}
                    onClick={() => {
                      const nuevo = window.prompt('Nuevo nombre', nombre);
                      if (nuevo?.trim()) {
                        void onOperacion({ type: 'renombrar', nodeId: node.id, name: nuevo.trim() });
                      }
                    }}
                  >
                    Renombrar
                  </button>

                  <button
                    type="button"
                    className="boton-enlace"
                    data-testid={`trash-${node.id}`}
                    onClick={() => void onOperacion({ type: 'enviar-a-papelera', nodeId: node.id })}
                  >
                    A la papelera
                  </button>
                </div>
              ) : null}
            </div>

            {esCarpeta ? (
              <Nodes
                nodos={node.children}
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
