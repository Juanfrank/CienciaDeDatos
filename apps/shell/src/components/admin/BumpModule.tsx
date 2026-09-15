'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from '../Locale';
import { subirObjeto, type Subida } from './bump';

/**
 * Subir un objeto a la ultima version dentro de un modulo — seccion 4.5.
 *
 * Un solo boton y un solo gesto: se pulsa y sube. Antes habia una confirmacion que ensenaba
 * «v1.0.0 → v1.4.0, lo que ya estaba configurado se conserva» y el resultado se escribia DENTRO
 * de la celda, que ensanchaba la columna y descuadraba la tabla. Las dos cosas se fueron al mismo
 * sitio: el informe sale por un mensaje emergente, con el nombre del objeto delante para que tres
 * mensajes seguidos digan cual fue cual.
 *
 * Traduce por su cuenta, con `useTranslator`, y no recibe las etiquetas ya hechas: tres de ellas
 * llevan un numero o una lista dentro, y una funcion no cruza de un componente de servidor a uno
 * de cliente — React aborta el renderizado entero con «Functions cannot be passed directly to
 * Client Components».
 */
export function BumpModule({ slug, objectId, nombre, desde, hasta }: Subida) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);

  /*
   * Los identificadores de prueba llevan modulo Y objeto.
   *
   * Con el modulo solo bastaba mientras el boton salia una vez por fila en «donde se usa» —ahi la
   * fila ES un modulo—. En la tabla de modulos sale uno por cada objeto atrasado del mismo
   * modulo, y `getByTestId` encontraria varios.
   */
  const clave = `${slug}-${objectId}`;

  return (
    <button
      type="button"
      className="boton-contorno"
      disabled={enCurso}
      data-testid={`bump-${clave}`}
      onClick={() => {
        setEnCurso(true);
        void subirObjeto({ slug, objectId, nombre, desde, hasta }, t).then(() => {
          setEnCurso(false);
          router.refresh();
        });
      }}
    >
      {enCurso ? t('admin.bump.doing') : t('admin.resources.action.bump')}
    </button>
  );
}
