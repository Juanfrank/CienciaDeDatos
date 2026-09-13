import { describe, expect, it } from 'vitest';
import { healthOf } from './health';
import type { ModuleDiagnostics } from './validation';

const diagnostico = (
  items: { roto: boolean }[],
  layoutProblems: ModuleDiagnostics['layoutProblems'] = [],
): ModuleDiagnostics => ({
  moduleId: 'm',
  hasBrokenItems: items.some((i) => i.roto),
  layoutProblems,
  items: items.map((i, n) => ({
    itemId: `i${n}`,
    objectId: 'tarjeta-kpi',
    version: '1.0.0',
    bindingProblems: i.roto
      ? [{ slot: 'x', kind: 'campo-inexistente' as const, problem: 'El campo ya no existe.' }]
      : [],
    broken: i.roto,
  })),
});

describe('salud de un modulo', () => {
  it('sin nada roto, ok', () => {
    expect(healthOf(diagnostico([{ roto: false }, { roto: false }])).health).toBe('ok');
  });

  it('un objeto roto entre varios es DEGRADADO, no caido', () => {
    // Es la regla de 4.2: el objeto se marca y el resto sigue funcionando. Apagar el modulo
    // entero por un campo retirado seria incumplirla desde el despliegue.
    const resumen = healthOf(diagnostico([{ roto: true }, { roto: false }]));
    expect(resumen.health).toBe('degradado');
    expect(resumen.objetos).toEqual({ total: 2, rotos: 1 });
  });

  it('TODOS los objetos rotos es fallo: no queda resto que siga funcionando', () => {
    expect(healthOf(diagnostico([{ roto: true }, { roto: true }])).health).toBe('fallo');
  });

  it('una disposicion invalida tumba el modulo aunque los objetos esten sanos', () => {
    // Dos bloques superpuestos no se pueden dibujar ni marcar: no hay donde ponerlos.
    const resumen = healthOf(
      diagnostico([{ roto: false }], [{ kind: 'solapamiento', itemIds: ['a', 'b'], problem: 'Se solapan.' }]),
    );
    expect(resumen.health).toBe('fallo');
    // El motivo de disposicion va PRIMERO: es el que explica por que se apaga.
    expect(resumen.problems[0]).toBe('Se solapan.');
  });

  it('un modulo sin objetos es fallo, no degradado', () => {
    expect(healthOf(diagnostico([])).health).toBe('fallo');
  });
});
