import type { ThemeTokens } from './tokens';
import { type ModoDeColor, type OrigenDelTema } from './material3';
import { type TemaMaterial, temaMaterial } from './material3Tokens';

/**
 * El tema de la institucion, expresado en Material Design 3.
 *
 * Los dos colores de marca son un DATO de la institucion, no una variable de diseno: el azul
 * `#0050DD` y el rojo `#EF3340` entran tal cual como origen de las paletas tonales. Lo que MD3
 * aporta no es cambiarlos, es derivar de ellos los tonos que cada rol necesita — y con ello
 * resolver el problema que el tema anterior documentaba a mano.
 *
 * Ese problema era el rojo: `#EF3340` da 4.02:1 sobre blanco, asi que pasa el umbral de elemento
 * grafico (3:1) y NO el de texto pequeno (4.5:1). El tema anterior lo sorteaba eligiendo a mano
 * `accent[700]` para el texto en rojo y dejando una advertencia para quien viniera despues. En
 * MD3 no hay nada que sortear: el rojo de marca es el origen de la paleta `tertiary`, y el texto
 * que va sobre ella es `onTertiary` o `onTertiaryContainer`, cuyo tono se calcula para tener
 * contraste. La regla de marca —"usar con moderacion, para enfasis, nunca como relleno
 * dominante"— la sigue cumpliendo el sistema solo: `tertiary` es un rol de acento y las
 * superficies grandes son `surface*`, que salen de los neutros.
 */
export const ORIGEN_INSTITUCIONAL: OrigenDelTema = {
  primario: '#0050dd',
  acento: '#ef3340',
  // El gris de la norma de marca, el mismo que rotula la institucion en la portada de un informe.
  neutro: '#5b6b87',
};

/**
 * Montserrat, la tipografia institucional.
 *
 * La pila de alternativas se declara aqui y no en el layout: si la variable de `next/font` no
 * llega a definirse —porque la descarga fallo en tiempo de construccion— el texto cae en una
 * fuente del sistema en vez de en la de serie del navegador.
 */
const FUENTES = {
  sans: "var(--font-montserrat), Montserrat, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
};

export const temaClaro: TemaMaterial = temaMaterial(ORIGEN_INSTITUCIONAL, 'claro', FUENTES);

/**
 * El esquema oscuro existe y esta verificado, y NO esta aplicado.
 *
 * MD3 define los dos modos a la vez y generarlos cuesta lo mismo, asi que el oscuro se produce y
 * la prueba de contraste lo recorre entero igual que al claro. Lo que no se hace es encenderlo
 * con `prefers-color-scheme` sin haber revisado cada pantalla en ese modo: un tema oscuro a
 * medias es peor que no tenerlo, y las pruebas de accesibilidad que hoy pasan lo hacen sobre el
 * claro. Encenderlo es una media query y una pasada de revision; esta anotado en la hoja de ruta.
 */
export const temaOscuro: TemaMaterial = temaMaterial(ORIGEN_INSTITUCIONAL, 'oscuro', FUENTES);

export const temaPorModo = (modo: ModoDeColor): TemaMaterial =>
  modo === 'claro' ? temaClaro : temaOscuro;

/**
 * Puente hacia la forma de tema anterior.
 *
 * `ThemeTokens` lo consume el paquete de exportacion, que dibuja PDF, Excel y SVG fuera del
 * navegador y no tiene variables CSS de las que tirar. En vez de mantener dos juegos de colores
 * —el de la pantalla y el de los archivos, que es exactamente como se acaba exportando un PDF
 * con otra marca— se DERIVA de los mismos roles de MD3.
 */
export function comoThemeTokens(tema: TemaMaterial): ThemeTokens {
  const c = tema.color;

  return {
    color: {
      brand: {
        50: c.primaryContainer,
        100: c.primaryContainer,
        300: c.inversePrimary,
        500: c.primary,
        700: c.onPrimaryContainer,
        900: c.onPrimaryContainer,
      },
      accent: {
        50: c.tertiaryContainer,
        100: c.tertiaryContainer,
        300: c.tertiary,
        500: c.tertiary,
        700: c.onTertiaryContainer,
        900: c.onTertiaryContainer,
      },
      neutral: {
        50: c.surfaceContainerLow,
        100: c.surfaceContainer,
        300: c.outlineVariant,
        500: c.onSurfaceVariant,
        700: c.onSurfaceVariant,
        900: c.onSurface,
      },
      success: c.secondary,
      warning: c.tertiary,
      danger: c.error,
      background: c.background,
      surface: c.surfaceContainerLowest,
      surfaceMuted: c.surfaceContainer,
      text: c.onSurface,
      textMuted: c.onSurfaceVariant,
      textOnBrand: c.onPrimary,
      border: c.outlineVariant,
      categorical: tema.categorical,
    },
    font: {
      sans: tema.font.sans,
      mono: tema.font.mono,
      size: {
        xs: tema.typography['body-small'].size,
        sm: tema.typography['body-medium'].size,
        base: tema.typography['body-large'].size,
        lg: tema.typography['title-large'].size,
        xl: tema.typography['headline-small'].size,
        xxl: tema.typography['headline-medium'].size,
      },
      weight: { regular: 400, medium: 500, bold: 700 },
    },
    space: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2.5rem' },
    radius: {
      sm: tema.shape['extra-small'],
      md: tema.shape.medium,
      lg: tema.shape.large,
    },
    shadow: { sm: tema.elevation[1], md: tema.elevation[2] },
  };
}
