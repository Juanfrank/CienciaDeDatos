import { describe, expect, it } from 'vitest';
import type { AccessScope, Team } from './index';
import { administratorsOf, wouldLeaveNoAdministrator } from './index';

/**
 * La institucion no puede quedarse sin ningun Administrador — seccion 4.10.1.
 *
 * El caso que esta funcion existe para impedir no es hipotetico: el modelo de permisos es
 * circular, y sin esta comprobacion un Administrador puede retirarse el rol a si mismo y dejar
 * el gobierno inaccesible para todos, incluido el.
 */

const SIN_AMBITO: AccessScope = { restrictions: [] };

const equipo = (id: string, miembros: Team['members']): Team => ({
  id,
  name: id,
  grantedNodes: [],
  members: miembros,
  defaultScope: SIN_AMBITO,
  moduleScopeOverrides: {},
});

describe('quienes administran', () => {
  it('recoge el rol de CUALQUIER equipo: administrar no es por equipo', () => {
    const equipos = [
      equipo('norte', [
        { userId: 'u-ana', role: 'colaborador' },
        { userId: 'u-admin', role: 'administrador' },
      ]),
      equipo('este', [{ userId: 'u-otra', role: 'administrador' }]),
    ];

    expect(administratorsOf(equipos)).toEqual(['u-admin', 'u-otra']);
  });

  it('no repite a quien administra en dos equipos', () => {
    const equipos = [
      equipo('norte', [{ userId: 'u-admin', role: 'administrador' }]),
      equipo('este', [{ userId: 'u-admin', role: 'administrador' }]),
    ];
    expect(administratorsOf(equipos)).toEqual(['u-admin']);
  });
});

describe('el cambio que se lleva al ultimo Administrador', () => {
  const conUno = [
    equipo('norte', [
      { userId: 'u-admin', role: 'administrador' },
      { userId: 'u-ana', role: 'colaborador' },
    ]),
  ];

  it('retirarle el rol al unico que hay se deniega', () => {
    const despues = [equipo('norte', [{ userId: 'u-ana', role: 'colaborador' }])];
    const denegacion = wouldLeaveNoAdministrator(conUno, despues);

    expect(denegacion).not.toBeNull();
    // El mensaje NOMBRA a quien administra: sin eso, quien lo lea no sabe a quien nombrar antes.
    expect(denegacion?.reason).toContain('u-admin');
    expect(denegacion?.before).toEqual(['u-admin']);
  });

  it('degradarlo a Colaborador tambien: no hace falta quitarlo del equipo', () => {
    const despues = [
      equipo('norte', [
        { userId: 'u-admin', role: 'colaborador' },
        { userId: 'u-ana', role: 'colaborador' },
      ]),
    ];
    expect(wouldLeaveNoAdministrator(conUno, despues)).not.toBeNull();
  });

  it('borrar el equipo donde estaba tambien, por un camino que no menciona la palabra rol', () => {
    expect(wouldLeaveNoAdministrator(conUno, [])).not.toBeNull();
  });

  it('si queda otro, se permite', () => {
    const antes = [
      equipo('norte', [{ userId: 'u-admin', role: 'administrador' }]),
      equipo('este', [{ userId: 'u-otra', role: 'administrador' }]),
    ];
    const despues = [
      equipo('norte', [{ userId: 'u-admin', role: 'colaborador' }]),
      equipo('este', [{ userId: 'u-otra', role: 'administrador' }]),
    ];
    expect(wouldLeaveNoAdministrator(antes, despues)).toBeNull();
  });

  it('un cambio que no toca la membresia no se estorba', () => {
    const norte = conUno[0];
    if (!norte) throw new Error('fixture inesperado');
    const despues = [{ ...norte, name: 'Renombrado', grantedNodes: ['nodo-x'] }];
    expect(wouldLeaveNoAdministrator(conUno, despues)).toBeNull();
  });

  it('nombrar a otro Administrador se permite, obviamente', () => {
    const despues = [
      equipo('norte', [
        { userId: 'u-admin', role: 'administrador' },
        { userId: 'u-ana', role: 'administrador' },
      ]),
    ];
    expect(wouldLeaveNoAdministrator(conUno, despues)).toBeNull();
  });
});

describe('el sistema que YA esta sin Administradores', () => {
  it('no se bloquea: si no habia ninguno, ningun cambio se lleva al ultimo', () => {
    const antes = [equipo('norte', [{ userId: 'u-ana', role: 'colaborador' }])];

    // Denegar aqui dejaria el gobierno bloqueado para siempre, incluido el cambio que lo
    // arregla. La comprobacion no es "el resultado tiene Administradores" sino "este cambio se
    // lleva al ultimo".
    expect(wouldLeaveNoAdministrator(antes, [])).toBeNull();
    expect(wouldLeaveNoAdministrator(antes, antes)).toBeNull();
  });

  it('y el cambio que restituye a uno pasa sin problema', () => {
    const antes = [equipo('norte', [{ userId: 'u-ana', role: 'colaborador' }])];
    const despues = [equipo('norte', [{ userId: 'u-ana', role: 'administrador' }])];
    expect(wouldLeaveNoAdministrator(antes, despues)).toBeNull();
  });
});
