import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { cargarModulo } from '../../../src/server/datos';
import { findModuleBySlug } from '../../../src/server/modulos';
import { serializarObjeto } from '../../../src/server/serializar';
import { obtenerSesion } from '../../../src/server/sesion';
import { VistaModulo } from '../../../src/components/VistaModulo';

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

  const module = findModuleBySlug(slug);
  if (!module) notFound();

  const sesion = await obtenerSesion();
  const cargado = await cargarModulo({
    module,
    ...(page?.[0] ? { pageSlug: page[0] } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtrosDe(query),
  });

  if (!cargado) notFound();

  const filtrosActivos = Object.entries(cargado.appliedFilters).filter(([, v]) => v.length > 0);

  return (
    <article className="modulo">
      <header className="modulo__cabecera">
        <div>
          <h1 data-testid="titulo-modulo">{module.name}</h1>
          <p className="texto-atenuado" data-testid="frescura">
            {cargado.generatedAt
              ? `Datos actualizados el ${new Date(cargado.generatedAt).toLocaleString('es-DO')}`
              : 'Sin datos poblados todavia'}
            {cargado.degraded ? ' — sirviendo el ultimo dato valido conocido' : ''}
          </p>
        </div>
      </header>

      {filtrosActivos.length > 0 ? (
        <p className="filtros-activos" data-testid="filtros-activos">
          Filtros aplicados:{' '}
          {filtrosActivos.map(([campo, valores]) => `${campo} = ${valores.join(', ')}`).join(' · ')}
        </p>
      ) : null}

      <VistaModulo
        objetos={cargado.objetos.map(serializarObjeto)}
        provenance={describeProvenance(false)}
      />
    </article>
  );
}
