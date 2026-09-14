'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SOURCE_ROLES, type ThemeDefinition, type ThemeSource } from '@app/design-tokens';
import { useTranslator } from '../Locale';

/**
 * Crear un tema, activarlo y borrarlo — seccion 4.3.
 *
 * Lo que se elige son los TRES colores de origen, no los tokens: Material Design 3 deriva de ellos
 * los de cada modo, y editar un token suelto rompe la relacion de contraste que 4.9 exige. Por eso
 * el formulario tiene tres campos y no cuarenta.
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
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setEnCurso(true);
    setError(null);
    const tema: ThemeDefinition = {
      id: `tema-${crypto.randomUUID()}`,
      name: nombre,
      source: origen,
      ...(descripcion.trim() ? { description: descripcion } : {}),
    };
    const respuesta = await fetch('/api/admin/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'guardar', tema }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(cuerpo.error ?? t('admin.themes.failed'));
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
    const respuesta = await fetch('/api/admin/themes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const body = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? t('admin.themes.failed'));
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
