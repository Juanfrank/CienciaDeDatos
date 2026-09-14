import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { readPersonalization } from '../../../../src/server/personalization';
import { moduleLoad } from '../../../../src/server/data';
import { actorDe, slugServableModule } from '../../../../src/server/cicloDeVida';
import { objectSerialize } from '../../../../src/server/serialize';
import { pageSessionRequire } from '../../../../src/server/session';
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

  const sesion = await pageSessionRequire();

  const module = await slugServableModule(slug, await actorDe(sesion));
  if (!module) notFound();
  /*
   * Los filtros por defecto solo entran cuando NADIE pide otra cosa.
   *
   * Si se mezclaran con lo que trae la URL, quitar un filtro que viene por defecto seria
   * imposible: al quitarlo, la URL se queda sin ese campo y el valor por defecto lo devolveria.
   * Asi, en cuanto alguien toca un filtro, manda la URL entera.
   */
  const sinFiltros = Object.keys(query).length === 0;
  const porDefecto: Record<string, string | string[]> = Object.fromEntries(
    (module.defaultFilters ?? []).map((f) => [f.field, f.values]),
  );
  const filtrosPedidos = sinFiltros ? porDefecto : filtersOf(query);

  const loaded = await moduleLoad({
    module,
    personalization: await readPersonalization(sesion.userId, module.moduleId),
    ...(page ? { pageSlug: page } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtrosPedidos,
  });

  if (!loaded) notFound();

  // Se distingue lo que la persona ELIGIO de lo que su AMBITO le impone. Mezclarlos en una sola
  // linea de "filtros aplicados" hace creer que el ambito es algo que uno se puso y se puede
  // quitar, cuando no lo es.
  const chosenFilters = Object.entries(filtrosPedidos).map(
    ([fieldName, valor]) => [fieldName, Array.isArray(valor) ? valor : [valor]] as const,
  );
  const chosenFields = new Set(chosenFilters.map(([fieldName]) => fieldName));
  const scopeRestrictions = Object.entries(loaded.appliedFilters).filter(
    ([fieldName, valores]) => !chosenFields.has(fieldName) && valores.length > 0,
  );

  return (
    <article className="modulo">
      <header className="module__header">
        <h1 data-testid="module-title">{module.name}</h1>
        {module.description ? (
          <p className="module__descripcion" data-testid="module-descripcion">
            {module.description}
          </p>
        ) : null}
        <p className="muted-text" data-testid="frescura">
          {loaded.generatedAt
            ? `Datos actualizados el ${new Date(loaded.generatedAt).toLocaleString('es-DO')}`
            : 'Sin datos poblados todavia'}
          {loaded.degraded ? ' — sirviendo el ultimo dato valido conocido' : ''}
        </p>

      </header>

      {chosenFilters.length > 0 ? (
        <p className="filtros-activos" data-testid="filtros-activos">
          Filtros aplicados:{' '}
          {chosenFilters.map(([fieldName, valores]) => `${fieldName} = ${valores.join(', ')}`).join(' · ')}
        </p>
      ) : null}

      <ModuleView
        objetos={loaded.objetos.map(objectSerialize)}
        provenance={describeProvenance(loaded.isPersonalized)}
        insignias={
          <>
            <ProvenanceBadge provenance={describeProvenance(loaded.isPersonalized)} />
            <ScopeBadge restricciones={scopeRestrictions} />
          </>
        }
        moduleSlug={module.slug}
        pageSlug={loaded.pageSlug}
        {...(module.options ? { options: module.options } : {})}
      />
    </article>
  );
}
