'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Cierre de sesion (4.7).
 *
 * Llama a DELETE /api/acceso, que REVOCA la sesion del lado servidor ademas de borrar la cookie.
 * Borrar solo la cookie dejaria la sesion viva en el almacen: quien tuviera el identificador
 * —una copia de la cookie tomada antes— seguiria dentro despues de "cerrar sesion".
 */
export function CerrarSesion({ usuario }: { usuario: string }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  const salir = async () => {
    setSaliendo(true);
    await fetch('/api/acceso', { method: 'DELETE' });
    // replace y no push: volver atras no debe devolver a una pagina de dentro.
    router.replace('/acceso');
    router.refresh();
  };

  return (
    <button
      type="button"
      className="boton-enlace"
      data-testid="cerrar-sesion"
      disabled={saliendo}
      onClick={() => void salir()}
    >
      Salir · {usuario}
    </button>
  );
}
