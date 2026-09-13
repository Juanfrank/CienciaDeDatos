import { NextResponse } from 'next/server';
import type { AlertOperator, AlertRule } from '@app/alerts';
import { alertStore } from '../../../src/server/alertas';
import { normalizarFiltros } from '../../../src/server/filtros';
import { actorDe, moduloServiblePorSlug } from '../../../src/server/cicloDeVida';
import { sinSesion } from '../../../src/server/respuestas';
import { obtenerSesion } from '../../../src/server/sesion';

export const runtime = 'nodejs';

const OPERADORES: AlertOperator[] = ['mayor-que', 'menor-que', 'cambia-mas-de'];

/** Reglas de alerta (4.9). */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();
  const reglas = await alertStore.listRules();

  // Solo las propias. Una regla ajena revelaria que modulo vigila alguien y con que umbral.
  const mias = reglas.filter((r) => r.ownerUserId === sesion.userId);

  const estados = await Promise.all(mias.map((r) => alertStore.getState(r.id)));
  return NextResponse.json({
    alertas: mias.map((r, i) => ({ ...r, estado: estados[i] ?? null })),
  });
}

export async function POST(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido.' }, { status: 400 });
  }

  const nombre = typeof body['nombre'] === 'string' ? body['nombre'].trim() : '';
  const moduleSlug = typeof body['modulo'] === 'string' ? body['modulo'] : '';
  const instanceId = typeof body['objeto'] === 'string' ? body['objeto'] : '';
  const measure = typeof body['medida'] === 'string' ? body['medida'] : '';
  const operator = body['operador'] as AlertOperator;
  const threshold = Number(body['umbral']);

  if (!nombre) return NextResponse.json({ error: 'Falta el nombre.' }, { status: 400 });
  if (!OPERADORES.includes(operator)) {
    return NextResponse.json(
      { error: `Operador no admitido. Use uno de: ${OPERADORES.join(', ')}.` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(threshold)) {
    return NextResponse.json({ error: 'El umbral debe ser un numero.' }, { status: 400 });
  }

  const module = await moduloServiblePorSlug(moduleSlug, await actorDe(sesion));
  if (!module) return NextResponse.json({ error: 'Modulo no encontrado.' }, { status: 404 });

  // El objeto y la medida se validan contra la definicion del modulo, no se aceptan a ciegas:
  // una regla sobre una medida inexistente nunca dispararia y nadie sabria por que.
  const page = module.pages.find((p) => p.items.some((i) => i.instance.instanceId === instanceId));
  const item = page?.items.find((i) => i.instance.instanceId === instanceId);
  if (!item) {
    return NextResponse.json({ error: 'El objeto no existe en ese modulo.' }, { status: 400 });
  }
  if (!item.instance.binding.measures.includes(measure)) {
    return NextResponse.json(
      { error: `El objeto no mapea la medida '${measure}'.` },
      { status: 400 },
    );
  }

  const regla: AlertRule = {
    id: crypto.randomUUID(),
    name: nombre,
    ownerUserId: sesion.userId,
    teamId: sesion.activeTeamId,
    moduleSlug: module.slug,
    ...(page && page.slug !== module.pages[0]?.slug ? { pageSlug: page.slug } : {}),
    instanceId,
    measure,
    condition: { operator, threshold },
    filters: normalizarFiltros(body['filtros']),
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  await alertStore.saveRule(regla);
  return NextResponse.json({ alerta: regla }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await obtenerSesion();
  if (!sesion) return sinSesion();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  // La comprobacion de propiedad la hace el almacen. Una regla ajena responde 404 y no 403:
  // decir "prohibido" confirmaria que ese identificador existe.
  const borrada = await alertStore.deleteRule(id, sesion.userId);
  if (!borrada) return NextResponse.json({ error: 'Alerta no encontrada.' }, { status: 404 });

  return NextResponse.json({ borrada: id });
}
