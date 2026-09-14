'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';

/**
 * Las seis acciones de una fila del arbol — secciones 4.1 y 4.10.8.
 *
 * Van como icono y no como texto porque son seis por fila y en un arbol de veinte filas eso son
 * ciento veinte palabras. Cada una lleva su nombre en `title` y en `aria-label`, que es lo que
 * 4.9 exige: un lector de pantalla las anuncia enteras y el raton las ensena al pasar por encima.
 *
 * Subir, bajar y mover a escriben por `/api/admin/tree`, que es el MISMO camino que el editor del
 * arbol. Mover no es cosmetico —si la carpeta de destino tiene otro ambito, lo que se mueve
 * hereda ese ambito de inmediato (4.1.2)— y por eso el destino se elige y se confirma, no se
 * arrastra sin mas.
 */
export interface DestinoPosible {
  id: string | null;
  /** Con la sangria ya puesta, para que se lea como el arbol que es. */
  etiqueta: string;
}

export function TreeActions({
  nodeId,
  hidden,
  indice,
  puedeSubir,
  puedeBajar,
  destinos,
  hrefConfigurar,
  hrefPermisos,
  nombre,
}: {
  nodeId: string;
  hidden: boolean;
  /*
   * Posicion actual entre sus hermanos.
   *
   * Viaja desde el servidor porque `reordenar` toma un indice ABSOLUTO, y el cliente no conoce el
   * arbol. Inventar aqui una operacion relativa habria dado un segundo camino para lo mismo, que
   * es como acaban dos comportamientos distintos para el mismo gesto.
   */
  indice: number;
  /** El primero de su carpeta no sube, el ultimo no baja: el boton se apaga, no falla al pulsarlo. */
  puedeSubir: boolean;
  puedeBajar: boolean;
  destinos: DestinoPosible[];
  hrefConfigurar: string;
  hrefPermisos: string;
  /** Para los rotulos accesibles: «Subir: Distrito Norte» dice mas que «Subir». */
  nombre: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState(false);

  const enviar = async (operacion: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await fetch('/api/admin/tree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(operacion),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? t('admin.tree.action.failed'));
      return;
    }
    setMoviendo(false);
    router.refresh();
  };

  const rotuloVisible = hidden ? t('admin.tree.action.show') : t('admin.tree.action.hide');

  return (
    <>
      <span className="fila-acciones">
        <button
          type="button"
          className="button-link"
          disabled={enCurso || !puedeSubir}
          title={t('admin.tree.action.up')}
          aria-label={`${t('admin.tree.action.up')}: ${nombre}`}
          data-testid={`subir-${nodeId}`}
          onClick={() => void enviar({ type: 'reordenar', nodeId, index: indice - 1 })}
        >
          <Icon nombre="flecha-arriba" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso || !puedeBajar}
          title={t('admin.tree.action.down')}
          aria-label={`${t('admin.tree.action.down')}: ${nombre}`}
          data-testid={`bajar-${nodeId}`}
          onClick={() => void enviar({ type: 'reordenar', nodeId, index: indice + 1 })}
        >
          <Icon nombre="flecha-abajo" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso}
          title={t('admin.tree.action.moveTo')}
          aria-label={`${t('admin.tree.action.moveTo')}: ${nombre}`}
          aria-expanded={moviendo}
          data-testid={`mover-${nodeId}`}
          onClick={() => setMoviendo((previo) => !previo)}
        >
          <Icon nombre="mover" tamano={18} />
        </button>

        <button
          type="button"
          className="button-link"
          disabled={enCurso}
          title={rotuloVisible}
          aria-label={`${rotuloVisible}: ${nombre}`}
          aria-pressed={hidden}
          data-testid={`ocultar-${nodeId}`}
          onClick={() => void enviar({ type: 'ocultar', nodeId, hidden: !hidden })}
        >
          <Icon nombre={hidden ? 'ojo-tachado' : 'ojo'} tamano={18} />
        </button>

        <Link
          href={hrefConfigurar}
          className="button-link"
          title={t('admin.tree.action.configure')}
          aria-label={`${t('admin.tree.action.configure')}: ${nombre}`}
          data-testid={`configurar-${nodeId}`}
        >
          <Icon nombre="tuerca" tamano={18} />
        </Link>

        <Link
          href={hrefPermisos}
          className="button-link"
          title={t('admin.tree.action.permissions')}
          aria-label={`${t('admin.tree.action.permissions')}: ${nombre}`}
          data-testid={`permisos-${nodeId}`}
        >
          <Icon nombre="persona-ojo" tamano={18} />
        </Link>
      </span>

      {/*
        El destino se ELIGE de una lista del arbol, no se escribe.
        Y se avisa de lo que implica: mover algo a una carpeta con otro ambito cambia quien lo ve,
        de inmediato y sin volver a preguntar.
      */}
      {moviendo ? (
        <div className="mover-a" role="group" aria-label={`${t('admin.tree.action.moveTo')}: ${nombre}`}>
          <p className="muted-text">{t('admin.tree.move.warn')}</p>
          <ul className="simple-list">
            {destinos.map((destino) => (
              <li key={destino.id ?? '__raiz__'}>
                <button
                  type="button"
                  className="boton-contorno"
                  disabled={enCurso}
                  data-testid={`mover-${nodeId}-a-${destino.id ?? 'raiz'}`}
                  onClick={() =>
                    void enviar({ type: 'mover', nodeId, newParentId: destino.id })
                  }
                >
                  {destino.etiqueta}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`error-arbol-${nodeId}`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
