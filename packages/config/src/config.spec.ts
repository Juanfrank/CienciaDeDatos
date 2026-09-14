import { InMemoryCacheStore } from '@app/caching';
import { describe, expect, it, vi } from 'vitest';
import {
  AppConfiguration,
  CONNECTOR_KEY,
  LAST_KEY_SNAPSHOT,
  EnvironmentSettings,
  SettingsResolver,
  moduleFlag,
  enabledModule,
  disabledModules,
  type SettingsFont,
  type SettingsSnapshot,
} from './index';

const foto = (banderas: Record<string, boolean>, valores: Record<string, string> = {}): SettingsSnapshot => ({
  banderas,
  valores,
  leidaEn: '2026-09-13T00:00:00.000Z',
});

const sourceWhere = (
  respuestas: (() => Promise<SettingsSnapshot>)[],
): SettingsFont => {
  let i = 0;
  return {
    nombre: 'prueba',
    leer: () => {
      const siguiente = respuestas[Math.min(i++, respuestas.length - 1)] ?? respuestas[0];
      if (!siguiente) throw new Error("La fuente de prueba no tiene respuestas");
      return siguiente();
    },
  };
};

describe('que cuenta como encendido', () => {
  it('una bandera ausente deja el modulo ENCENDIDO', () => {
    // Al reves, cada modulo nuevo naceria invisible hasta que alguien le creara su bandera en
    // Azure, y el sintoma seria «lo publique y no aparece».
    expect(enabledModule(foto({}), 'casos-pendientes')).toBe(true);
  });

  it('solo un false explicito lo apaga', () => {
    expect(enabledModule(foto({ [moduleFlag('x')]: false }), 'x')).toBe(false);
    expect(enabledModule(foto({ [moduleFlag('x')]: true }), 'x')).toBe(true);
  });

  it('sabe DECIR cuales estan apagados, no solo actuar', () => {
    const f = foto({ 'modulo.b': false, 'modulo.a': false, 'modulo.c': true, otra: false });
    expect(disabledModules(f)).toEqual(['a', 'b']);
  });
});

describe('resolutor: refresco', () => {
  it('sirve de la cache mientras el TTL no vence, y vuelve a la fuente cuando vence', async () => {
    let ahora = 0;
    const leer = vi.fn(async () => foto({}));
    const r = new SettingsResolver({
      source: { nombre: 'p', leer },
      ttlMs: 30_000,
      ahora: () => ahora,
    });

    await r.snapshot();
    await r.snapshot();
    expect(leer).toHaveBeenCalledTimes(1);

    ahora = 30_001;
    await r.snapshot();
    expect(leer).toHaveBeenCalledTimes(2);
  });

  it('diez lecturas a la vez hacen UN viaje, no diez', async () => {
    const leer = vi.fn(async () => foto({}));
    const r = new SettingsResolver({ source: { nombre: 'p', leer } });
    await Promise.all(Array.from({ length: 10 }, () => r.snapshot()));
    expect(leer).toHaveBeenCalledTimes(1);
  });
});

describe('resolutor: degradacion', () => {
  it('ante un fallo sirve la ULTIMA foto buena, no una vacia', async () => {
    let ahora = 0;
    const apagado = foto({ [moduleFlag('malo')]: false });
    const r = new SettingsResolver({
      source: sourceWhere([async () => apagado, async () => Promise.reject(new Error('502'))]),
      ttlMs: 1_000,
      ahora: () => ahora,
    });

    expect(enabledModule(await r.snapshot(), 'malo')).toBe(false);

    ahora = 2_000;
    // Lo que NO puede pasar: que un modulo apagado a proposito se reencienda porque el servicio
    // de banderas dejo de responder.
    expect(enabledModule(await r.snapshot(), 'malo')).toBe(false);
  });

  it('tras reiniciar durante la caida, recupera la foto guardada', async () => {
    const memoria = new InMemoryCacheStore({ ttlMs: 60_000 });
    const apagado = foto({ [moduleFlag('malo')]: false });

    const before = new SettingsResolver({ source: sourceWhere([async () => apagado]), memoria });
    await before.snapshot();
    // Se guarda fuera del camino de lectura; se espera un tick para que la escritura cuaje.
    await new Promise((r) => setTimeout(r, 0));
    expect((await memoria.get(LAST_KEY_SNAPSHOT))?.value).toBeDefined();

    // Proceso nuevo, mismo almacen compartido, y la fuente sigue caida. Sin memoria persistida
    // esta instancia reencenderia lo apagado — y un reinicio es justo lo que pasa en una caida.
    const after = new SettingsResolver({
      source: sourceWhere([async () => Promise.reject(new Error('caida'))]),
      memoria,
    });
    expect(enabledModule(await after.snapshot(), 'malo')).toBe(false);
  });

  it('sin ninguna foto, ni fresca ni guardada, SE ABRE', async () => {
    const alFallar = vi.fn();
    const r = new SettingsResolver({
      source: sourceWhere([async () => Promise.reject(new Error('primer arranque'))]),
      alFallar,
    });
    // El estado por defecto de un modulo es encendido. Dejar el portal en blanco porque el
    // servicio de banderas no contesta convertiria una dependencia auxiliar en punto unico de fallo.
    expect(enabledModule(await r.snapshot(), 'cualquiera')).toBe(true);
    // Pero se registra: un fallo silencioso es como se descubre tarde.
    expect(alFallar).toHaveBeenCalled();
  });

  it('un fallo al guardar la memoria no tumba la lectura', async () => {
    const memoria = new InMemoryCacheStore({ ttlMs: 1_000 });
    vi.spyOn(memoria, 'set').mockRejectedValue(new Error('disco lleno'));
    const r = new SettingsResolver({ source: sourceWhere([async () => foto({})]), memoria });
    await expect(r.snapshot()).resolves.toBeDefined();
  });
});

