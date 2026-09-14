import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_THEME,
  asThemeTokens,
  findContrastFailures,
  institutionalContrastChecks,
  lightTheme,
  darkTheme,
  themeVersions,
  toCssVariables,
  materialVariables,
  type ColorMode,
} from '@app/design-tokens';
import { PermissionError, type Actor } from '@app/access-control';
import { activateTheme, activeTheme, colorModeIs, deleteTheme, saveTheme, ThemeError } from './theme';
import { governance } from './governance';
import { auditList, clearAudit } from './audit';

/** El modo de color de la aplicacion — seccion 4.3. */
describe('que modo se pide', () => {
  it('acepta los dos modos que existen', () => {
    expect(colorModeIs('light')).toBe(true);
    expect(colorModeIs('dark')).toBe(true);
  });

  it('cualquier otra cosa no es un modo, y por tanto cae en light', () => {
    // Una cookie es texto que manda el cliente: mal escrita, con otra caja, vacia o manipulada
    // tiene que dejar la aplicacion en un estado dibujable, no a medio tema.
    for (const valor of ['obscuro', 'Dark', 'LIGHT', '', undefined, 'null']) {
      expect(colorModeIs(valor), String(valor)).toBe(false);
    }
  });
});

/** Toda variable CSS que la hoja de estilo LEE tiene que existir en los dos modos. */
describe('el tema cubre todas las variables que la hoja de estilo usa', () => {
  const css = readFileSync(join(process.cwd(), 'apps/shell/app/globals.css'), 'utf8');
  const used = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1] as string));
  const definidasEnCss = new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1] as string),
  );

  /** Las que rellena un componente al dibujar, no el tema. */
  const DE_COMPONENTE = [
    '--rejilla-columnas',
    '--multiplos-columnas',
    '--color-de-resaltado',
    '--col-movil',
    '--fila-movil',
    '--col-tableta',
    '--fila-tableta',
    '--col-escritorio',
    '--fila-escritorio',
    // La escribe el contenedor expandible con las filas que ocupa abierto. Se lee con valor de
    // respaldo —`var(--filas-al-expandir, 4)`—, asi que un contenedor sin configurar tampoco se
    // queda sin altura.
    '--filas-al-expandir',
  ];

  const emittedIn = (mode: ColorMode): Set<string> => {
    const theme = mode === 'light' ? lightTheme : darkTheme;
    return new Set([
      ...Object.keys(materialVariables(theme)),
      ...Object.keys(toCssVariables(asThemeTokens(theme))),
    ]);
  };

  for (const mode of ['light', 'dark'] as ColorMode[]) {
    it(`${mode}: ninguna variable leida se queda sin valor`, () => {
      const emitted = emittedIn(mode);
      const orphans = [...used].filter(
        (v) => !definidasEnCss.has(v) && !emitted.has(v) && !DE_COMPONENTE.includes(v),
      );

      expect(orphans.sort()).toEqual([]);
    });
  }

  it('la abreviatura `font:` de cada rol tipografico es un valor valido', () => {
    // No basta con que la variable exista: `font` exige grosor, tamano/interlineado y familia en
    // ese orden. Una variable presente pero mal formada vuelve a descartar la declaracion entera.
    const vars = materialVariables(darkTheme);
    for (const role of ['title-large', 'title-medium', 'label-large', 'body-small']) {
      expect(vars[`--md-sys-typescale-${role}`]).toMatch(/^\d{3} [\d.]+rem\/[\d.]+rem .+sans-serif$/);
    }
  });

  it('los componentes que usan la hoja de estilo declaran las variables que ella espera', () => {
    // La otra mitad de la lista de arriba: si alguien renombra `--rejilla-columnas` en el TSX y
    // no en el CSS, la rejilla se queda sin columnas.
    const tsx = ['components/Grid.tsx', 'components/objects.tsx', 'components/editor/Canvas.tsx']
      .map((f) => readFileSync(join(process.cwd(), 'apps/shell/src', f), 'utf8'))
      .join('\n');

    for (const nombre of ['--rejilla-columnas', '--multiplos-columnas', '--color-de-resaltado']) {
      expect(tsx, nombre).toContain(`'${nombre}'`);
    }
  });
});

