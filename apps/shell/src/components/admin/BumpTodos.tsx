'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';
import { subirObjeto, type Subida } from './bump';

/**
 * Subir TODOS los objetos atrasados de una pantalla, de una vez — seccion 4.5.
 *
 * Existe porque un modulo con treinta objetos y ocho atrasados obligaba a ocho gestos iguales,
 * y la tentacion de ese trabajo es no hacerlo: lo que queda entonces es un modulo sirviendo
 * versiones viejas porque subirlas era tedioso, no porque nadie decidiera no subirlas.
 *
 * Van UNO A UNO y en orden, no en paralelo. Cada subida reescribe la definicion entera del
 * modulo, asi que dos a la vez sobre el mismo modulo se pisan: la segunda lee la definicion de
 * antes de la primera y la vuelve a escribir sin sus cambios. Y cada una deja su propio mensaje,
 * con el nombre del objeto delante: un solo «se subieron ocho» no dice cual perdio una clave.
 */
export function BumpTodos({ subidas, testid }: { subidas: Subida[]; testid: string }) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);

  if (subidas.length === 0) return null;

  const subirTodos = async () => {
    setEnCurso(true);
    for (const subida of subidas) {
      // Si una falla se sigue con las demas: son objetos distintos, y parar dejaria la mitad
      // subida sin que nada dijera por donde se quedo.
      await subirObjeto(subida, t);
    }
    setEnCurso(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      className="pastilla"
      disabled={enCurso}
      data-testid={`bump-todos-${testid}`}
      onClick={() => void subirTodos()}
    >
      {enCurso ? t('admin.bump.doing') : t('admin.bump.all', { n: subidas.length })}
    </button>
  );
}
