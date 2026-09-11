import { describe, expect, it } from 'vitest';
import { PermissionError, assertCan, can, capabilitiesOf, denial, type Capability } from './permissions';
import { APP_ROLES } from './Team';

describe('matriz de permisos (4.10.1)', () => {
  it('las tres capacidades basicas las tienen los tres roles', () => {
    for (const rol of APP_ROLES) {
      expect(can(rol, 'ver-modulos-de-sus-equipos')).toBe(true);
      expect(can(rol, 'personalizar-su-vista')).toBe(true);
    }
  });

  it('Visor no puede crear ni editar modulos', () => {
    expect(can('visor', 'crear-editar-modulos-borrador')).toBe(false);
    expect(can('colaborador', 'crear-editar-modulos-borrador')).toBe(true);
    expect(can('administrador', 'crear-editar-modulos-borrador')).toBe(true);
  });

  it('solo Administrador publica a nivel institucional: Colaborador solo propone', () => {
    expect(can('colaborador', 'publicar-modulo-institucional')).toBe(false);
    expect(can('administrador', 'publicar-modulo-institucional')).toBe(true);
  });

  it('la gestion de equipos, usuarios, ambitos y auditoria es exclusiva de Administrador', () => {
    const exclusivas: Capability[] = [
      'gestionar-equipos',
      'gestionar-usuarios-y-roles',
      'configurar-ambitos',
      'ver-panel-auditoria',
      'gestionar-paquetes-visuales',
      'borrar-definitivamente',
    ];
    for (const capacidad of exclusivas) {
      expect(can('administrador', capacidad)).toBe(true);
      expect(can('colaborador', capacidad)).toBe(false);
      expect(can('visor', capacidad)).toBe(false);
    }
  });

  it('reorganizar el arbol general es de Administrador, aunque "mover" suene cosmetico', () => {
    // 4.1.2: mover puede cambiar el ambito de datos de un modulo. No es una operacion visual.
    expect(can('administrador', 'reorganizar-arbol-general')).toBe(true);
    expect(can('colaborador', 'reorganizar-arbol-general')).toBe(false);
  });

  it('un Colaborador puede proponer objetos al repositorio compartido', () => {
    expect(can('colaborador', 'proponer-objetos-al-repositorio')).toBe(true);
    expect(can('visor', 'proponer-objetos-al-repositorio')).toBe(false);
  });
});

describe('assertCan: la comprobacion vive en el backend, no en la interfaz', () => {
  it('un Visor que llama directamente a una operacion de administracion es rechazado', () => {
    // Criterio de la seccion 9: "aunque intente hacerlo mediante manipulacion directa de
    // solicitudes (prueba a nivel de backend, no solo ocultamiento de UI)".
    expect(() => assertCan('visor', 'gestionar-usuarios-y-roles')).toThrow(PermissionError);
    expect(() => assertCan('visor', 'configurar-ambitos')).toThrow(PermissionError);
    expect(() => assertCan('visor', 'crear-editar-modulos-borrador')).toThrow(PermissionError);
  });

  it('el error explica quien si puede, para que el mensaje sea accionable', () => {
    try {
      assertCan('colaborador', 'publicar-modulo-institucional');
      expect.unreachable('se esperaba un PermissionError');
    } catch (error) {
      expect(error).toBeInstanceOf(PermissionError);
      expect((error as PermissionError).message).toMatch(/Permitido para: administrador/);
    }
  });

  it('no lanza cuando el rol si tiene la capacidad', () => {
    expect(() => assertCan('administrador', 'configurar-ambitos')).not.toThrow();
  });
});

describe('capabilitiesOf', () => {
  it('Administrador tiene estrictamente mas capacidades que Colaborador, y este que Visor', () => {
    const admin = capabilitiesOf('administrador');
    const colaborador = capabilitiesOf('colaborador');
    const visor = capabilitiesOf('visor');

    expect(admin.length).toBeGreaterThan(colaborador.length);
    expect(colaborador.length).toBeGreaterThan(visor.length);
    // Y son subconjuntos: no hay capacidad que tenga Visor y no tenga Administrador.
    expect(visor.every((c) => colaborador.includes(c))).toBe(true);
    expect(colaborador.every((c) => admin.includes(c))).toBe(true);
  });

  it('denial describe el rol, la capacidad y quien si puede', () => {
    const d = denial('visor', 'gestionar-equipos');
    expect(d.role).toBe('visor');
    expect(d.capability).toBe('gestionar-equipos');
    expect(d.reason).toContain('administrador');
  });
});
