import { describe, expect, it } from 'vitest';
import { contractSlots, validatePresentation, validateSlots } from '@app/ui-components';
import { objectRegistry } from './contexto';
import { modulosDemo } from './modulos';

/**
 * Las ranuras que un modulo guardado usa tienen que existir en el contrato de su objeto.
 *
 * El id de una ranura es un contrato de cadena aunque se escriba como clave de objeto: el modulo
 * lleva `ranuras: { filas: [...] }` y el catalogo declara `{ id: 'filas' }`. Los dos lados se
 * escriben en sitios distintos y nada los ata, asi que se separan en silencio —un renombrado que
 * toque uno solo, una ranura retirada de una version nueva— y el objeto sale marcado como roto en
 * pantalla. Aqui se ve en segundos, no tras ocho minutos de navegador.
 */
describe('ranuras de los modulos de demostracion', () => {
  const instancias = modulosDemo.flatMap((m) =>
    m.pages.flatMap((p) =>
      p.items.map((i) => ({ modulo: m.slug, item: i.id, instance: i.instance })),
    ),
  );

  it('hay instancias que comprobar', () => {
    expect(instancias.length).toBeGreaterThan(0);
  });

  for (const { modulo, item, instance } of instancias) {
    it(`${modulo}/${item}: cada ranura asignada existe en el contrato`, () => {
      const contrato = objectRegistry.resolve(instance.objectId, instance.version).dataContract;
      const declaradas = contractSlots(contrato).map((r) => r.id);
      const usadas = Object.keys(instance.binding.slots ?? {});
      expect(usadas.filter((r) => !declaradas.includes(r))).toEqual([]);
    });

    it(`${modulo}/${item}: las ranuras cumplen minimos y maximos`, () => {
      const contrato = objectRegistry.resolve(instance.objectId, instance.version).dataContract;
      expect(validateSlots(instance, contractSlots(contrato))).toEqual([]);
    });

    /*
     * La presentacion cae en lo mismo. `icono: 'tabs'` es una cadena suelta contra las claves de
     * `TRAZOS_DE_ICONO`, y aqui el campo no esta tipado, asi que el compilador no relaciona una
     * con otra: un icono que dejo de existir se dibuja vacio y nadie se entera.
     */
    it(`${modulo}/${item}: la presentacion usa claves e iconos que existen`, () => {
      const version = objectRegistry.resolve(instance.objectId, instance.version);
      expect(validatePresentation(instance.presentacion, version.presentation)).toEqual([]);
    });
  }
});
