import Link from 'next/link';
import { notFound } from 'next/navigation';
import { describeProvenance } from '@app/module-model';
import { cargarModulo } from '../../../../../src/server/datos';
import { findModuleBySlug } from '../../../../../src/server/modulos';
import { serializarObjeto } from '../../../../../src/server/serializar';
import { obtenerSesion } from '../../../../../src/server/sesion';
import { VistaModulo } from '../../../../../src/components/VistaModulo';

/**
 * Modulo incrustado en otro portal — seccion 4.9.
 *
 * Es la MISMA carga que la pagina normal, con la misma sesion y el mismo ambito: `cargarModulo`
 * resuelve el ambito de quien mira y devuelve datos ya filtrados. No hay aqui ninguna via
 * alternativa de lectura, ni un token que salte la autenticacion — una vista incrustada no es
 * una vista publica.
 *
 * Si quien abre el portal anfitrion no tiene sesion en esta aplicacion, el iframe no muestra
 * datos. Es el comportamiento correcto, no un fallo de la incrustacion.
 */
export default async function PaginaIncrustada({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;

  const module = findModuleBySlug(slug);
  if (!module) notFound();

  const filtros: Record<string, string | string[]> = {};
  for (const [clave, valor] of Object.entries(query)) {
    if (valor !== undefined) filtros[clave] = valor;
  }

  const sesion = await obtenerSesion();
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
