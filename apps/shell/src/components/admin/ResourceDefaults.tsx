'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IconName, ObjectInstance, ObjectPresentation, PresentationKey } from '@app/ui-components';
import { Presentation } from '../editor/Presentation';
import { pedir, motivoDeFallo } from '../pedir';
import { useTranslator } from '../Locale';

/**
 * Con que presentacion NACE un objeto recien colocado — secciones 4.2, 4.3 y 4.5.
 *
 * Es el mismo panel de Formato del editor, no una copia suya. Escribir aqui una segunda version de
 * los mismos cien controles garantiza que se separen: se anade una seccion al panel del editor y
 * esta se queda sin ella, y entonces hay dos sitios donde configurar lo mismo que ya no configuran
 * lo mismo. Por eso lo que se le pasa es una INSTANCIA sintetica del objeto —una que no vive en
 * ningun modulo— y lo que se guarda es su presentacion.
 *
 * Lo que esto NO hace es congelar nada. Quien edita un modulo sigue cambiando cada objeto como
 * siempre; lo unico que cambia es el punto de partida. Sirve para que la decision de la institucion
 * —aqui la leyenda va abajo, aqui las barras no llevan rejilla— se tome una vez y no quince, una
 * por cada quien que coloque un grafico y se acuerde de ajustarlo.
 *
 * No se guarda solo: el editor de modulos autoguarda porque lo que se pierde al salir es el trabajo
 * de quien escribe, y aqui lo que se toca afecta a todo lo que se coloque a partir de ahora. Eso se
 * confirma.
 */
export function ResourceDefaults({
  objectId,
  nombre,
  version,
  admitidas,
  iconos,
  inicial,
}: {
  objectId: string;
  nombre: string;
  version: string;
  admitidas: PresentationKey[];
  iconos: IconName[];
  inicial: ObjectPresentation;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [presentation, setPresentation] = useState<ObjectPresentation>(inicial);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  /*
   * La instancia sintetica.
   *
   * `instanceId` es el del objeto y no un identificador al azar: el panel lo usa para componer sus
   * `data-testid`, asi que uno estable hace que la pantalla se pueda mirar sin adivinar el nombre.
   * El `binding` va vacio porque aqui no hay dataset —se esta configurando el objeto, no una cifra
   * suya—, y por eso los controles que dependen de campos no ofrecen ninguno: es correcto, no una
   * carencia. Lo que no depende de datos, que es casi todo el panel, funciona igual.
   */
  const instancia: ObjectInstance = {
    instanceId: objectId,
    objectId,
    version,
    title: nombre,
    binding: { datasetId: '', dimensions: [], measures: [] },
    presentation,
  };

  const aplicar = (cambio: (i: ObjectInstance) => ObjectInstance) => {
    setGuardado(false);
    setPresentation(cambio(instancia).presentation ?? {});
  };

  async function guardar(cual: ObjectPresentation) {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'predeterminar', objectId, presentation: cual }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, 'No se pudo guardar.'));
      return;
    }
    setPresentation(cual);
    setGuardado(true);
    // Para que la tabla de recursos ensene «configurado» sin recargar a mano.
    router.refresh();
  }

  return (
    <>
      <Presentation
        instance={instancia}
        admitidas={admitidas}
        iconos={iconos}
        // Sin dataset no hay columnas, y por tanto ningun tipo que ofrecer.
        kinds={{}}
        saving={enCurso}
        onCambiar={aplicar}
      />

      <p className="fila-acciones">
        <button
          type="button"
          className="pastilla"
          disabled={enCurso}
          data-testid="predeterminar-guardar"
          onClick={() => void guardar(presentation)}
        >
          {t('action.save')}
        </button>
        {/*
          Volver al punto de partida del catalogo, que es lo que hace falta cuando lo que se
          configuro resulto peor que lo que habia. Sin esto, «quitar el predeterminado» obligaria a
          devolver a mano cada control que se toco, y quedaria alguno puesto sin que nadie lo viera.
        */}
        <button
          type="button"
          className="button-link"
          disabled={enCurso || Object.keys(presentation).length === 0}
          data-testid="predeterminar-limpiar"
          onClick={() => void guardar({})}
        >
          {t('admin.resources.clearDefault')}
        </button>
      </p>

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="predeterminar-error">
          {error}
        </p>
      ) : null}
      {guardado && !error ? (
        <p className="aviso notice-ok" role="status" data-testid="predeterminar-guardado">
          Guardado. Los objetos que se coloquen a partir de ahora nacen asi; los que ya estan
          puestos no cambian.
        </p>
      ) : null}
    </>
  );
}
