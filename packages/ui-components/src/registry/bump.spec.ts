import { describe, expect, it } from 'vitest';
import type { ObjectInstance, ObjectVersion, VisualObjectDefinition } from './types';
import { BumpError, bumpInstance, isMajorJump, latestVersion } from './bump';

/**
 * Subir una instancia de version — seccion 4.5.
 *
 * La regla que se fija aqui es una sola: lo que alguien configuro se conserva, y solo lo que la
 * version nueva anade cae a su valor por defecto. Una instancia lleva anos con su acento y su
 * formato elegidos a mano; subirla de version no puede devolverla a la casilla de salida.
 */

const version = (v: string, presentation: ObjectVersion['presentation']): ObjectVersion => ({
  version: v,
  publishedAt: '2026-01-01T00:00:00.000Z',
  changelog: `cambios de ${v}`,
  certification: {
    testsPassed: true,
    reviewedBy: 'u-admin',
    reviewedAt: '2026-01-01T00:00:00.000Z',
  },
  dataContract: { dimensions: { min: 0, max: 0 }, measures: { min: 1, max: 1 } },
  presentation,
});

const objeto = (versions: ObjectVersion[]): VisualObjectDefinition => ({
  objectId: 'tarjeta-kpi',
  name: 'Tarjeta KPI',
  description: 'Una cifra',
  category: 'indicador',
  icono: 'indicador',
  family: 'value',
  versions,
});

const instancia = (
  v: string,
  presentacion?: ObjectInstance['presentacion'],
): ObjectInstance => ({
  instanceId: 'i1',
  objectId: 'tarjeta-kpi',
  version: v,
  binding: { datasetId: 'd', dimensions: [], measures: ['M'] },
  ...(presentacion ? { presentacion } : {}),
});

describe('bumpInstance', () => {
  it('conserva lo configurado que la version nueva sigue admitiendo', () => {
    const def = objeto([
      version('1.0.0', ['icono', 'acento', 'subtitulo']),
      version('1.1.0', ['icono', 'acento', 'subtitulo', 'mostrarTitulo']),
    ]);
    const r = bumpInstance(
      instancia('1.0.0', { icono: 'balanza', acento: 'secundario', subtitulo: 'Al cierre' }),
      def,
      '1.1.0',
    );

    expect(r.instance.version).toBe('1.1.0');
    // Lo elegido a mano sigue ahi, con el MISMO valor.
    expect(r.instance.presentacion).toEqual({
      icono: 'balanza',
      acento: 'secundario',
      subtitulo: 'Al cierre',
    });
    expect(r.preserved.sort()).toEqual(['acento', 'icono', 'subtitulo']);
    expect(r.retiradas).toEqual([]);
  });

  /*
   * Lo nuevo NO se rellena con un valor: se queda ausente, que es como el dibujante aplica su
   * defecto. Escribirlo aqui congelaria hoy un defecto que manana cambia, y ademas haria
   * imposible distinguir «nadie lo ha tocado» de «alguien eligio justo el defecto».
   */
  it('lo que la version nueva anade se queda en su defecto, sin escribirlo', () => {
    const def = objeto([
      version('1.0.0', ['icono']),
      version('1.1.0', ['icono', 'mostrarTitulo', 'textos']),
    ]);
    const r = bumpInstance(instancia('1.0.0', { icono: 'balanza' }), def, '1.1.0');

    expect(r.nuevas.sort()).toEqual(['mostrarTitulo', 'textos']);
    expect(r.instance.presentacion).toEqual({ icono: 'balanza' });
    expect(Object.keys(r.instance.presentacion ?? {})).not.toContain('mostrarTitulo');
  });

  it('lo que la version nueva ya no admite se quita, pero se DICE con su valor anterior', () => {
    const def = objeto([
      version('1.0.0', ['icono', 'acento', 'resaltado']),
      version('2.0.0', ['icono', 'acento']),
    ]);
    const r = bumpInstance(
      instancia('1.0.0', { icono: 'balanza', acento: 'secundario', resaltado: true }),
      def,
      '2.0.0',
    );

    expect(r.retiradas).toEqual([{ clave: 'resaltado', valor: true }]);
    expect(r.instance.presentacion).toEqual({ icono: 'balanza', acento: 'secundario' });
  });

  it('no toca la instancia original: devuelve una copia', () => {
    const def = objeto([version('1.0.0', ['icono']), version('1.1.0', ['icono'])]);
    const original = instancia('1.0.0', { icono: 'balanza' });
    const r = bumpInstance(original, def, '1.1.0');

    expect(original.version).toBe('1.0.0');
    expect(r.instance).not.toBe(original);
  });

  it('una instancia sin nada configurado sube sin inventarse presentacion', () => {
    const def = objeto([version('1.0.0', ['icono']), version('1.1.0', ['icono', 'acento'])]);
    const r = bumpInstance(instancia('1.0.0'), def, '1.1.0');

    expect(r.instance.presentacion).toBeUndefined();
    expect(r.preserved).toEqual([]);
  });

  it('una clave puesta a undefined no cuenta como configurada', () => {
    const def = objeto([version('1.0.0', ['icono', 'acento']), version('2.0.0', ['icono'])]);
    const r = bumpInstance(
      instancia('1.0.0', { icono: 'balanza', acento: undefined }),
      def,
      '2.0.0',
    );
    // No se avisa de una retirada que nadie iba a echar de menos.
    expect(r.retiradas).toEqual([]);
  });

  describe('lo que rechaza', () => {
    it('una version que el objeto no tiene', () => {
      const def = objeto([version('1.0.0', ['icono'])]);
      expect(() => bumpInstance(instancia('1.0.0'), def, '9.9.9')).toThrow(BumpError);
    });

    /*
     * Bajar de version es otra operacion, con otras preguntas: lo que la version vieja no admite
     * no se puede «conservar». Llamarlo bump esconderia que se esta retrocediendo.
     */
    it('retroceder, aunque la version exista', () => {
      const def = objeto([version('1.0.0', ['icono']), version('2.0.0', ['icono'])]);
      expect(() => bumpInstance(instancia('2.0.0'), def, '1.0.0')).toThrow(/no es retroceder/);
    });

    it('una definicion que es de otro objeto', () => {
      const def = { ...objeto([version('1.0.0', ['icono'])]), objectId: 'otro' };
      expect(() => bumpInstance(instancia('1.0.0'), def, '1.0.0')).toThrow(BumpError);
    });
  });
});

describe('latestVersion e isMajorJump', () => {
  it('la mas alta se elige por numero, no por texto', () => {
    const def = objeto([
      version('1.2.0', ['icono']),
      version('1.10.0', ['icono']),
      version('1.9.0', ['icono']),
    ]);
    // Ordenado como texto, '1.9.0' ganaria a '1.10.0'.
    expect(latestVersion(def)).toBe('1.10.0');
  });

  it('un salto de MAYOR se distingue, porque el numero existe para decir eso', () => {
    expect(isMajorJump('1.4.0', '2.0.0')).toBe(true);
    expect(isMajorJump('1.4.0', '1.9.0')).toBe(false);
  });
});
