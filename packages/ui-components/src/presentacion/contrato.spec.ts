import { describe, expect, it } from 'vitest';
import { catalogoInicial } from '../registry/catalog';
import { ICONOS_DE_OBJETO, NOMBRES_DE_ICONO, TRAZOS_DE_ICONO } from './iconos';
import {
  CLAVES_DE_PRESENTACION,
  PRESENTACION_MINIMA,
  formateadorDe,
  validarPresentacion,
  type ClaveDePresentacion,
} from './contrato';

/**
 * El estandar minimo, como prueba.
 *
 * Esto es lo que convierte «todo objeto deberia poder personalizarse» en una regla: sin esta
 * prueba, la frase vive en un comentario y el primer objeto que se anada con prisa se la salta
 * sin que nadie se entere hasta que alguien pide ponerle un icono.
 */
describe('el minimo de personalizacion lo cumple TODO el catalogo', () => {
  const versiones = catalogoInicial.flatMap((o) =>
    o.versions.map((v) => ({ objectId: o.objectId, categoria: o.category, version: v })),
  );

  it.each(versiones.map((v) => [`${v.objectId}@${v.version.version}`, v] as const))(
    '%s admite las cuatro claves basicas',
    (_nombre, { version }) => {
      for (const clave of PRESENTACION_MINIMA) {
        expect(version.presentation).toContain(clave);
      }
    },
  );

  it('ningun objeto declara una clave que no existe en el contrato', () => {
    // La lista sale de `CLAVES_DE_PRESENTACION`, no de una copia aqui: una copia se queda
    // obsoleta en cuanto se anade una clave, y entonces la prueba falla por estar desactualizada
    // en vez de por haber encontrado algo.
    const validas = new Set<string>(CLAVES_DE_PRESENTACION);
    for (const { objectId, version } of versiones) {
      for (const clave of version.presentation) {
        expect(validas, `${objectId} declara '${clave}'`).toContain(clave);
      }
    }
  });

  it('solo los graficos admiten leyenda y etiquetas de dato', () => {
    // Una tabla con `leyenda` guardaria una opcion que no dibuja nada, y esa es la clase de
    // configuracion muerta que luego nadie se atreve a quitar por si acaso hace algo.
    for (const { categoria, version, objectId } of versiones) {
      const deGrafico = version.presentation.filter((c) =>
        (['leyenda', 'etiquetasDeDato'] as ClaveDePresentacion[]).includes(c),
      );
      if (categoria !== 'grafico') {
        expect(deGrafico, `${objectId} no es un grafico`).toEqual([]);
      }
    }
  });
});

describe('validarPresentacion', () => {
  const todas: ClaveDePresentacion[] = [
    ...PRESENTACION_MINIMA,
    'formato',
    'leyenda',
    'etiquetasDeDato',
  ];

  it('acepta una presentacion completa y valida', () => {
    expect(
      validarPresentacion(
        {
          icono: 'balanza',
          acento: 'terciario',
          resaltado: true,
          subtitulo: 'Cierre del trimestre',
          formato: { decimales: 1, unidad: '%' },
          leyenda: 'oculta',
          etiquetasDeDato: true,
        },
        todas,
      ),
    ).toEqual([]);
  });

  it('rechaza una clave que el objeto no admite, y dice cuales admite', () => {
    const [problema] = validarPresentacion({ leyenda: 'abajo' }, PRESENTACION_MINIMA);
    expect(problema?.clave).toBe('leyenda');
    expect(problema?.problema).toContain('icono');
  });

  it('rechaza un icono que no esta en el catalogo', () => {
    const problemas = validarPresentacion(
      { icono: 'unicornio' as never },
      PRESENTACION_MINIMA,
    );
    expect(problemas.map((p) => p.clave)).toEqual(['icono']);
  });

  it('rechaza un color en vez de un rol de acento', () => {
    // El punto de 4.3: si aqui entrara '#ff0000', la puerta de contraste dejaria de garantizar
    // nada sobre lo que se ve, porque ese color no sale de ningun par comprobado.
    const problemas = validarPresentacion({ acento: '#ff0000' as never }, PRESENTACION_MINIMA);
    expect(problemas.map((p) => p.clave)).toEqual(['acento']);
  });

  it('rechaza un subtitulo que es un parrafo', () => {
    const problemas = validarPresentacion({ subtitulo: 'x'.repeat(81) }, PRESENTACION_MINIMA);
    expect(problemas.map((p) => p.clave)).toEqual(['subtitulo']);
  });

  it('rechaza decimales fuera de rango y unidades que son frases', () => {
    const problemas = validarPresentacion(
      { formato: { decimales: 9, unidad: 'casos pendientes' } },
      todas,
    );
    expect(problemas.map((p) => p.clave).sort()).toEqual(['formato.decimales', 'formato.unidad']);
  });

  it('no se queja de una instancia sin presentacion', () => {
    expect(validarPresentacion(undefined, PRESENTACION_MINIMA)).toEqual([]);
  });
});

describe('formateadorDe', () => {
  // `Intl` separa la cifra de su sufijo compacto con un espacio DURO, que es lo tipograficamente
  // correcto —no se parte de linea entre «12,5» y «k»— y no se ve en el codigo fuente. Se
  // normaliza para que una prueba que falla no muestre dos cadenas identicas.
  const sinDuros = (s: string) => s.replace(/\u00a0/g, ' ');

  it('sin formato, entero con separador de miles', () => {
    expect(formateadorDe(undefined)(12500)).toBe('12,500');
  });

  it('respeta los decimales pedidos', () => {
    expect(formateadorDe({ decimales: 2 })(12.5)).toBe('12.50');
  });

  it('anade la unidad separada del numero', () => {
    expect(formateadorDe({ unidad: '%' })(18)).toBe('18 %');
  });

  it('compacta cuando se le pide, sin comerse la precision', () => {
    // Con cero decimales, 12.500 salia «13 k»: el compacto redondea sobre la cifra ya reducida.
    expect(sinDuros(formateadorDe({ compacto: true })(12500))).toBe('12.5 k');
    expect(sinDuros(formateadorDe({ compacto: true })(12000))).toBe('12 k');
    // Y si alguien pide decimales explicitos, mandan los pedidos.
    expect(sinDuros(formateadorDe({ compacto: true, decimales: 0 })(12500))).toBe('13 k');
  });
});

describe('el catalogo de iconos', () => {
  it('todos los ofrecidos para un objeto existen', () => {
    for (const nombre of ICONOS_DE_OBJETO) expect(NOMBRES_DE_ICONO).toContain(nombre);
  });

  it('ningun trazo esta vacio', () => {
    for (const [nombre, trazo] of Object.entries(TRAZOS_DE_ICONO)) {
      expect(trazo.length, nombre).toBeGreaterThan(4);
    }
  });

  it('el cromo de la aplicacion NO se ofrece para rotular un dato', () => {
    // Un aspa de cerrar encima de una cifra no significa nada, y el editor no deberia poder
    // ofrecerlo solo porque el icono exista.
    expect(ICONOS_DE_OBJETO).not.toContain('cerrar');
    expect(ICONOS_DE_OBJETO).not.toContain('sandwich');
  });
});
