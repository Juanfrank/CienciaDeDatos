'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Notification } from '@app/alerts';

/** Campana de notificaciones. */

const INTERVALO_MS = 5_000;

export function Bell() {
  const pathname = usePathname();
  const [withoutRead, setSinLeer] = useState(0);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificaciones');
      if (!r.ok) return;
      const { withoutRead: n } = (await r.json()) as { withoutRead: number };
      setSinLeer(n);
    } catch {
      // Un sondeo fallido no es un error de la aplicacion: se reintenta en la vuelta siguiente.
    }
  }, []);

  useEffect(() => {
    void consultar();
    const t = setInterval(() => void consultar(), INTERVALO_MS);
    return () => clearInterval(t);
    // Se reconsulta al navegar: entrar en la pagina de avisos y leerlos tiene que bajar el
    // contador sin esperar a la siguiente vuelta del temporizador.
  }, [consultar, pathname]);

  return (
    <Link href="/avisos" className="campana" data-testid="campana">
      <span aria-hidden="true">🔔</span>
      <span className="bell__text">Avisos</span>
      {withoutRead > 0 ? (
        <span className="bell__contador" data-testid="campana-contador">
          {withoutRead}
        </span>
      ) : null}
      {/* El numero no basta: un lector de pantalla leeria "Avisos 3" sin decir de que. */}
      <span className="visualmente-oculto">
        {withoutRead > 0 ? `${withoutRead} aviso(s) sin leer` : 'ningun aviso sin leer'}
      </span>
    </Link>
  );
}

export const kindLabel: Record<Notification['kind'], string> = {
  alerta: 'Alerta',
  'alerta-resuelta': 'Resuelta',
  suscripcion: 'Suscripcion',
};
