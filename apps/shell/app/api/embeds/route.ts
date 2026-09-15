import { NextResponse } from 'next/server';
import { canAccessModule } from '@app/access-control';
import { actorDe, slugServableModule } from '../../../src/server/cicloDeVida';
import { findTeam, findUser, getGeneralTree } from '../../../src/server/context';
import { embedChromeOf } from '../../../src/server/embedding';
import { embedCreate, embedRevoke, embedsList } from '../../../src/server/incrustaciones';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';
import { roleMoreHeightOf } from '../../../src/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Codigos de incrustacion — seccion 4.9.
 *
 * Generar uno lo puede hacer quien PUEDE VER el modulo: el codigo no concede nada —quien abra la
 * vista incrustada seguira viendo lo que su propio ambito permita— y exigir Administrador para
 * algo que no amplia el acceso solo conseguiria que la gente compartiera capturas.
 *
 * Listarlos y revocarlos, en cambio, si es de Administrador: es el registro de donde estan las
 * vistas de la institucion, y quitar una afecta a la pagina de otro.
 */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  if ((await roleMoreHeightOf(sesion.userId)) !== 'administrador') {
    return NextResponse.json({ error: 'No tiene permiso.' }, { status: 403 });
  }
  return NextResponse.json({ codigos: await embedsList() });
}

export async function POST(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const slug = body['modulo'];
  if (typeof slug !== 'string') {
    return NextResponse.json({ error: 'Falta el modulo.' }, { status: 400 });
  }

  // Por el mismo camino que servir el modulo: incrustar no puede ser el atajo que exponga un
  // borrador ajeno ni algo retirado.
  const modulo = await slugServableModule(slug, await actorDe(sesion));
  if (!modulo) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  /*
   * Y la MISMA comprobacion de acceso que hace la pagina, no solo la de estado.
   *
   * Que un modulo este publicado no quiere decir que quien pide el codigo lo alcance: el acceso
   * se concede por nodo del arbol, a un equipo o a una persona. Sin esto, generar un codigo era
   * el atajo que se saltaba esa concesion — la vista seguiria sin dibujarse para quien no la
   * tiene, pero la URL existiria y el registro diria que alguien la incrusto.
   */
  const [equipo, persona] = await Promise.all([
    findTeam(sesion.activeTeamId),
    findUser(sesion.userId),
  ]);
  if (
    !equipo ||
    !canAccessModule({
      generalTree: await getGeneralTree(),
      team: equipo,
      ...(persona ? { user: persona } : {}),
      moduleId: modulo.moduleId,
    })
  ) {
    return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });
  }

  const filtros: Record<string, string[]> = {};
  const pedidos = body['filtros'];
  if (pedidos && typeof pedidos === 'object') {
    for (const [clave, valor] of Object.entries(pedidos as Record<string, unknown>)) {
      // Por `Object.entries` y asignando con corchetes sobre un objeto literal: `__proto__` como
      // clave se trataria como propiedad del lenguaje y el filtro desapareceria sin dejar rastro.
      if (clave === '__proto__') continue;
      const lista = Array.isArray(valor) ? valor : [valor];
      filtros[clave] = lista.filter((v): v is string => typeof v === 'string');
    }
  }

  const codigo = await embedCreate({
    moduleId: modulo.moduleId,
    moduleSlug: modulo.slug,
    moduleName: modulo.name,
    ...(typeof body['pagina'] === 'string' ? { pageSlug: body['pagina'] } : {}),
    chrome: embedChromeOf(typeof body['cromo'] === 'string' ? body['cromo'] : undefined),
    filters: filtros,
    createdBy: sesion.userId,
  });

  return NextResponse.json({ codigo });
}

export async function DELETE(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  if ((await roleMoreHeightOf(sesion.userId)) !== 'administrador') {
    return NextResponse.json({ error: 'No tiene permiso.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const code = body['codigo'];
  if (typeof code !== 'string') {
    return NextResponse.json({ error: 'Falta el codigo.' }, { status: 400 });
  }

  const revocado = await embedRevoke({
    code,
    actorId: sesion.userId,
    ...(typeof body['motivo'] === 'string' ? { reason: body['motivo'] } : {}),
  });
  if (!revocado) return NextResponse.json({ error: 'Codigo no encontrado.' }, { status: 404 });

  return NextResponse.json({ codigo: revocado });
}
