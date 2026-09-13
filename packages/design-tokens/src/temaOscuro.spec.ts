import { describe, expect, it } from 'vitest';
import { contrastRatio, findContrastFailures, institutionalContrastChecks, relativeLuminance } from './contrast';
import { comoThemeTokens, temaClaro, temaOscuro } from './temaInstitucional';
import { type ModoDeColor } from './material3';
import { variablesMaterial } from './material3Tokens';

/** La puerta de contraste, aplicada al TEMA OSCURO — seccion 4.3 y accesibilidad de 4.9. */

const MODOS: ModoDeColor[] = ['claro', 'oscuro'];
const temaDe = (modo: ModoDeColor) => (modo === 'claro' ? temaClaro : temaOscuro);

describe('la puerta de publicacion (4.3) se pasa en LOS DOS modos', () => {
  for (const modo of MODOS) {
    it(`${modo}: el tema derivado no tiene ninguna combinacion por debajo de AA`, () => {
      const fallos = findContrastFailures(institutionalContrastChecks(comoThemeTokens(temaDe(modo))));

      // Se enumeran con su razon: si algun dia falla, el mensaje dice QUE combinacion y CUANTO le
      // falta, que es lo unico que sirve para arreglarla.
      expect(fallos.map((f) => `${f.label}: ${f.ratio?.toFixed(2)} < ${f.required}`)).toEqual([]);
    });

    it(`${modo}: la puerta comprueba las mismas combinaciones, no menos`, () => {
      // Un tema no puede pasar la puerta por traer menos comprobaciones que el otro.
      expect(institutionalContrastChecks(comoThemeTokens(temaDe(modo)))).toHaveLength(
        institutionalContrastChecks(comoThemeTokens(temaClaro)).length,
      );
    });
  }
});

describe('el tema oscuro es oscuro, y lo es de forma consistente', () => {
  const claro = comoThemeTokens(temaClaro).color;
  const oscuro = comoThemeTokens(temaOscuro).color;

  it('el fondo y la superficie se oscurecen, y el texto se aclara', () => {
    // Sin esto, «oscuro» podria ser cualquier otro tema: lo que define el modo es la INVERSION
    // de luminancias, no que los valores sean distintos.
    expect(relativeLuminance(oscuro.background) ?? 1).toBeLessThan(relativeLuminance(claro.background) ?? 0);
    expect(relativeLuminance(oscuro.surface) ?? 1).toBeLessThan(relativeLuminance(claro.surface) ?? 0);
    expect(relativeLuminance(oscuro.text) ?? 0).toBeGreaterThan(relativeLuminance(claro.text) ?? 1);
  });

  it('el texto es mas claro que la superficie sobre la que se lee', () => {
    expect(relativeLuminance(oscuro.text) ?? 0).toBeGreaterThan(relativeLuminance(oscuro.surface) ?? 1);
    expect(relativeLuminance(oscuro.textMuted) ?? 0).toBeGreaterThan(relativeLuminance(oscuro.surface) ?? 1);
  });

  it('la superficie se distingue del fondo: una tarjeta tiene que verse como tarjeta', () => {
    /*
     * En oscuro es donde esto se pierde. MD3 separa fondo y superficie por unos pocos tonos, y si
     * la separacion cae a cero la tarjeta desaparece contra la pagina — no es un fallo de WCAG,
     * porque no hay texto de por medio, y por eso ninguna otra prueba lo veria.
     */
    for (const tema of [claro, oscuro]) {
      expect(tema.surface).not.toBe(tema.background);
      expect(relativeLuminance(tema.surface)).not.toBeCloseTo(relativeLuminance(tema.background) ?? 0, 3);
    }
  });

  it('el borde se ve sobre la superficie en los dos modos', () => {
    // El borde es lo que dibuja la tarjeta, la celda de una tabla y el campo de un formulario.
    // WCAG 2.1 pide 3:1 para un componente no textual (1.4.11).
    for (const tema of [claro, oscuro]) {
      expect(contrastRatio(tema.border, tema.surface) ?? 0).toBeGreaterThanOrEqual(1.4);
    }
  });
});

describe('las series de datos en oscuro', () => {
  it('las ocho se leen sobre la superficie del tema derivado', () => {
    const oscuro = comoThemeTokens(temaOscuro).color;
    for (const [i, color] of oscuro.categorical.entries()) {
      // 3:1, el umbral de elemento grafico: una barra no es texto.
      expect(contrastRatio(color, oscuro.surface) ?? 0, `serie ${i + 1} (${color})`).toBeGreaterThanOrEqual(3);
    }
  });

  it('la paleta oscura NO es la clara: una serie pensada para blanco se apaga sobre negro', () => {
    expect(comoThemeTokens(temaOscuro).color.categorical).not.toEqual(
      comoThemeTokens(temaClaro).color.categorical,
    );
  });

  it('siguen siendo ocho y siguen siendo distintas entre si', () => {
    const series = comoThemeTokens(temaOscuro).color.categorical;
    expect(series).toHaveLength(8);
    expect(new Set(series).size).toBe(8);
  });
});

describe('encender el modo oscuro es redefinir, nunca anadir', () => {
  it('los dos modos emiten exactamente las mismas variables CSS', () => {
    /*
     * Es la condicion que permite cambiar de modo con una cookie y sin tocar una hoja de estilo.
     * Si el oscuro emitiera una variable que el claro no tiene, esa regla de CSS quedaria sin
     * valor en claro y el navegador la ignoraria en silencio.
     */
    expect(Object.keys(variablesMaterial(temaOscuro)).sort()).toEqual(
      Object.keys(variablesMaterial(temaClaro)).sort(),
    );
  });

  it('y ningun valor de color se queda igual por descuido', () => {
    /*
     * `shadow` y `scrim` son negro en los dos modos POR DEFINICION: MD3 los fija en el tono 0 de
     * la paleta neutra porque una sombra es ausencia de luz y un velo es lo que oscurece lo que
     * hay detras. Aclararlos en oscuro no daria un tema mas oscuro, daria una sombra que ilumina.
     */
    const SIN_MODO = ['--md-sys-color-shadow', '--md-sys-color-scrim'];
    const claras = variablesMaterial(temaClaro);
    const oscuras = variablesMaterial(temaOscuro);
    const colores = Object.keys(claras).filter(
      (k) => k.startsWith('--md-sys-color-') && !SIN_MODO.includes(k),
    );
    const iguales = colores.filter((k) => claras[k] === oscuras[k]);

    expect(colores.length).toBeGreaterThan(20);
    expect(iguales).toEqual([]);
  });
});
