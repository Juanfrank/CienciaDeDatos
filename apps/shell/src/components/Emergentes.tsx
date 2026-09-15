'use client';

import { Icon } from './icons/Icon';
import { useTranslator } from './Locale';
import { descartarEmergente, useEmergentes } from './emergentes';

/**
 * La pila de mensajes emergentes, arriba y centrada.
 *
 * `role="status"` y no `role="alert"`: esto informa de algo que ya salio bien, no interrumpe. Un
 * `alert` corta lo que el lector de pantalla este diciendo, y para «objeto subido a v1.4.0» eso
 * es mas molesto que util.
 *
 * Se dibuja una sola vez, en la disposicion raiz, y cualquiera puede poner un mensaje llamando a
 * `emergente()`. Uno por cosa que paso: tres objetos subidos de version son tres mensajes, porque
 * «se subieron 3 objetos» no dice CUALES y es justo lo que hay que poder comprobar.
 */
export function Emergentes() {
  const t = useTranslator();
  const mensajes = useEmergentes();

  return (
    <div className="emergentes" role="status" aria-live="polite" data-testid="emergentes">
      {mensajes.map((m) => (
        <div key={m.id} className="emergente" data-clase={m.clase} data-testid="emergente">
          <span className="emergente__texto">{m.texto}</span>
          <button
            type="button"
            className="emergente__cerrar"
            aria-label={t('action.close')}
            data-testid={`emergente-cerrar-${m.id}`}
            onClick={() => descartarEmergente(m.id)}
          >
            <Icon nombre="close" tamano={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
