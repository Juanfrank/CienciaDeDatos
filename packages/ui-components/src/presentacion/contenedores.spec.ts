import { describe, expect, it } from 'vitest';
import {
  columnasDe,
  configuracionInicial,
  instanciasAnidadas,
  panelesDe,
  seSolapanEnRejilla,
  validarContenedor,
} from './contenedores';
import type { ConfiguracionDeContenedor, ItemAnidado } from './contenedores';

const item = (id: string, x: number, y: number, w = 2, h = 2): ItemAnidado => ({
  id,
  position: { x, y, w, h },
  instance: {
    instanceId: id,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    binding: { datasetId: 'd', dimensions: [], measures: ['m'] },
  },
});

const con = (config: ConfiguracionDeContenedor, objectId = 'contenedor-simple') =>
  validarContenedor('c1', { objectId, configuracion: config });

describe('paneles', () => {
  it('siempre hay al menos uno: un contenedor sin panel no tiene donde poner nada', () => {
    expect(panelesDe(undefined)).toHaveLength(1);
    expect(panelesDe({ paneles: [] })).toHaveLength(1);
  });

  it('recoge las instancias de TODOS los paneles, no solo la visible', () => {
    const config: ConfiguracionDeContenedor = {
      paneles: [
        { panelId: 'p1', nombre: 'Uno', items: [item('a', 0, 0)] },
        { panelId: 'p2', nombre: 'Dos', items: [item('b', 0, 0)] },
      ],
    };
    // Importa para los avisos de deprecacion: un objeto en la segunda pestana esta desplegado
    // igual, y omitirlo dejaria sin avisar a los modulos que lo usan.
    expect(instanciasAnidadas(config).map((i) => i.instanceId)).toEqual(['a', 'b']);
  });
});

describe('validarContenedor', () => {
  it('no dice nada de un objeto que no es contenedor', () => {
    expect(validarContenedor('x', { objectId: 'barras' })).toEqual([]);
  });

  it('rechaza dos hijos superpuestos', () => {
    const problemas = con({
      paneles: [{ panelId: 'p1', nombre: '', items: [item('a', 0, 0), item('b', 1, 1)] }],
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.problema).toContain('solapa');
  });

  it('acepta dos hijos que se tocan sin pisarse', () => {
    expect(
      con({ paneles: [{ panelId: 'p1', nombre: '', items: [item('a', 0, 0), item('b', 2, 0)] }] }),
    ).toEqual([]);
  });

  it('rechaza un hijo que se sale de las columnas del contenedor', () => {
    const problemas = con({
      simple: { columnas: 3 },
      paneles: [{ panelId: 'p1', nombre: '', items: [item('a', 2, 0, 2)] }],
    });
    expect(problemas[0]?.problema).toContain('3 columnas');
  });

  it('rechaza un contenedor con pestanas que solo tiene una', () => {
    const problemas = validarContenedor('c1', {
      objectId: 'contenedor-con-pestanas',
      configuracion: { paneles: [{ panelId: 'p1', nombre: 'Sola', items: [] }] },
    });
    expect(problemas[0]?.problema).toContain('al menos dos');
  });

  it('rechaza dos paneles con el mismo id', () => {
    const problemas = validarContenedor('c1', {
      objectId: 'contenedor-con-pestanas',
      configuracion: {
        paneles: [
          { panelId: 'p1', nombre: 'A', items: [] },
          { panelId: 'p1', nombre: 'B', items: [] },
        ],
      },
    });
    expect(problemas.some((p) => p.problema.includes("id 'p1'"))).toBe(true);
  });

  it('rechaza un eje que no es X ni Y', () => {
    const problemas = validarContenedor('c1', {
      objectId: 'contenedor-desplazable',
      // Lo que este caso protege: que «ambos» no entre por la puerta de atras editando el JSON.
      configuracion: { desplazable: { eje: 'ambos' as unknown as 'x' } },
    });
    expect(problemas[0]?.problema).toContain('nunca por los dos');
  });
});

describe('configuracion inicial', () => {
  it('el de pestanas nace con dos: con una nacería marcado como roto', () => {
    const config = configuracionInicial('contenedor-con-pestanas');
    expect(config && 'paneles' in config ? config.paneles : []).toHaveLength(2);
    expect(validarContenedor('c1', { objectId: 'contenedor-con-pestanas', configuracion: config })).toEqual([]);
  });

  it('cada elemento nace con su configuracion, no vacio', () => {
    expect(configuracionInicial('cuadro-de-texto')).toHaveProperty('cuadroDeTexto');
    expect(configuracionInicial('forma')).toHaveProperty('forma');
    expect(configuracionInicial('conexion')).toHaveProperty('conexion');
  });

  it('un objeto que no es ni elemento ni contenedor no lleva configuracion', () => {
    expect(configuracionInicial('barras')).toBeUndefined();
  });
});

describe('columnasDe', () => {
  it('lee las columnas del bloque del tipo que sea', () => {
    expect(columnasDe('contenedor-desplazable', { desplazable: { columnas: 4 } })).toBe(4);
    expect(columnasDe('contenedor-simple', undefined)).toBe(6);
  });

  it('nunca devuelve cero: una rejilla de cero columnas no coloca nada', () => {
    expect(columnasDe('contenedor-simple', { simple: { columnas: 0 } })).toBe(1);
  });
});

describe('seSolapanEnRejilla', () => {
  it('tocarse por el borde no es solaparse', () => {
    expect(seSolapanEnRejilla({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 })).toBe(false);
    expect(seSolapanEnRejilla({ x: 0, y: 0, w: 2, h: 2 }, { x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });
});
