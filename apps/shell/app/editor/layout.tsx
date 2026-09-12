import Link from 'next/link';
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
 */
export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await exigirSesionDePagina();
  const actor = await actorDe(sesion);

  if (!can(actor.role, 'crear-editar-modulos-borrador')) {
    redirect('/editor-sin-permiso');
  }

  return (
    <div className="admin">
      <header className="admin__cabecera">
        <div>
          <h1>Editor de modulos</h1>
          <p className="texto-atenuado">
            Objetos prediseñados enlazados a datasets certificados, nunca a una consulta escrita a
            mano
          </p>
        </div>
        <Link href="/" className="boton-contorno" data-testid="volver-a-modulos">
          Volver a los modulos
        </Link>
      </header>
      <main className="editor__cuerpo">{children}</main>
    </div>
  );
}
