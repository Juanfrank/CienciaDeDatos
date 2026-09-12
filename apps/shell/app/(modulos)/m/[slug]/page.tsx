import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { leerPersonalizacion } from '../../../../src/server/personalizacion';
import { cargarModulo } from '../../../../src/server/datos';
import { actorDe, moduloVisiblePorSlug } from '../../../../src/server/cicloDeVida';
import { serializarObjeto } from '../../../../src/server/serializar';
import { exigirSesionDePagina } from '../../../../src/server/sesion';
import { VistaModulo } from '../../../../src/components/VistaModulo';
import { InsigniaDeAmbito } from '../../../../src/components/InsigniaDeAmbito';
import { InsigniaDeProcedencia } from '../../../../src/components/InsigniaDeProcedencia';

/**
 * Pagina de un modulo — ruta /m/{module-slug}[/{page-slug}] (4.11).
 *
 * Componente de servidor: resuelve ambito, lee del cache y filtra ANTES de enviar nada al
 * navegador. Lo que cruza al cliente ya esta filtrado.
 */

/** Convierte la query string en filtros, conservando los valores repetidos de un mismo campo. */
function filtrosDe(searchParams: Record<string, string | string[] | undefined>): Record<string, string | string[]> {
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
  params: Promise<{ slug: string; page?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, page } = await params;
  const query = await searchParams;

  const sesion = await exigirSesionDePagina();

  const module = await moduloVisiblePorSlug(slug, await actorDe(sesion));
  if (!module) notFound();
  const cargado = await cargarModulo({
    module,
    personalization: await leerPersonalizacion(sesion.userId, module.moduleId),
    ...(page?.[0] ? { pageSlug: page[0] } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtrosDe(query),
  });

  if (!cargado) notFound();

  // Se distingue lo que la persona ELIGIO de lo que su AMBITO le impone. Mezclarlos en una sola
  // linea de "filtros aplicados" hace creer que el ambito es algo que uno se puso y se puede
  // quitar, cuando no lo es.
  const filtrosElegidos = Object.entries(filtrosDe(query)).map(
    ([campo, valor]) => [campo, Array.isArray(valor) ? valor : [valor]] as const,
  );
  const camposElegidos = new Set(filtrosElegidos.map(([campo]) => campo));
  const restriccionesDeAmbito = Object.entries(cargado.appliedFilters).filter(
    ([campo, valores]) => !camposElegidos.has(campo) && valores.length > 0,
  );

  return (
    <article className="modulo">
      <header className="modulo__cabecera">
        <h1 data-testid="titulo-modulo">{module.name}</h1>
        <p className="texto-atenuado" data-testid="frescura">
          {cargado.generatedAt
            ? `Datos actualizados el ${new Date(cargado.generatedAt).toLocaleString('es-DO')}`
            : 'Sin datos poblados todavia'}
          {cargado.degraded ? ' — sirviendo el ultimo dato valido conocido' : ''}
        </p>

      </header>

      {filtrosElegidos.length > 0 ? (
        <p className="filtros-activos" data-testid="filtros-activos">
          Filtros aplicados:{' '}
          {filtrosElegidos.map(([campo, valores]) => `${campo} = ${valores.join(', ')}`).join(' · ')}
        </p>
      ) : null}

      <VistaModulo
        objetos={cargado.objetos.map(serializarObjeto)}
        provenance={describeProvenance(cargado.isPersonalized)}
        insignias={
          <>
            <InsigniaDeProcedencia provenance={describeProvenance(cargado.isPersonalized)} />
            <InsigniaDeAmbito restricciones={restriccionesDeAmbito} />
          </>
        }
        moduleSlug={module.slug}
        pageSlug={cargado.pageSlug}
      />
    </article>
  );
}
