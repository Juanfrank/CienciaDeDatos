'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Notification } from '@app/alerts';

/**
 * Campana de notificaciones.
 *
 * Sondea la bandeja cada poco porque las alertas se evaluan en el trabajador de fondo, fuera
 * del ciclo de cualquier solicitud (5.3): no hay una respuesta HTTP en la que pudiera venir el
 * aviso. Un sondeo corto es lo honesto mientras no haya un canal empujado; el dia que lo haya,
 * se sustituye aqui sin tocar nada mas.
 */

const INTERVALO_MS = 5_000;

export function Campana() {
  const pathname = usePathname();
  const [sinLeer, setSinLeer] = useState(0);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch('/api/notificaciones');
      if (!r.ok) return;
      const { sinLeer: n } = (await r.json()) as { sinLeer: number };
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
      <span className="campana__texto">Avisos</span>
      {sinLeer > 0 ? (
        <span className="campana__contador" data-testid="campana-contador">
          {sinLeer}
        </span>
      ) : null}
      {/* El numero no basta: un lector de pantalla leeria "Avisos 3" sin decir de que. */}
      <span className="visualmente-oculto">
        {sinLeer > 0 ? `${sinLeer} aviso(s) sin leer` : 'ningun aviso sin leer'}
      </span>
    </Link>
  );
}

export const kindLabel: Record<Notification['kind'], string> = {
  alerta: 'Alerta',
  'alerta-resuelta': 'Resuelta',
  suscripcion: 'Suscripcion',
};
