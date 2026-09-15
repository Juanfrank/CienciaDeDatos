import { notFound } from 'next/navigation';
import { can } from '@app/access-control';
import { describeProvenance } from '@app/module-model';
import { attachmentKeyIs } from '@app/ui-components';
import { readPersonalization } from '../../../../src/server/personalization';
import { moduleLoad } from '../../../../src/server/data';
import { actorDe, slugServableModule } from '../../../../src/server/cicloDeVida';
import { objectSerialize } from '../../../../src/server/serialize';
import { pageSessionRequire } from '../../../../src/server/session';
import { ModuleView } from '../../../../src/components/ModuleView';
import { translator } from '../../../../src/server/locale';
import { PageNavigator } from '../../../../src/components/PageNavigator';
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

  const [sesion, t] = await Promise.all([pageSessionRequire(), translator()]);

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
  const chosenFilters = Object.entries(filtrosPedidos)
    // Lo que acota UN objeto no se recita aqui: la pagina no esta filtrada por ello, y ensenar
    // «f.comp-tabla = Q1» en la linea del modulo hace leer el recorte de una tarjeta como si
    // acotara todo lo demas. Cada objeto lo dice en su sitio, con su icono marcado.
    .filter(([clave]) => !attachmentKeyIs(clave))
    .map(([fieldName, valor]) => [fieldName, Array.isArray(valor) ? valor : [valor]] as const);
  const chosenFields = new Set(chosenFilters.map(([fieldName]) => fieldName));
  const scopeRestrictions = Object.entries(loaded.appliedFilters).filter(
    ([fieldName, valores]) => !chosenFields.has(fieldName) && valores.length > 0,
  );

  /*
   * El navegador envuelve la pagina; no es un objeto de dentro.
   *
   * Y solo aparece con mas de una pagina: con una sola no hay a donde ir, y un panel lateral de
   * una entrada roba ancho para no llevar a ningun lado. Con mas de una es obligatorio, y eso lo
   * hace cumplir la puerta de publicacion — aqui no hace falta un caso para «falta»: un modulo
   * publicado sin el no existe.
   */
  const navegador = module.pages.length > 1 ? module.navigator : undefined;
  const filtrosDelPanel =
    loaded.navigatorFilters?.result && loaded.navigatorFilters.item
      ? {
          instance: loaded.navigatorFilters.item.instance,
          result: loaded.navigatorFilters.result,
          titulo: module.navigator?.filtros?.etiqueta ?? t('nav.filters'),
        }
      : undefined;

  /*
   * A que pantallas de gestion de ESTE modulo puede llegar quien lo esta mirando.
   *
   * Se resuelve en el servidor, con el rol de verdad, y solo se envia lo concedido: el cliente no
   * decide que puede administrar. Y aun asi ninguna de las tres depende de esto para protegerse
   * —`/admin/*` redirige a quien no sea Administrador y `/editor/*` exige ser el autor—, porque
   * esconder un enlace no es proteger una ruta.
   */
  const actor = await actorDe(sesion);
  const administracion: { editar?: string; configuracion?: string; permisos?: string } = {
    ...(can(actor.role, 'crear-editar-modulos-borrador')
      ? { editar: `/editor/${module.slug}` }
      : {}),
    ...(actor.role === 'administrador'
      ? {
          configuracion: `/admin/modules/${module.slug}/settings`,
          permisos: `/admin/modules/${module.slug}/permissions`,
        }
      : {}),
  };

  const contenido = (
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
        {...(Object.keys(administracion).length > 0 ? { administracion } : {})}
      />
    </article>
  );

  if (!navegador) return contenido;

  return (
    <div className="con-navegador" data-tipo={navegador.tipo}>
      <PageNavigator
        navegador={navegador}
        paginas={module.pages.map((p) => ({
          slug: p.slug,
          name: p.name,
          ...(p.icon ? { icon: p.icon } : {}),
        }))}
        moduleSlug={module.slug}
        actual={loaded.pageSlug}
        {...(filtrosDelPanel ? { filtros: filtrosDelPanel } : {})}
      />
      {contenido}
    </div>
  );
}
