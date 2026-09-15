'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ManagedTree } from '@app/access-control';
import { useTranslator } from '../Locale';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Lo eliminado del arbol, con su boton de devolverlo.
 *
 * Es lo unico del editor de arbol anterior que la tabla de carpetas no cubre, asi que sale de el
 * y se queda como pieza propia. Existe por una razon concreta: eliminar un nodo no borra nada, y
 * si la papelera no se ve, «eliminar» parece definitivo y nadie se atreve a reorganizar.
 */
export function Papelera({ arbol }: { arbol: ManagedTree }) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (arbol.trash.length === 0) return null;

  const restaurar = async (trashedNodeId: string) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/tree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'restaurar', trashedNodeId }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }
    router.refresh();
  };

  return (
    <section className="papelera" data-testid="papelera">
      <h3>{t('admin.tree.trash', { n: arbol.trash.length })}</h3>
      <p className="muted-text">{t('admin.tree.trash.intro')}</p>

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="error-papelera">
          {error}
        </p>
      ) : null}

      <ul className="simple-list">
        {arbol.trash.map((entrada) => (
          <li key={entrada.node.id}>
            {entrada.node.type === 'folder' ? entrada.node.name : entrada.node.moduleRef.name}{' '}
            <button
              type="button"
              className="button-link"
              disabled={enCurso}
              data-testid={`restore-${entrada.node.id}`}
              onClick={() => void restaurar(entrada.node.id)}
            >
              {t('admin.tree.restore')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
