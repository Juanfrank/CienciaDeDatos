'use client';

import { Grid } from '../Grid';
import { ModuleObject } from '../ModuleObject';
import type { SerializedObject } from '../../server/serialize';

/**
 * Los objetos de una version publicada, dibujados y nada mas.
 *
 * No se reutiliza `ModuleView` a proposito: aquella trae exportar, embeber, marcadores y «mi
 * vista», y las cuatro actuan sobre el modulo VIVO. Exportar desde aqui habria sacado un fichero
 * con el nombre de la version vieja y el contenido de la nueva, y un marcador guardado sobre esta
 * pantalla habria llevado a una foto, no al modulo.
 */
export function VersionAntigua({ objetos }: { objetos: SerializedObject[] }) {
  const porId = new Map(objetos.map((o) => [o.itemId, o]));

  return (
    <Grid items={objetos.map((o) => ({ id: o.itemId, position: o.position }))}>
      {(id) => {
        const objeto = porId.get(id);
        return objeto ? <ModuleObject objeto={objeto} /> : null;
      }}
    </Grid>
  );
}
