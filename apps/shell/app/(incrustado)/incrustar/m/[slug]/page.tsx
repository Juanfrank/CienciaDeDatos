import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { cargarModulo } from '../../../../../src/server/data';
import { actorDe, moduloServiblePorSlug } from '../../../../../src/server/cicloDeVida';
import { serializarObjeto } from '../../../../../src/server/serializar';
import { obtenerSesion } from '../../../../../src/server/session';
import { VistaModulo } from '../../../../../src/components/VistaModulo';

/** Modulo incrustado en otro portal — seccion 4.9. */
export default async function PaginaIncrustada({
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
  const sesion = await obtenerSesion();
  if (!sesion) {
    return (
      <div className="vacio">
        <h1>Se requiere iniciar sesion</h1>
        <p className="texto-atenuado" data-testid="incrustado-sin-sesion">
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
  const module = await moduloServiblePorSlug(slug, await actorDe(sesion));
  if (!module) notFound();

  const cargado = await cargarModulo({
    module,
    ...(typeof query['pagina'] === 'string' ? { pageSlug: query['pagina'] } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtros,
  });

  if (!cargado) notFound();

  return (
    <article className="modulo">
      <header className="modulo__cabecera">
        <h1 data-testid="titulo-modulo">{module.name}</h1>
        <p className="texto-atenuado" data-testid="frescura">
          {cargado.generatedAt
            ? `Datos actualizados el ${new Date(cargado.generatedAt).toLocaleString('es-DO')}`
            : 'Sin datos poblados todavia'}
        </p>
      </header>

      <VistaModulo
        objetos={cargado.objetos.map(serializarObjeto)}
        provenance={describeProvenance(false)}
        moduleSlug={module.slug}
        pageSlug={cargado.pageSlug}
        incrustado
      />

      {/*
        Un enlace de vuelta, en pestana nueva: dentro de un iframe, navegar en el mismo marco
        dejaria la aplicacion entera metida en un hueco de 640 pixeles del portal anfitrion.
      */}
      <p className="incrustado__pie">
        <Link href={`/m/${module.slug}`} target="_blank" rel="noopener" data-testid="ver-completo">
          Ver en la capa de visualizacion
        </Link>
      </p>
    </article>
  );
}
