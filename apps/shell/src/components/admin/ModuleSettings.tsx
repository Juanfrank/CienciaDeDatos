'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MODULE_OPTIONS, type ModuleOption } from '@app/module-model';
import type { MessageKey } from '@app/i18n';
import { useTranslator } from '../Locale';

/**
 * Configuracion de un modulo — secciones 4.1 y 4.11.
 *
 * Lo que el modulo ES, no lo que contiene: eso se edita en el editor. Aqui van el nombre, la URL
 * publica, la descripcion, que ofrece y con que filtros abre.
 */
export interface SettingsForm {
  name: string;
  slug: string;
  description: string;
  options: Partial<Record<ModuleOption, boolean>>;
  defaultFilters: { field: string; values: string[] }[];
}

/** Como se llama cada opcion y que hace, dicho donde se enciende. */
const OPCION: Record<ModuleOption, { titulo: MessageKey; desc: MessageKey }> = {
  personalizacion: { titulo: 'module.option.personalization', desc: 'module.option.personalization.desc' },
  marcadores: { titulo: 'module.option.bookmarks', desc: 'module.option.bookmarks.desc' },
  exportacion: { titulo: 'module.option.export', desc: 'module.option.export.desc' },
  alertas: { titulo: 'module.option.alerts', desc: 'module.option.alerts.desc' },
  embebido: { titulo: 'module.option.embed', desc: 'module.option.embed.desc' },
};

