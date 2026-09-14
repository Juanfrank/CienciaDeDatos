import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { readPersonalization } from '../../../../src/server/personalization';
import { cargarModulo } from '../../../../src/server/data';
import { actorDe, moduloServiblePorSlug } from '../../../../src/server/cicloDeVida';
import { serializarObjeto } from '../../../../src/server/serializar';
import { exigirSesionDePagina } from '../../../../src/server/session';
import { ModuleView } from '../../../../src/components/ModuleView';
import { ScopeBadge } from '../../../../src/components/ScopeBadge';
import { ProvenanceBadge } from '../../../../src/components/ProvenanceBadge';

/** Pagina de un modulo — ruta /m/{module-slug}[/{page-slug}] (4.11). */

/** Convierte la query string en filtros, conservando los valores repetidos de un mismo campo. */
function filtersOf(searchParams: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
  const salida: Record<string, string | string[]> = {};
  for (const [clave, valor] of Object.entries(searchParams)) {
    if (valor === undefined) continue;
    salida[clave] = valor;
  }
  return salida;
}

export default async function PaginaModulo({
  params,
  searchParams,
}: {
  /*
   * `page` es UNA cadena, no un array.
   */
  params: Promise<{ slug: string; page?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, page } = await params;
  const query = await searchParams;

  const sesion = await exigirSesionDePagina();

  const module = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!module) notFound();
  const cargado = await cargarModulo({
    module,
    personalization: await readPersonalization(sesion.userId, module.moduleId),
    ...(page ? { pageSlug: page } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtersOf(query),
  });

  if (!cargado) notFound();

  // Se distingue lo que la persona ELIGIO de lo que su AMBITO le impone. Mezclarlos en una sola
  // linea de "filtros aplicados" hace creer que el ambito es algo que uno se puso y se puede
  // quitar, cuando no lo es.
  const chosenFilters = Object.entries(filtersOf(query)).map(
    ([fieldName, valor]) => [fieldName, Array.isArray(valor) ? valor : [valor]] as const,
  );
  const chosenFields = new Set(chosenFilters.map(([fieldName]) => fieldName));
  const restriccionesDeAmbito = Object.entries(cargado.appliedFilters).filter(
    ([fieldName, valores]) => !chosenFields.has(fieldName) && valores.length > 0,
  );

  return (
    <article className="modulo">
      <header className="module__header">
        <h1 data-testid="module-title">{module.name}</h1>
        <p className="muted-text" data-testid="frescura">
          {cargado.generatedAt
            ? `Datos actualizados el ${new Date(cargado.generatedAt).toLocaleString('es-DO')}`
            : 'Sin datos poblados todavia'}
          {cargado.degraded ? ' — sirviendo el ultimo dato valido conocido' : ''}
        </p>

      </header>

      {chosenFilters.length > 0 ? (
        <p className="filtros-activos" data-testid="filtros-activos">
          Filtros aplicados:{' '}
          {chosenFilters.map(([fieldName, valores]) => `${fieldName} = ${valores.join(', ')}`).join(' · ')}
        </p>
      ) : null}

      <ModuleView
        objetos={cargado.objetos.map(serializarObjeto)}
        provenance={describeProvenance(cargado.isPersonalized)}
        insignias={
          <>
            <ProvenanceBadge provenance={describeProvenance(cargado.isPersonalized)} />
            <ScopeBadge restricciones={restriccionesDeAmbito} />
          </>
        }
        moduleSlug={module.slug}
        pageSlug={cargado.pageSlug}
      />
    </article>
  );
}
