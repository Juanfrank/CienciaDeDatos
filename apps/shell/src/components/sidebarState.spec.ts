import { beforeEach, describe, expect, it } from 'vitest';
import { sidebarRead, sidebarSet, sidebarSubscribe, sidebarToggle } from './sidebarState';

/**
 * El almacen que comparten los DOS controles del navegador de modulos.
 *
 * Lo que se fija aqui es lo que se rompia teniendo el estado dentro de un componente: que los dos
 * lean lo mismo. Colapsando con el boton de abajo, el sandwich de la cabecera seguia diciendo
 * `aria-expanded="true"` — y eso es lo que un lector de pantalla lee en voz alta.
 */

beforeEach(() => {
  sidebarSet('visible');
});

describe('estado del navegador de modulos', () => {
  it('empieza desplegado: es como llega el HTML del servidor', () => {
    expect(sidebarRead()).toBe('visible');
  });

  it('avisa a TODOS los suscritos, no solo a quien lo cambio', () => {
    const avisos: string[] = [];
    const quitarUno = sidebarSubscribe(() => avisos.push(`uno:${sidebarRead()}`));
    const quitarOtro = sidebarSubscribe(() => avisos.push(`otro:${sidebarRead()}`));

    sidebarToggle();

    expect(avisos).toEqual(['uno:oculto', 'otro:oculto']);
    quitarUno();
    quitarOtro();
  });

  it('desuscribirse deja de recibir avisos', () => {
    // Sin esto, un panel desmontado seguiria en la lista y el almacen creceria con cada
    // navegacion entre modulos.
    let avisos = 0;
    const quitar = sidebarSubscribe(() => (avisos += 1));
    sidebarToggle();
    quitar();
    sidebarToggle();
    expect(avisos).toBe(1);
  });

  it('fijar el valor que ya estaba no avisa a nadie', () => {
    // `useSyncExternalStore` vuelve a dibujar con cada aviso: avisar sin cambio es un render por
    // cada pulsacion que no hace nada.
    let avisos = 0;
    const quitar = sidebarSubscribe(() => (avisos += 1));
    sidebarSet('visible');
    expect(avisos).toBe(0);
    quitar();
  });

  it('alternar va y vuelve', () => {
    sidebarToggle();
    expect(sidebarRead()).toBe('oculto');
    sidebarToggle();
    expect(sidebarRead()).toBe('visible');
  });
});
