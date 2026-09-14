import {
  INSTITUTIONAL_SOURCE,
  TYPOGRAPHY,
  asThemeTokens,
  darkTheme,
  findContrastFailures,
  institutionalContrastChecks,
  lightTheme,
  type MaterialTheme,
} from '@app/design-tokens';
import type { MessageKey, Translator } from '@app/i18n';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Los temas disponibles y su configuracion — seccion 4.3.
 *
 * Un tema no se edita aqui con un selector de color. Se deriva de TRES colores de origen, y
 * Material Design 3 calcula el resto: tocar un token suelto rompe la relacion de contraste que
 * 4.9 exige, y la pantalla dejaria de poder prometer AA. Lo que si se ve es que sale de cada
 * origen, si pasa contraste y que version corre.
 */

interface ThemeRow {
  id: string;
  name: MessageKey;
  desc: MessageKey;
  theme: MaterialTheme;
  /** Si es el que la aplicacion sirve hoy. */
  active: boolean;
}

const TEMAS: ThemeRow[] = [
  {
    id: 'institucional-claro',
    name: 'admin.themes.light',
    desc: 'admin.themes.light.desc',
    theme: lightTheme,
    active: true,
  },
  {
    id: 'institucional-oscuro',
    name: 'admin.themes.dark',
    desc: 'admin.themes.dark.desc',
    theme: darkTheme,
    active: false,
  },
];

/** La version del tema acompana a la del paquete que lo publica. */
const VERSION = '1.0.0';

export default async function TemasPage() {
  const t = await translator();

  return (
    <section>
      <h2>{t('admin.themes.title')}</h2>
      <p className="muted-text">{t('admin.themes.intro')}</p>

      <h3>{t('admin.themes.source')}</h3>
      <ul className="theme-source" data-testid="origen-del-tema">
        {Object.entries(INSTITUTIONAL_SOURCE).map(([rol, valor]) => (
          <li key={rol} data-testid={`origen-${rol}`}>
            <span className="theme-swatch" style={{ background: valor }} aria-hidden="true" />
            <b>{rol}</b>
            <code>{valor}</code>
          </li>
        ))}
      </ul>

      {TEMAS.map((fila) => (
        <Theme key={fila.id} fila={fila} t={t} />
      ))}

      <h3>{t('admin.themes.typography')}</h3>
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

function Theme({ fila, t }: { fila: ThemeRow; t: Translator }) {
  const tokens = asThemeTokens(fila.theme);
  const comprobaciones = institutionalContrastChecks(tokens);
  const fallos = findContrastFailures(comprobaciones);

  return (
    <article className="theme" data-testid={`tema-${fila.id}`}>
      <div className="theme__head">
        <h3>{t(fila.name)}</h3>
        <span className="insignia" data-testid={`tema-${fila.id}-version`}>
          v{VERSION}
        </span>
        {fila.active ? (
          <span className="insignia" data-testid={`tema-${fila.id}-activo`}>
            {t('admin.themes.inUse')}
          </span>
        ) : null}
      </div>
      <p className="muted-text">{t(fila.desc)}</p>

      {/*
        El contraste se comprueba AQUI y no solo en la prueba unitaria: quien cambie la norma de
        marca manana entra por esta pantalla, no por el paquete de tokens.
      */}
      {fallos.length === 0 ? (
        <p className="notice-ok" data-testid={`tema-${fila.id}-contraste`}>
          {t('admin.themes.contrastPasses', { n: comprobaciones.length })}
        </p>
      ) : (
        <ul className="notice-atencion" data-testid={`tema-${fila.id}-contraste-falla`}>
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

      <h4>{t('admin.themes.categorical')}</h4>
      <ul className="theme-palette" data-testid={`tema-${fila.id}-categoricos`}>
        {tokens.color.categorical.map((color, i) => (
          <li key={color}>
            <span className="theme-swatch" style={{ background: color }} aria-hidden="true" />
            <span className="muted-text">
              {t('admin.themes.series', { n: i + 1 })} · {color}
            </span>
          </li>
        ))}
      </ul>

      <details data-testid={`tema-${fila.id}-tokens`}>
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
    </article>
  );
}
