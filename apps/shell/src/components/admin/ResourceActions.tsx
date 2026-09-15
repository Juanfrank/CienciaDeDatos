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
 * «Editar» no edita el OBJETO: el catalogo es codigo (4.5). Lleva a su configuracion de salida —
 * con que formato nace cada uno que se coloque—, que es metadato de gobierno y no codigo, igual
 * que «este objeto ya no se ofrece». Cambiar el objeto es lo otro, «proponer», que va aparte
 * porque pasa por revision de pares y una version nueva.
 *
 * Las dos son acciones distintas y por eso son dos botones. Con el lapiz llevando a proponer, lo
 * unico que se podia hacer desde una fila era pedir que alguien reescribiera el objeto, para algo
 * —el formato de salida— que no necesita tocarlo.
 *
 * Las dos son OPCIONALES porque esta misma columna sirve a la tabla de iconos e imagenes, y un
 * icono no tiene ni panel de Formato ni versiones que proponer: lo unico que se decide sobre el es
 * si se ofrece. Antes las llevaba igual, y el lapiz de un icono abria el formulario de proponer
 * una version de un objeto que no existe.
 */
export function ResourceActions({
  id,
  disabled,
  etiquetas,
}: {
  id: string;
  disabled: boolean;
  etiquetas: { editar?: string; proponer?: string; deshabilitar: string; habilitar: string };
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
        {etiquetas.editar ? (
          <Link
            href={`/admin/resources/defaults/${encodeURIComponent(id)}`}
            className="button-link"
            title={etiquetas.editar}
            aria-label={`${etiquetas.editar}: ${id}`}
            data-testid={`editar-${id}`}
          >
            <Icon nombre="editar" tamano={18} />
          </Link>
        ) : null}
        {etiquetas.proponer ? (
          <Link
            href={`/admin/resources/proposals?objeto=${encodeURIComponent(id)}`}
            className="button-link"
            title={etiquetas.proponer}
            aria-label={`${etiquetas.proponer}: ${id}`}
            data-testid={`proponer-${id}`}
          >
            <Icon nombre="registro" tamano={18} />
          </Link>
        ) : null}
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
