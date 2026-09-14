import { NextResponse } from 'next/server';
import type { AlertOperator, AlertRule } from '@app/alerts';
import { alertStore } from '../../../src/server/alerts';
import { filtersNormalize } from '../../../src/server/filters';
import { actorDe, slugServableModule } from '../../../src/server/cicloDeVida';
import { withoutSession } from '../../../src/server/respuestas';
import { sessionGet } from '../../../src/server/session';

export const runtime = 'nodejs';

const OPERADORES: AlertOperator[] = ['mayor-que', 'menor-que', 'cambia-mas-de'];

/** Reglas de alerta (4.9). */
export async function GET() {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();
  const rules = await alertStore.listRules();

  // Solo las propias. Una regla ajena revelaria que modulo vigila alguien y con que umbral.
  const mias = rules.filter((r) => r.ownerUserId === sesion.userId);

  const states = await Promise.all(mias.map((r) => alertStore.getState(r.id)));
  return NextResponse.json({
    alertas: mias.map((r, i) => ({ ...r, estado: states[i] ?? null })),
  });
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

  const module = await slugServableModule(moduleSlug, await actorDe(sesion));
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

  const colorRule: AlertRule = {
    id: crypto.randomUUID(),
    name: nombre,
    ownerUserId: sesion.userId,
    teamId: sesion.activeTeamId,
    moduleSlug: module.slug,
    ...(page && page.slug !== module.pages[0]?.slug ? { pageSlug: page.slug } : {}),
    instanceId,
    measure,
    condition: { operator, threshold },
    filters: filtersNormalize(body['filtros']),
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  await alertStore.saveRule(colorRule);
  return NextResponse.json({ alerta: colorRule }, { status: 201 });
}

export async function DELETE(request: Request) {
  const sesion = await sessionGet();
  if (!sesion) return withoutSession();

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta el id.' }, { status: 400 });

  // La comprobacion de propiedad la hace el almacen. Una regla ajena responde 404 y no 403:
  // decir "prohibido" confirmaria que ese identificador existe.
  const borrada = await alertStore.deleteRule(id, sesion.userId);
  if (!borrada) return NextResponse.json({ error: 'Alerta no encontrada.' }, { status: 404 });

  return NextResponse.json({ borrada: id });
}
