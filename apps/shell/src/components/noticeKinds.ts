import type { Notification } from '@app/alerts';

/**
 * Como se llama cada clase de aviso en pantalla.
 *
 * Vivia en `Bell.tsx`, que era la campana de la cabecera. La campana desaparecio al pasar los
 * avisos al menu de la cuenta, y esto no tenia por que irse con ella: lo usa la bandeja.
 */
export const kindLabel: Record<Notification['kind'], string> = {
  alerta: 'Alerta',
  'alerta-resuelta': 'Resuelta',
  suscripcion: 'Suscripcion',
};
