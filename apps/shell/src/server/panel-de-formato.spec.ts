import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLAVES_DE_PRESENTACION, initialCatalog, type PresentationKey } from '@app/ui-components';
import { CONTROL_DE_CLAVE } from '../components/editor/controles';

/** Toda clave de presentacion que un objeto DECLARA tiene un control en el panel — 4.2. */

const PANEL = readFileSync(
  join(process.cwd(), 'apps/shell/src/components/editor/Presentacion.tsx'),
  'utf8',
);

describe('el panel de Formato ofrece todo lo que el catalogo declara', () => {
  it('la tabla de controles cubre TODAS las claves, sin sobrar ninguna', () => {
    // Si manana se anade una clave de presentacion y nadie la mapea, esta prueba lo dice antes de
    // que el control «se quede para luego» y nadie vuelva a acordarse.
    expect(Object.keys(CONTROL_DE_CLAVE).sort()).toEqual([...CLAVES_DE_PRESENTACION].sort());
  });

  for (const clave of CLAVES_DE_PRESENTACION) {
    it(`${clave}: tiene un control con su identificador de prueba`, () => {
      expect(PANEL, `falta el testid de ${clave}`).toContain(
        `${CONTROL_DE_CLAVE[clave]}\`}`,
      );
    });
  }

  it('cada clave opcional esta ademas detras de su propio `admite`', () => {
    /*
     * Las del minimo de personalizacion las declara todo objeto, asi que su control se dibuja
     * siempre y no necesita guarda. Las demas si: sin `admite`, una tabla ofreceria «Leyenda» y
     * un cuadro de texto ofreceria «Apilado» —opciones que su objeto no entiende y que la
     * validacion rechaza al guardar—.
     */
    const SIEMPRE: PresentationKey[] = ['mostrarTitulo', 'colorDeResaltado', 'etiqueta'];
    const sinGuarda = CLAVES_DE_PRESENTACION.filter(
      (c) => !SIEMPRE.includes(c) && !PANEL.includes(`admite("${c}")`),
    );

    expect(sinGuarda).toEqual([]);
  });
});

describe('y todo objeto colocable llega al panel con algo que configurar', () => {
  const colocables = initialCatalog.filter((o) => !o.attachable);

  it('hay objetos colocables que comprobar', () => {
    expect(colocables.length).toBeGreaterThan(20);
  });

  for (const objeto of colocables) {
    const version = objeto.versions[objeto.versions.length - 1];

    it(`${objeto.objectId}: sus claves declaradas tienen control`, () => {
      const sinControl = (version?.presentation ?? []).filter((c) => !CONTROL_DE_CLAVE[c]);
      expect(sinControl).toEqual([]);
    });
  }
});
