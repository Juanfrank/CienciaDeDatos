'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SEMANTIC_ROLES,
  SHADOW_SHAPE_NAMES,
  SHAPE_SCALE_NAMES,
  SOURCE_ROLES,
  TYPEFACE_NAMES,
  TYPE_SCALE_NAMES,
  type ShadowShapeId,
  type ShapeScaleId,
  type ThemeDefinition,
  type ThemeSource,
  type TypeScaleId,
  type TypefaceId,
} from '@app/design-tokens';
import { useTranslator } from '../Locale';
import { pedir, motivoDeFallo } from '../pedir';

/** Los cinco ejes de estilo, tal como se guardan. */
interface Estilo {
  typeface: TypefaceId;
  typeScale: TypeScaleId;
  cornerRadius: ShapeScaleId;
  shadowShape: ShadowShapeId;
  shadowTint: 'neutra' | 'de-marca';
}

const ESTILO_INSTITUCIONAL: Estilo = {
  typeface: 'institucional',
  typeScale: 'material',
  cornerRadius: 'material',
  shadowShape: 'material',
  shadowTint: 'neutra',
};

/**
 * Crear un tema, activarlo y borrarlo — seccion 4.3.
 *
 * Del color se eligen los ORIGENES, no los tokens: Material Design 3 deriva de ellos los de cada
 * modo, y editar un token suelto rompe la relacion de contraste que 4.9 exige. Por eso hay tres
 * campos de color obligatorios y no cuarenta.
 *
 * Del resto —la letra, la escala, los radios y la sombra— se elige de listas CERRADAS y no se
 * escribe nada. Cada una de esas listas existe por su propia razon, escritas donde se declaran,
 * y todas terminan en la misma: el valor acaba en una variable CSS, y un campo libre ahi es una
 * superficie de inyeccion abierta para poder elegir entre dos opciones.
 *
 * Que esta pantalla pueda expresar TODO lo que un tema de fabrica expresa no es un detalle. El
 * dia que no pueda, habra temas que solo se pueden escribir tocando el codigo, y el panel dejara
 * de ser la forma de administrar para pasar a ser la forma facil de administrar.
 *
 * Y por eso el servidor RECHAZA —no avisa— un origen cuyo contraste no llegue: una pantalla que
 * solo avisara dejaria el tema entrar igual, y a partir de ahi la aplicacion entera incumpliria AA
 * hasta que alguien volviera a mirar aqui.
 */
export function ThemeForm({ base }: { base: ThemeSource }) {
  const t = useTranslator();
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [origen, setOrigen] = useState<ThemeSource>(base);
  const [estilo, setEstilo] = useState<Estilo>(ESTILO_INSTITUCIONAL);
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setEnCurso(true);
    setError(null);
    const tema: ThemeDefinition = {
      id: `tema-${crypto.randomUUID()}`,
      name: nombre,
      source: origen,
      ...estilo,
      ...(descripcion.trim() ? { description: descripcion } : {}),
    };
    const respuesta = await pedir('/api/admin/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', tema }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.themes.failed')));
      return;
    }
    dialogo.current?.close();
    router.refresh();
  };

  return (
    <>
      <p className="barra-de-acciones">
        <button
          type="button"
          className="pastilla"
          data-testid="abrir-crear-tema"
          onClick={() => {
            setError(null);
            setNombre('');
            setDescripcion('');
            // Se parte del origen del tema de fabrica: tres campos en blanco obligan a inventarse
            // tres colores antes de poder ver nada, y casi siempre lo que se quiere es una
            // variante de lo que ya hay.
            setOrigen(base);
            setEstilo(ESTILO_INSTITUCIONAL);
            dialogo.current?.showModal();
          }}
        >
          {t('admin.themes.create')}
        </button>
      </p>

      <dialog className="dialogo" ref={dialogo} data-testid="dialogo-crear-tema">
        <div className="dialogo__cabecera">
          <h2>{t('admin.themes.create')}</h2>
          <button
            type="button"
            className="boton-contorno"
            data-testid="cerrar-crear-tema"
            onClick={() => dialogo.current?.close()}
          >
            {t('action.cancel')}
          </button>
        </div>

        <p className="muted-text">{t('admin.themes.create.intro')}</p>

        {error ? (
          <p className="aviso notice-error" role="alert" data-testid="crear-tema-error">
            {error}
          </p>
        ) : null}

        <label className="form__field">
          <span>{t('list.name')}</span>
          <input
            value={nombre}
            data-testid="nuevo-tema-nombre"
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>

        <label className="form__field">
          <span>{t('admin.settings.description')}</span>
          <input
            value={descripcion}
            data-testid="nuevo-tema-descripcion"
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>

        {SOURCE_ROLES.map((rol) => (
          <label key={rol} className="form__field">
            <span>{t(`admin.themes.source.${rol}` as never)}</span>
            <span className="campo-de-color">
              {/*
                Dos controles sobre el MISMO valor: el selector nativo para elegir mirando, y el
                campo de texto para pegar un hexadecimal de la norma de marca. Solo con el selector
                no se puede pegar un color exacto; solo con el texto, hay que saberselo.
              */}
              <input
                type="color"
                value={origen[rol]}
                aria-label={t(`admin.themes.source.${rol}` as never)}
                data-testid={`nuevo-tema-${rol}-color`}
                onChange={(e) => setOrigen((previo) => ({ ...previo, [rol]: e.target.value }))}
              />
              <input
                value={origen[rol]}
                data-testid={`nuevo-tema-${rol}`}
                onChange={(e) => setOrigen((previo) => ({ ...previo, [rol]: e.target.value }))}
              />
            </span>
          </label>
        ))}

        <h3>{t('admin.themes.semantic')}</h3>
        <p className="muted-text">{t('admin.themes.semantic.intro')}</p>

        {/*
          Aqui NO hay selector nativo de color, y es a proposito.
          Un `input type="color"` no sabe estar vacio: nada mas dibujarse ya vale negro, y
          entonces «no lo he dicho» —que es lo normal y lo que hay que poder expresar— seria
          imposible de escribir en esta pantalla.
        */}
        {SEMANTIC_ROLES.map((rol) => (
          <label key={rol} className="form__field">
            <span>{t(`admin.themes.source.${rol}` as never)}</span>
            <input
              value={origen[rol] ?? ''}
              placeholder={t('admin.themes.semantic.default')}
              data-testid={`nuevo-tema-${rol}`}
              onChange={(e) => setOrigen((previo) => ({ ...previo, [rol]: e.target.value }))}
            />
          </label>
        ))}

        <h3>{t('admin.themes.style')}</h3>

        <EjeDeEstilo
          eje="typeface"
          opciones={TYPEFACE_NAMES}
          valor={estilo.typeface}
          alElegir={(v) => setEstilo((previo) => ({ ...previo, typeface: v }))}
        />
        <EjeDeEstilo
          eje="typeScale"
          opciones={TYPE_SCALE_NAMES}
          valor={estilo.typeScale}
          alElegir={(v) => setEstilo((previo) => ({ ...previo, typeScale: v }))}
        />
        <EjeDeEstilo
          eje="cornerRadius"
          opciones={SHAPE_SCALE_NAMES}
          valor={estilo.cornerRadius}
          alElegir={(v) => setEstilo((previo) => ({ ...previo, cornerRadius: v }))}
        />
        <EjeDeEstilo
          eje="shadowShape"
          opciones={SHADOW_SHAPE_NAMES}
          valor={estilo.shadowShape}
          alElegir={(v) => setEstilo((previo) => ({ ...previo, shadowShape: v }))}
        />
        <EjeDeEstilo
          eje="shadowTint"
          opciones={{
            neutra: t('admin.themes.shadowTint.neutra'),
            'de-marca': t('admin.themes.shadowTint.de-marca'),
          }}
          valor={estilo.shadowTint}
          alElegir={(v) => setEstilo((previo) => ({ ...previo, shadowTint: v }))}
        />

        <button
          type="button"
          className="pastilla"
          disabled={enCurso || nombre.trim() === ''}
          data-testid="crear-tema"
          onClick={() => void crear()}
        >
          {t('action.save')}
        </button>
      </dialog>
    </>
  );
}

