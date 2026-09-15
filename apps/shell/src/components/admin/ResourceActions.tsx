'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '../icons/Icon';
import { pedir, motivoDeFallo } from '../pedir';

/**
 * Las acciones de una fila de la tabla de recursos.
 *
 * Van como ICONO con texto accesible, no como texto: en una tabla de quince filas, dos palabras
 * por fila y por accion convierten la columna en un parrafo. El nombre viaja en `aria-label` y en
 * el `title`, asi que un lector de pantalla lo anuncia entero y el raton lo ensena al pasar por
 * encima — que es lo que 4.9 exige y lo que un «✓» suelto no da.
 *
 * «Editar» no edita el objeto: el catalogo es codigo (4.5). Lleva a proponer una version, que es
 * lo que una persona SI puede hacer desde aqui.
 */
export function ResourceActions({
  id,
  disabled,
  etiquetas,
}: {
  id: string;
  disabled: boolean;
  etiquetas: { editar: string; deshabilitar: string; habilitar: string };
}) {
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alternar() {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'deshabilitar', objectId: id, disabled: !disabled }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, 'No se pudo cambiar.'));
      return;
    }
    router.refresh();
  }

  const rotulo = disabled ? etiquetas.habilitar : etiquetas.deshabilitar;

  return (
    <>
      <span className="fila-acciones">
        <Link
          href={`/admin/resources/proposals?objeto=${encodeURIComponent(id)}`}
          className="button-link"
          title={etiquetas.editar}
          aria-label={`${etiquetas.editar}: ${id}`}
          data-testid={`editar-${id}`}
        >
          <Icon nombre="editar" tamano={18} />
        </Link>
        <button
          type="button"
          className="button-link"
          disabled={enCurso}
          title={rotulo}
          aria-label={`${rotulo}: ${id}`}
          data-testid={`deshabilitar-${id}`}
          aria-pressed={disabled}
          onClick={() => void alternar()}
        >
          <Icon nombre={disabled ? 'ojo' : 'ojo-tachado'} tamano={18} />
        </button>
      </span>
      {error ? (
        <p className="aviso notice-error" role="alert" data-testid={`error-${id}`}>
          {error}
        </p>
      ) : null}
    </>
  );
}
