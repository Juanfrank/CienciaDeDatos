import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { moduleLoad } from '../../../../../src/server/data';
import { actorDe, slugServableModule } from '../../../../../src/server/cicloDeVida';
import { objectSerialize } from '../../../../../src/server/serialize';
import { sessionGet } from '../../../../../src/server/session';
import { ModuleView } from '../../../../../src/components/ModuleView';

/** Modulo incrustado en otro portal — seccion 4.9. */
export default async function EmbeddedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const filtros: Record<string, string | string[]> = {};
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined) filtros[clave] = valor;
  }

  // Sin sesion NO se redirige a la pantalla de acceso. Esta pagina se sirve dentro de un iframe
  // de otro portal: un formulario de contrasena dibujado ahi dentro es indistinguible de uno
  // falso incrustado por el anfitrion, y ensena a la gente a escribir su clave dentro de un marco
  // ajeno. Se dice que hace falta entrar, con un enlace que abre la aplicacion en otra pestana.
  const sesion = await sessionGet();
  if (!sesion) {
    return (
      <div className="vacio">
        <h1>Se requiere iniciar sesion</h1>
        <p className="muted-text" data-testid="embedded-without-session">
          Esta vista muestra datos institucionales y necesita una sesion abierta en la capa de
          visualizacion.
        </p>
        <a href="/acceso" target="_blank" rel="noopener noreferrer" className="boton-enlace">
          Abrir la aplicacion
        </a>
      </div>
    );
  }

  // Se resuelve DESPUES de la sesion, y filtrando por estado: incrustar no puede ser el atajo
  // que sirva un borrador ajeno.
  const module = await slugServableModule(slug, await actorDe(sesion));
  if (!module) notFound();

  const loaded = await moduleLoad({
    module,
    ...(typeof query['pagina'] === 'string' ? { pageSlug: query['pagina'] } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtros,
  });

  if (!loaded) notFound();

  return (
    <article className="modulo">
      <header className="module__header">
        <h1 data-testid="module-title">{module.name}</h1>
        <p className="muted-text" data-testid="frescura">
          {loaded.generatedAt
            ? `Datos actualizados el ${new Date(loaded.generatedAt).toLocaleString('es-DO')}`
            : 'Sin datos poblados todavia'}
        </p>
      </header>

      <ModuleView
        objetos={loaded.objetos.map(objectSerialize)}
        provenance={describeProvenance(false)}
        moduleSlug={module.slug}
        pageSlug={loaded.pageSlug}
        embedded
      />

      {/*
        Un enlace de vuelta, en pestana nueva: dentro de un iframe, navegar en el mismo marco
        dejaria la aplicacion entera metida en un hueco de 640 pixeles del portal anfitrion.
      */}
      <p className="embedded__pie">
        <Link href={`/m/${module.slug}`} target="_blank" rel="noopener" data-testid="see-completo">
          Ver en la capa de visualizacion
        </Link>
      </p>
    </article>
  );
}