/**
 * Un eje de estilo, como lista desplegable.
 *
 * Desplegable y no campo de texto: el conjunto es cerrado, y una lista es la unica forma de que
 * quien elige VEA que opciones hay sin tener que ir a leer el codigo que las declara.
 */
function EjeDeEstilo<V extends string>({
  eje,
  opciones,
  valor,
  alElegir,
}: {
  eje: 'typeface' | 'typeScale' | 'cornerRadius' | 'shadowShape' | 'shadowTint';
  opciones: Record<V, string>;
  valor: V;
  alElegir: (valor: V) => void;
}) {
  const t = useTranslator();

  return (
    <label className="form__field">
      <span>{t(`admin.themes.style.${eje}` as never)}</span>
      <select
        value={valor}
        data-testid={`nuevo-tema-${eje}`}
        onChange={(e) => alElegir(e.target.value as V)}
      >
        {(Object.entries(opciones) as [V, string][]).map(([id, nombre]) => (
          <option key={id} value={id}>
            {nombre}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Activar un tema, o borrarlo. Van juntas porque son las dos acciones de una fila de la lista. */
export function ThemeActions({
  themeId,
  nombre,
  activo,
  builtIn,
}: {
  themeId: string;
  nombre: string;
  activo: boolean;
  /** El de fabrica no se borra: es el que queda cuando no hay ningun otro. */
  builtIn: boolean;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (cuerpo: Record<string, unknown>) => {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, t('admin.themes.failed')));
      return;
    }
    router.refresh();
  };

  return (
    <span className="barra-de-acciones">
      {activo ? (
        <span className="insignia" data-testid={`tema-${themeId}-activo`}>
          {t('admin.themes.inUse')}
        </span>
      ) : (
        <button
          type="button"
          className="boton-contorno"
          disabled={enCurso}
          data-testid={`activar-${themeId}`}
          onClick={() => void enviar({ accion: 'activar', themeId })}
        >
          {t('admin.themes.activate')}
        </button>
      )}

      {builtIn ? null : (
        <button
          type="button"
          className="boton-contorno"
          disabled={enCurso || activo}
          title={activo ? t('admin.themes.cannotDeleteActive') : undefined}
          aria-label={`${t('action.remove')}: ${nombre}`}
          data-testid={`borrar-${themeId}`}
          onClick={() => void enviar({ accion: 'borrar', themeId })}
        >
          {t('action.remove')}
        </button>
      )}

      {error ? (
        <span className="aviso notice-error" role="alert" data-testid={`tema-error-${themeId}`}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
