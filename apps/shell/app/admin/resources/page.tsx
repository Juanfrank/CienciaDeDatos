import Link from 'next/link';
import { sectionOf } from '../../../src/components/admin/sections';
import { Icon } from '../../../src/components/icons/Icon';
import { iconRows, resourcesOf } from '../../../src/server/recursos';
import { listProposals } from '../../../src/server/catalogo';
import { translator } from '../../../src/server/locale';

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

  const filas = [
    {
      href: '/admin/resources/proposals',
      cuantos: propuestas.length,
      // Lo unico accionable de la lista se dice aparte, porque es lo que decide si hay que entrar.
      pendiente: pendientes,
    },
    { href: '/admin/resources/visualizations', cuantos: visualizaciones.length, pendiente: 0 },
    { href: '/admin/resources/elements', cuantos: elementos.length, pendiente: 0 },
    { href: '/admin/resources/containers', cuantos: contenedores.length, pendiente: 0 },
    { href: '/admin/resources/addons', cuantos: complementos.length, pendiente: 0 },
    { href: '/admin/resources/other', cuantos: iconos.length, pendiente: 0 },
  ].map((f) => ({ ...f, seccion: sectionOf(f.href) }));

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
                    <span className="chip" data-testid="familia-pendientes">
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
