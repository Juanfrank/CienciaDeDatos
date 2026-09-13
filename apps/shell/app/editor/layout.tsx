import { redirect } from 'next/navigation';
import { can } from '@app/access-control';
import { actorDe } from '../../src/server/cicloDeVida';
import { exigirSesionDePagina } from '../../src/server/session';

/** Editor de modulos — seccion 4.2. */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);

  if (!can(actor.role, 'crear-editar-modulos-borrador')) {
    redirect('/editor-sin-permiso');
  }

  return <div className="admin">{children}</div>;
}
