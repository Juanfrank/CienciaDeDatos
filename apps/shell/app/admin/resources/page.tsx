import Link from 'next/link';
import { sectionOf } from '../../../src/components/admin/sections';
import { Icon } from '../../../src/components/icons/Icon';
import { iconRows, resourcesOf } from '../../../src/server/recursos';
import { listProposals } from '../../../src/server/catalogo';
import { translator } from '../../../src/server/locale';
import { paginaDeAdmin } from '../../../src/server/admin';

export const dynamic = 'force-dynamic';

/**
 * La portada de Recursos, en TABLA.
 *
 * Tenia un indice de tarjetas que repetia el carril de la izquierda palabra por palabra, y al
 * quitarlo la pantalla se quedo con un titulo y nada debajo: un enlace del menu que no lleva a
 * ningun sitio. Lo que la portada de una seccion con hijas puede decir y el carril no es CUANTO
 * hay en cada una y que espera decision — y eso es una tabla, no cinco fichas.
 *
 * Los numeros salen de la misma fuente que cada pantalla hija, no de un contador aparte: dos
 * caminos para el mismo dato terminan discrepando, y el que se ve primero es el que engana.
 */
export default async function RecursosPage() {
  // Quien puede ver ESTA pagina, dicho aqui y no heredado del layout.
  await paginaDeAdmin();

  const seccion = sectionOf('/admin/resources');
  const [t, propuestas, visualizaciones, elementos, contenedores, complementos, iconos] =
    await Promise.all([
      translator(),
      listProposals(),
      resourcesOf('visualizaciones'),
      resourcesOf('elementos'),
      resourcesOf('contenedores'),
      resourcesOf('complementos'),
      iconRows(),
    ]);

  const pendientes = propuestas.filter((p) => p.status === 'pendiente').length;

  /*
   * El ORDEN sale del carril, no de una lista escrita aqui.
   *
   * Escribirlo dos veces es la forma segura de que el dia que se mueva una entrada del submenu la
   * tabla siga en el orden viejo, y las dos pantallas digan cosas distintas sobre lo mismo. Lo
   * que si vive aqui es CUANTOS hay de cada cosa, que es lo unico que el carril no sabe.
   */
  const cuantos: Record<string, number> = {
    '/admin/resources/proposals': propuestas.length,
    '/admin/resources/visualizations': visualizaciones.length,
    '/admin/resources/elements': elementos.length,
    '/admin/resources/containers': contenedores.length,
    '/admin/resources/addons': complementos.length,
    '/admin/resources/other': iconos.length,
  };

  const filas = (seccion?.hijas ?? []).map((hija) => ({
    href: hija.href,
    seccion: hija,
    cuantos: cuantos[hija.href] ?? 0,
    // Lo unico accionable de la lista se dice aparte, porque es lo que decide si hay que entrar.
    pendiente: hija.href === '/admin/resources/proposals' ? pendientes : 0,
  }));

  return (
    <section>
      <h2>{t('admin.resources.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>

      <table className="tabla" data-testid="tabla-familias">
        <thead>
          <tr>
            <th scope="col">{t('admin.resources.family')}</th>
            <th scope="col">{t('admin.resources.contains')}</th>
            <th scope="col">{t('admin.resources.howMany')}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.href} data-testid={`familia-${f.href.split('/').pop()}`}>
              <td>
                <Link href={f.href}>
                  {f.seccion?.icono ? (
                    <Icon nombre={f.seccion.icono} tamano={16} />
                  ) : null}{' '}
                  {f.seccion?.label}
                </Link>
              </td>
              <td className="muted-text">{f.seccion?.desc}</td>
              <td>
                {f.cuantos}
                {f.pendiente > 0 ? (
                  <>
                    {' '}
                    <span className="insignia" data-testid="familia-pendientes">
                      {t('admin.resources.awaiting', { n: f.pendiente })}
                    </span>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