export function ModuleSettings({
  slug: slugOriginal,
  inicial,
  campos,
}: {
  slug: string;
  inicial: SettingsForm;
  /** Los campos del esquema que se pueden filtrar, leidos del cache. Nunca texto libre. */
  campos: string[];
}) {
  const t = useTranslator();
  const router = useRouter();
  const [form, setForm] = useState<SettingsForm>(inicial);
  const [enCurso, setEnCurso] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const encendida = (opcion: ModuleOption) => form.options[opcion] !== false;

  const alternar = (opcion: ModuleOption) =>
    setForm((previo) => ({
      ...previo,
      options: { ...previo.options, [opcion]: !encendida(opcion) },
    }));

  const guardar = async () => {
    setEnCurso(true);
    setMensaje(null);
    const respuesta = await fetch(`/api/modules/${slugOriginal}/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ settings: form }),
    });
    setEnCurso(false);
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string };
      setMensaje({ tipo: 'error', texto: cuerpo.error ?? t('admin.settings.failed') });
      return;
    }
    setMensaje({ tipo: 'ok', texto: t('admin.settings.saved') });
    // La URL puede haber cambiado: se va a la nueva en vez de dejar la pantalla en una direccion
    // que ya no existe.
    const { modulo } = (await respuesta.json()) as { modulo: { slug: string } };
    if (modulo.slug !== slugOriginal) router.replace(`/admin/modules/${modulo.slug}/settings`);
    else router.refresh();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <label className="form__field">
        <span>{t('admin.settings.name')}</span>
        <input
          type="text"
          required
          value={form.name}
          data-testid="settings-nombre"
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        />
      </label>

      <label className="form__field">
        <span>{t('admin.settings.slug')}</span>
        <input
          type="text"
          required
          value={form.slug}
          data-testid="settings-slug"
          onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
        />
        <span className="muted-text">{t('admin.settings.slug.help', { slug: form.slug })}</span>
      </label>

      <label className="form__field">
        <span>{t('admin.settings.description')}</span>
        <textarea
          rows={3}
          value={form.description}
          data-testid="settings-descripcion"
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </label>

      <h3>{t('admin.settings.options')}</h3>
      <p className="muted-text">{t('admin.settings.options.intro')}</p>
      <div className="container-table">
        <table className="tabla" data-testid="tabla-opciones">
          <thead>
            <tr>
              <th scope="col">{t('admin.settings.options.column.option')}</th>
              <th scope="col">{t('admin.settings.options.column.state')}</th>
            </tr>
          </thead>
          <tbody>
            {MODULE_OPTIONS.map((opcion) => (
              <tr key={opcion} data-testid={`opcion-${opcion}`}>
                <th scope="row">
                  {t(OPCION[opcion].titulo)}
                  <p className="muted-text">{t(OPCION[opcion].desc)}</p>
                </th>
                <td>
                  {/*
                    La casilla lleva su propio rotulo, aunque la fila ya diga como se llama la
                    opcion: un `input` sin etiqueta accesible se anuncia como «casilla, sin
                    marcar» y no dice de que.
                  */}
                  <label className="opcion-interruptor">
                    <input
                      type="checkbox"
                      checked={encendida(opcion)}
                      data-testid={`opcion-${opcion}-casilla`}
                      onChange={() => alternar(opcion)}
                    />
                    <span>{encendida(opcion) ? t('admin.settings.on') : t('admin.settings.off')}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>{t('admin.settings.filters')}</h3>
      <p className="muted-text">{t('admin.settings.filters.intro')}</p>
      <FiltrosPorDefecto
        campos={campos}
        filtros={form.defaultFilters}
        onCambiar={(defaultFilters) => setForm((p) => ({ ...p, defaultFilters }))}
      />

      <p>
        <button type="submit" className="pastilla" disabled={enCurso} data-testid="guardar-settings">
          {t('action.save')}
        </button>
      </p>

      {mensaje ? (
        <p
          className={mensaje.tipo === 'ok' ? 'aviso' : 'aviso notice-error'}
          role="status"
          data-testid="settings-mensaje"
        >
          {mensaje.texto}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Los filtros con los que abre el modulo.
 *
 * El campo se ELIGE de los que el esquema trae, no se escribe: un filtro sobre una columna que no
 * existe no filtra nada y no avisa de nada — la pagina abriria igual y nadie sabria por que no
 * hace lo que se le pidio. Los valores si son texto, porque son datos y no metadatos.
 */
function FiltrosPorDefecto({
  campos,
  filtros,
  onCambiar,
}: {
  campos: string[];
  filtros: { field: string; values: string[] }[];
  onCambiar: (filtros: { field: string; values: string[] }[]) => void;
}) {
  const t = useTranslator();

  if (campos.length === 0) {
    return (
      <p className="muted-text" data-testid="sin-campos">
        {t('admin.settings.filters.noFields')}
      </p>
    );
  }

  return (
    <>
      <ul className="simple-list" data-testid="filtros-por-defecto">
        {filtros.map((filtro, i) => (
          <li key={`${filtro.field}-${i}`} data-testid={`filtro-${filtro.field}`}>
            <select
              value={filtro.field}
              aria-label={t('admin.settings.filters.field')}
              data-testid={`filtro-${i}-campo`}
              onChange={(e) =>
                onCambiar(filtros.map((f, j) => (i === j ? { ...f, field: e.target.value } : f)))
              }
            >
              {campos.map((campo) => (
                <option key={campo} value={campo}>
                  {campo}
                </option>
              ))}
            </select>{' '}
            <input
              type="text"
              value={filtro.values.join(', ')}
              aria-label={t('admin.settings.filters.values')}
              placeholder={t('admin.settings.filters.values')}
              data-testid={`filtro-${i}-valores`}
              onChange={(e) =>
                onCambiar(
                  filtros.map((f, j) =>
                    i === j ? { ...f, values: e.target.value.split(',').map((v) => v.trim()) } : f,
                  ),
                )
              }
            />{' '}
            <button
              type="button"
              className="boton-contorno"
              data-testid={`filtro-${i}-quitar`}
              onClick={() => onCambiar(filtros.filter((_, j) => j !== i))}
            >
              {t('action.remove')}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="boton-contorno"
        data-testid="anadir-filtro"
        onClick={() => onCambiar([...filtros, { field: campos[0] as string, values: [] }])}
      >
        {t('admin.settings.filters.add')}
      </button>
    </>
  );
}