describe('mas de un tema, y cada uno con sus dos versiones (4.3)', () => {
  const admin: Actor = { userId: 'u-admin', role: 'administrador' };
  const colaborador: Actor = { userId: 'u-ana', role: 'colaborador' };

  beforeEach(async () => {
    await governance.reset();
    await clearAudit();
  });

  const AZUL_VERDE = {
    primario: '#00695c',
    acento: '#b71c1c',
    neutro: '#5b6b87',
  };

  it('un tema son TRES colores, y de ellos salen las DOS versiones', async () => {
    /*
     * El claro y el oscuro salen del mismo origen, asi que no son dos temas: son las dos versiones
     * del mismo. Antes se guardaban como dos entradas sueltas, y nada impedia cambiar una y no la
     * otra — la aplicacion pasaria a oscuro con colores de otra marca.
     */
    const tema = await saveTheme(admin, {
      id: 'tema-prueba',
      name: 'De prueba',
      source: AZUL_VERDE,
    });

    const versiones = themeVersions(tema);
    expect(versiones.light.color.primary).not.toBe(versiones.dark.color.primary);
    // Y las dos vienen del mismo sitio: cambiar el origen mueve las dos a la vez.
    const otro = themeVersions({ ...tema, source: { ...AZUL_VERDE, primario: '#4a148c' } });
    expect(otro.light.color.primary).not.toBe(versiones.light.color.primary);
    expect(otro.dark.color.primary).not.toBe(versiones.dark.color.primary);
  });

  it('venga el origen que venga, las DOS versiones salen AA', async () => {
    /*
     * Esta es la propiedad de verdad, y no «el contraste rechaza».
     *
     * Material Design 3 no usa el color de origen tal cual: lo convierte en una paleta tonal y
     * elige los tonos por su luminancia, asi que las parejas que 4.9 exige salen AA se escriba lo
     * que se escriba. Por eso la puerta de `saveTheme` no puede rechazar nada que venga de la
     * pantalla —y por eso sigue ahi: es un cable trampa sobre la DERIVACION, que es codigo
     * nuestro, no sobre lo que elija una persona.
     *
     * Se prueba con los cuatro origenes que uno esperaria que rompieran algo. Si alguno empezara a
     * fallar, lo que ha cambiado es la derivacion o la lista de comprobaciones, que es exactamente
     * lo que hay que enterarse de que cambio.
     */
    const extremos = [
      { primario: '#ffe680', acento: '#fff3b0', neutro: '#f5f5dc' },
      { primario: '#808080', acento: '#909090', neutro: '#808080' },
      { primario: '#fefefe', acento: '#fdfdfd', neutro: '#ffffff' },
      { primario: '#000000', acento: '#010101', neutro: '#000000' },
    ];

    for (const [i, source] of extremos.entries()) {
      const tema = await saveTheme(admin, { id: `tema-extremo-${i}`, name: `Extremo ${i}`, source });
      const versiones = themeVersions(tema);
      for (const modo of ['light', 'dark'] as const) {
        const fallos = findContrastFailures(
          institutionalContrastChecks(asThemeTokens(versiones[modo])),
        );
        expect(fallos.map((f) => f.label), `${source.primario} en ${modo}`).toEqual([]);
      }
    }
  });

  it('un color mal escrito se rechaza diciendo cual', async () => {
    await expect(
      saveTheme(admin, {
        id: 'tema-malo',
        name: 'Con un color a medias',
        source: { ...AZUL_VERDE, acento: 'rojo' },
      }),
    ).rejects.toThrow(/acento/);
  });

  it('solo administra quien administra', async () => {
    await expect(
      saveTheme(colaborador, { id: 'tema-ajeno', name: 'Ajeno', source: AZUL_VERDE }),
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it('el de fabrica no se borra ni se edita: es el que queda', async () => {
    // Sin un tema que siempre este, borrar el ultimo dejaria la aplicacion sin color — y sin forma
    // de volver a entrar a crear uno, porque el panel tambien se dibuja con el.
    await expect(deleteTheme(admin, INSTITUTIONAL_THEME.id)).rejects.toBeInstanceOf(ThemeError);
    await expect(
      saveTheme(admin, { ...INSTITUTIONAL_THEME, name: 'Otro nombre' }),
    ).rejects.toBeInstanceOf(ThemeError);
  });

  it('borrar el que se sirve devuelve la aplicacion al de fabrica', async () => {
    const tema = await saveTheme(admin, { id: 'tema-fugaz', name: 'Fugaz', source: AZUL_VERDE });
    await activateTheme(admin, tema.id);
    expect((await activeTheme()).id).toBe(tema.id);

    await governance.deleteTheme(tema.id);
    // No se queda apuntando a uno que ya no existe, que dejaria la aplicacion sin variables.
    expect((await activeTheme()).id).toBe(INSTITUTIONAL_THEME.id);
  });

  it('crear y activar quedan en la auditoria', async () => {
    // Un tema repinta la aplicacion entera: quien lo cambio tiene que constar igual que quien
    // mueve una carpeta.
    const tema = await saveTheme(admin, { id: 'tema-auditado', name: 'Auditado', source: AZUL_VERDE });
    await activateTheme(admin, tema.id);

    const deTemas = (await auditList()).filter((e) => e.entityType === 'theme');
    expect(deTemas.map((e) => e.action)).toEqual(expect.arrayContaining(['create', 'update']));
    expect(deTemas.every((e) => e.actorId === 'u-admin')).toBe(true);
  });
});
