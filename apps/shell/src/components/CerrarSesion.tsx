'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Cierre de sesion (4.7). */
export function CerrarSesion({ user }: { user: string }) {
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
      Salir · {user}
    </button>
  );
}