describe('fuente de entorno', () => {
  it('traduce MODULOS_APAGADOS y DATA_CONNECTOR', async () => {
    const f = await new EnvironmentSettings({
      MODULOS_APAGADOS: 'uno, dos ,',
      DATA_CONNECTOR: 'sql',
    } as NodeJS.ProcessEnv).leer();

    expect(enabledModule(f, 'uno')).toBe(false);
    expect(enabledModule(f, 'dos')).toBe(false);
    expect(enabledModule(f, 'tres')).toBe(true);
    expect(f.valores[CONNECTOR_KEY]).toBe('sql');
  });
});

describe('fuente de App Configuration', () => {
  const respuesta = (body: unknown, ok = true) =>
    ({ ok, status: 200, statusText: 'OK', json: async () => body }) as Response;

  it('separa banderas de valores y lee enabled', async () => {
    const search = vi.fn(async () =>
      respuesta({
        items: [
          {
            key: '.appconfig.featureflag/modulo.casos-pendientes',
            value: JSON.stringify({ id: 'modulo.casos-pendientes', enabled: false }),
          },
          { key: 'conector', value: 'xmla' },
        ],
      }),
    );

    const f = await new AppConfiguration({
      endpoint: 'https://t.azconfig.io',
      tokenGet: async () => 'tok',
      search: search as unknown as typeof fetch,
    }).leer();

    expect(enabledModule(f, 'casos-pendientes')).toBe(false);
    expect(f.valores[CONNECTOR_KEY]).toBe('xmla');
  });

  it('sigue la paginacion', async () => {
    let llamada = 0;
    const search = vi.fn(async () => {
      llamada += 1;
      return llamada === 1
        ? respuesta({
            items: [{ key: '.appconfig.featureflag/modulo.a', value: '{"enabled":false}' }],
            '@nextLink': '/kv?after=xyz',
          })
        : respuesta({ items: [{ key: '.appconfig.featureflag/modulo.b', value: '{"enabled":false}' }] });
    });

    const f = await new AppConfiguration({
      endpoint: 'https://t.azconfig.io',
      tokenGet: async () => 'tok',
      search: search as unknown as typeof fetch,
    }).leer();

    // Quedarse en la primera pagina dejaria banderas fuera, y «ausente» significa encendido: un
    // modulo apagado volveria a servirse solo porque la tienda crecio.
    expect(disabledModules(f)).toEqual(['a', 'b']);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('una respuesta de error se propaga, para que el resolutor degrade', async () => {
    const search = vi.fn(async () => ({ ok: false, status: 403, statusText: 'Forbidden' }) as Response);
    await expect(
      new AppConfiguration({
        endpoint: 'https://t.azconfig.io',
        tokenGet: async () => 'tok',
        search: search as unknown as typeof fetch,
      }).leer(),
    ).rejects.toThrow('403');
  });

  it('un JSON de bandera ilegible cuenta como ENCENDIDA', async () => {
    const search = vi.fn(async () =>
      respuesta({ items: [{ key: '.appconfig.featureflag/modulo.x', value: 'no-es-json' }] }),
    );
    const f = await new AppConfiguration({
      endpoint: 'https://t.azconfig.io',
      tokenGet: async () => 'tok',
      search: search as unknown as typeof fetch,
    }).leer();
    // Apagar por no saber leer un valor convertiria un error de formato en una caida de modulo.
    expect(enabledModule(f, 'x')).toBe(true);
  });
});
