'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslator } from '../Locale';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Las dos acciones que solo tiene una carpeta: renombrar y mandar a la papelera.
 *
 * No estan en `TreeActions` porque alli no aplican a un modulo: un modulo se renombra en su
 * configuracion, junto a su slug y su descripcion, y borrarlo es otra operacion con otras reglas
 * —lo publicado no se borra—. Meterlas alli obligaria a apagarlas en la mitad de las filas.
 *
 * Mandar a la papelera no borra: lo eliminado se puede devolver a su carpeta de origen, y por eso
 * no pregunta antes. Lo que si avisa es de lo que se lleva consigo, que es lo que no se ve.
 */
export function FolderActions({
  nodeId,
  nombre,
  modulos,
}: {
  nodeId: string;
  nombre: string;
  /** Lo que cuelga de ella. Mandar a la papelera una carpeta se lleva su contenido. */
  modulos: number;
}) {
  const t = useTranslator();
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [nuevo, setNuevo] = useState(nombre);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (operacion: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/tree', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(operacion),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.tree.action.failed')));
      return;
    }
    dialogo.current?.close();
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        className="button-link"
        disabled={enCurso}
        title={t('admin.tree.action.rename')}
        aria-label={`${t('admin.tree.action.rename')}: ${nombre}`}
        data-testid={`rename-${nodeId}`}
        onClick={() => {
          setNuevo(nombre);
          setError(null);
          dialogo.current?.showModal();
        }}
      >
        <Icon nombre="editar" tamano={18} />
      </button>

      <button
        type="button"
        className="button-link"
        disabled={enCurso}
        title={t('admin.tree.action.trash')}
        aria-label={`${t('admin.tree.action.trash')}: ${nombre}`}
        data-testid={`trash-${nodeId}`}
        onClick={() => void enviar({ type: 'enviar-a-papelera', nodeId })}
      >
        <Icon nombre="close" tamano={18} />
      </button>

      {error ? (
        <span className="aviso notice-error" role="alert" data-testid={`error-${nodeId}`}>
          {error}
        </span>
      ) : null}

      <dialog className="dialogo" ref={dialogo} data-testid={`dialogo-rename-${nodeId}`}>
        <div className="dialogo__cabecera">
          <h2>{t('admin.tree.action.rename')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid={`cerrar-rename-${nodeId}`}
            onClick={() => dialogo.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        {/* Lo que se lleva consigo se dice AQUI y no en la papelera: alli ya es tarde. */}
        <p className="muted-text">{t('admin.tree.folder.holds', { n: modulos })}</p>

        <label className="form__field">
          <span>{t('list.name')}</span>
          <input
            value={nuevo}
            data-testid={`rename-campo-${nodeId}`}
            onChange={(e) => setNuevo(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || nuevo.trim() === '' || nuevo === nombre}
          data-testid={`rename-guardar-${nodeId}`}
          onClick={() => void enviar({ type: 'renombrar', nodeId, name: nuevo.trim() })}
        >
          {t('action.save')}
        </button>
      </dialog>
    </>
  );
}
