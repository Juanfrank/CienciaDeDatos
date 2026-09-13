import { redirect } from 'next/navigation';
import { can } from '@app/access-control';
import { actorDe } from '../../src/server/cicloDeVida';
import { exigirSesionDePagina } from '../../src/server/sesion';

/**
 * Editor de modulos — seccion 4.2.
 *
 * Superficie propia, separada tanto de los modulos de negocio como del panel de administracion:
 * construir un modulo no es verlo, y tampoco es administrar la institucion. Un Colaborador entra
 * aqui y no en /admin.
 *
 * Como en el panel, la comprobacion se hace aqui Y en cada handler de la API. Esta evita dibujar
 * la pantalla; la otra evita que sirva de algo saltarsela.
 *
 * El layout ya NO dibuja la cabecera. La pagina del editor de un modulo monta dos columnas —el
 * taller y el carril de objetos— y la cabecera va dentro de la izquierda: encabeza lo que se esta
 * construyendo, no el panel. Dibujarla aqui la habria dejado por encima de las dos, y entonces el
 * carril no podria llegar hasta debajo del banner.
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);

  if (!can(actor.role, 'crear-editar-modulos-borrador')) {
    redirect('/editor-sin-permiso');
  }

  return <div className="admin">{children}</div>;
}
