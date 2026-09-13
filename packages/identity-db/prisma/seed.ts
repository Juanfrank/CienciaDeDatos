/** Siembra del entorno de staging. */
import {
  seedGrantedNodes,
  seedMemberships,
  seedNavNodes,
  seedRestrictions,
  seedScopes,
  seedTeams,
  seedUsers,
} from '../src/seedData';

/* eslint-disable @typescript-eslint/no-explicit-any */

async function main(): Promise<void> {
  // El cliente se importa de forma diferida para que este archivo no obligue a tener
  // @prisma/client instalado en quien solo consume los mapeadores.
  const { PrismaClient } = (await import('@prisma/client' as string)) as any;
  const prisma = new PrismaClient();

  try {
    for (const scope of seedScopes) {
      await prisma.accessScope.upsert({ where: { id: scope.id }, update: {}, create: { id: scope.id } });
    }

    for (const r of seedRestrictions) {
      await prisma.scopeRestriction.upsert({
        where: { scopeId_dimTable_dimField: { scopeId: r.scopeId, dimTable: r.dimTable, dimField: r.dimField } },
        update: { allowedValues: r.allowedValues },
        create: r,
      });
    }

    // Las carpetas antes que los modulos: un hijo no puede insertarse sin su padre.
    const porProfundidad = [...seedNavNodes].sort(
      (a, b) => (a.parentId === null ? 0 : 1) - (b.parentId === null ? 0 : 1),
    );
    for (const nodo of porProfundidad) {
      await prisma.navNode.upsert({
        where: { id: nodo.id },
        update: { name: nodo.name, orderIndex: nodo.orderIndex, scopeId: nodo.scopeId },
        create: nodo,
      });
    }

    for (const user of seedUsers) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          displayName: user.id,
          userPrincipalName: `${user.id}@institucion.gob`,
          authProvider: 'azure-ad',
          combineTeamsByUnion: user.combineTeamsByUnion,
        },
      });
    }

    for (const team of seedTeams) {
      await prisma.team.upsert({
        where: { id: team.id },
        update: { name: team.name, defaultScopeId: team.defaultScopeId },
        create: team,
      });
    }

    for (const g of seedGrantedNodes) {
      await prisma.teamGrantedNode.upsert({
        where: { teamId_nodeId: { teamId: g.teamId, nodeId: g.nodeId } },
        update: {},
        create: g,
      });
    }

    for (const m of seedMemberships) {
      await prisma.teamMembership.upsert({
        where: { teamId_userId: { teamId: m.teamId, userId: m.userId } },
        update: { role: m.role },
        create: m,
      });
    }

    console.log(
      `Siembra completa: ${seedTeams.length} equipos, ${seedNavNodes.length} nodos, ${seedScopes.length} ambitos.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
