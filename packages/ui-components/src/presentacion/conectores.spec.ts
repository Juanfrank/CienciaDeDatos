import { describe, expect, it } from 'vitest';
import { trazar } from './conectores';

/** El trazado de un conector. */
describe('trazar', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };

  it('sale por el borde derecho cuando el destino esta a la derecha', () => {
    const b = { x: 300, y: 0, w: 100, h: 50 };
    const { puntos } = trazar(a, b);
    expect(puntos[0]).toEqual([100, 25]);
    expect(puntos[puntos.length - 1]).toEqual([300, 25]);
  });

  it('sale por el izquierdo cuando el destino esta a la izquierda', () => {
    const b = { x: -300, y: 0, w: 100, h: 50 };
    const { puntos } = trazar(a, b);
    expect(puntos[0]).toEqual([0, 25]);
    expect(puntos[puntos.length - 1]).toEqual([-200, 25]);
  });

  it('sale por abajo cuando el destino esta debajo, no por un lado', () => {
    const b = { x: 0, y: 400, w: 100, h: 50 };
    const { puntos } = trazar(a, b);
    expect(puntos[0]).toEqual([50, 50]);
    expect(puntos[puntos.length - 1]).toEqual([50, 400]);
  });

  it('elige el eje dominante: casi a la misma altura, sale por el lado', () => {
    // 300 de separacion horizontal contra 10 de vertical: horizontal manda.
    const b = { x: 300, y: 10, w: 100, h: 50 };
    const { puntos } = trazar(a, b);
    expect(puntos[0]?.[0]).toBe(100);
  });

  it('el trazado en angulo pasa por el punto medio del eje dominante', () => {
    const b = { x: 300, y: 200, w: 100, h: 50 };
    const { puntos } = trazar(a, b);
    // Cuatro puntos: salida, dos de quiebro, entrada. Los dos de en medio comparten coordenada en
    // el eje por el que se sale, que es lo que dibuja el codo.
    expect(puntos).toHaveLength(4);
    expect(puntos[1]?.[0]).toBe(puntos[2]?.[0]);
  });
});
