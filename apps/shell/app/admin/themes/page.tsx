import {
  SOURCE_ROLES,
  TYPOGRAPHY,
  asThemeTokens,
  findContrastFailures,
  institutionalContrastChecks,
  themeVersions,
  type ColorMode,
  type MaterialTheme,
  type ThemeDefinition,
} from '@app/design-tokens';
import type { Translator } from '@app/i18n';
import { ThemeActions, ThemeForm } from '../../../src/components/admin/ThemeForm';
import { governance } from '../../../src/server/governance';
import { INSTITUTIONAL_THEME } from '@app/design-tokens';
import { COLOR_MODES } from '../../../src/server/theme';
import { translator } from '../../../src/server/locale';
import { paginaDeAdmin } from '../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * Los temas de la institucion — seccion 4.3.
 *
 * Cada TEMA tiene sus dos versiones, clara y oscura, derivadas del mismo origen. Antes la pantalla
 * listaba «Institucional claro» e «Institucional oscuro» como si fueran dos temas: con eso no
 * habia forma de tener un segundo tema sin tener cuatro entradas, y nada impedia que alguien
 * cambiara una version y no la otra —la aplicacion pasaria a oscuro con colores de otra marca—.
 *
 * Un tema tampoco se edita token a token. Se eligen TRES colores de origen y Material Design 3
 * calcula el resto: tocar un token suelto rompe la relacion de contraste que 4.9 exige, y la
 * pantalla dejaria de poder prometer AA.
 */
export default async function TemasPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const [t, temas, activo] = await Promise.all([
    translator(),
    governance.listThemes(),
    governance.getActiveTheme(),
  ]);

  return (
    <section>
      <h2>{t('admin.themes.title')}</h2>
      <p className="muted-text">{t('admin.themes.intro')}</p>

      <ThemeForm base={INSTITUTIONAL_THEME.source} />

      {temas.map((tema) => (
        <Tema key={tema.id} tema={tema} t={t} activo={tema.id === activo} />
      ))}

      <h3>{t('admin.themes.typography')}</h3>
      {/* La tipografia es una y la comparten todos: el color se elige, la letra institucional no. */}
      <p className="muted-text">{t('admin.themes.typography.shared')}</p>
      <table className="tabla" data-testid="tabla-tipografia">
        <thead>
          <tr>
            <th scope="col">{t('admin.themes.column.role')}</th>
            <th scope="col">{t('admin.themes.column.size')}</th>
            <th scope="col">{t('admin.themes.column.lineHeight')}</th>
            <th scope="col">{t('admin.themes.column.weight')}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(TYPOGRAPHY).map(([rol, estilo]) => (
            <tr key={rol} data-testid={`tipografia-${rol}`}>
              <th scope="row">{rol}</th>
              <td>{estilo.size}</td>
              <td>{estilo.lineHeight}</td>
              <td>{estilo.weight}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tema({
  tema,
  t,
  activo,
}: {
  tema: ThemeDefinition;
  t: Translator;
  activo: boolean;
}) {
  const versiones = themeVersions(tema);

  return (
    <article className="theme" data-testid={`tema-${tema.id}`}>
      <div className="theme__head">
        <h3>{tema.name}</h3>
        {tema.builtIn ? (
          <span className="insignia" data-testid={`tema-${tema.id}-fabrica`}>
            {t('admin.themes.builtIn')}
          </span>
        ) : null}
        <ThemeActions
          themeId={tema.id}
          nombre={tema.name}
          activo={activo}
          builtIn={tema.builtIn === true}
        />
      </div>
      {tema.description ? <p className="muted-text">{tema.description}</p> : null}

      <h4>{t('admin.themes.source')}</h4>
      <ul className="theme-source" data-testid={`tema-${tema.id}-origen`}>
        {SOURCE_ROLES.map((rol) => (
          <li key={rol} data-testid={`tema-${tema.id}-origen-${rol}`}>
            <span
              className="theme-swatch"
              style={{ background: tema.source[rol] }}
              aria-hidden="true"
            />
            <b>{rol}</b>
            <code>{tema.source[rol]}</code>
          </li>
        ))}
      </ul>

      {/*
        Las DOS versiones, una al lado de la otra.
        Es lo que dice que son el mismo tema: el mismo origen, dos derivaciones. Enseñar solo la
        que corre dejaria la otra sin mirar hasta que alguien cambiara de modo.
      */}
      <div className="theme__versiones">
        {COLOR_MODES.map((modo) => (
          <Version key={modo} id={tema.id} modo={modo} version={versiones[modo]} t={t} />
        ))}
      </div>
    </article>
  );
}

function Version({
  id,
  modo,
  version,
  t,
}: {
  id: string;
  modo: ColorMode;
  version: MaterialTheme;
  t: Translator;
}) {
  const tokens = asThemeTokens(version);
  const comprobaciones = institutionalContrastChecks(tokens);
  const fallos = findContrastFailures(comprobaciones);

  return (
    <section className="theme__version" data-testid={`tema-${id}-${modo}`}>
      <h5>{modo === 'light' ? t('admin.themes.light') : t('admin.themes.dark')}</h5>

      {/*
        El contraste se comprueba AQUI ademas de al guardar: quien cambie la norma de marca manana
        entra por esta pantalla, no por el paquete de tokens.
      */}
      {fallos.length === 0 ? (
        <p className="notice-ok" data-testid={`tema-${id}-${modo}-contraste`}>
          {t('admin.themes.contrastPasses', { n: comprobaciones.length })}
        </p>
      ) : (
        <ul className="notice-atencion" data-testid={`tema-${id}-${modo}-contraste-falla`}>
          {fallos.map((f) => (
            <li key={f.label}>
              {t('admin.themes.contrastFails', {
                par: f.label,
                razon: f.ratio === null ? '—' : t.numero(f.ratio, { maximumFractionDigits: 2 }),
                exigido: t.numero(f.required, { maximumFractionDigits: 1 }),
              })}
            </li>
          ))}
        </ul>
      )}

      <ul className="theme-palette" data-testid={`tema-${id}-${modo}-categoricos`}>
        {tokens.color.categorical.map((color, i) => (
          <li key={color}>
            <span className="theme-swatch" style={{ background: color }} aria-hidden="true" />
            <span className="muted-text">
              {t('admin.themes.series', { n: i + 1 })} · {color}
            </span>
          </li>
        ))}
      </ul>

      <details data-testid={`tema-${id}-${modo}-tokens`}>
        <summary>{t('admin.themes.tokens')}</summary>
        <table className="tabla">
          <thead>
            <tr>
              <th scope="col">{t('admin.themes.column.token')}</th>
              <th scope="col">{t('admin.themes.column.value')}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['background', tokens.color.background],
                ['surface', tokens.color.surface],
                ['surfaceMuted', tokens.color.surfaceMuted],
                ['text', tokens.color.text],
                ['textMuted', tokens.color.textMuted],
                ['textOnBrand', tokens.color.textOnBrand],
                ['border', tokens.color.border],
                ['danger', tokens.color.danger],
              ] as const
            ).map(([nombre, valor]) => (
              <tr key={nombre}>
                <th scope="row">{nombre}</th>
                <td>
                  <span className="theme-swatch" style={{ background: valor }} aria-hidden="true" />
                  <code>{valor}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
