import Link from 'next/link';
import { defaultIdentity } from '@app/design-tokens';
import { can } from '@app/access-control';
import { isAdministrator, roleMoreHeightOf } from '../server/admin';
import type { ShellSession } from '../server/session';
import { ToggleSidebar } from './ToggleSidebar';
import { listUsers } from '../server/context';
import { AccountMenu, type AccountEntry } from './AccountMenu';
import { translator } from '../server/locale';

/** Cromo de cabecera de la aplicacion. */
export async function Header({ sesion }: { sesion: ShellSession }) {
  const t = await translator();

  // El enlace solo se dibuja para quien puede usarlo. Ocultarlo no protege nada —eso lo hace el
  // guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
  const manageCan = await isAdministrator(sesion.userId);
  // El nombre y el correo salen del directorio de gobierno, no de las credenciales: la misma
  // persona entra hoy con contrasena local y manana con Azure AD, y se sigue llamando igual.
  const perfil = (await listUsers()).find((u) => u.userId === sesion.userId);
  const editCan = can(await roleMoreHeightOf(sesion.userId), 'crear-editar-modulos-borrador');

  const entradas: AccountEntry[] = [
    {
      href: '/notices',
      label: t('chrome.notices'),
      icono: 'notice',
      prueba: 'link-avisos',
      cuentaAvisos: true,
    },
    /*
     * El editor NO tiene entrada propia aqui.
     *
     * Crear y editar modulos se hace desde el panel, en la tabla de modulos: el boton de crear y el
     * lapiz de cada fila. Dos puertas al mismo sitio —una en este menu y otra en la tabla— obligan a
     * elegir cual es la buena, y la de la tabla es la que ademas ensena el estado de cada modulo,
     * quien lo tiene a su cargo y que se puede hacer con el.
     *
     * Por eso el panel admite ahora a quien puede crear borradores, aunque solo le ensene esa
     * seccion: sin eso, quitar esta entrada habria dejado a un Colaborador con el permiso y sin
     * ninguna pantalla donde usarlo.
     */
    ...(editCan || manageCan
      ? [
          {
            href: manageCan ? '/admin' : '/admin/modules',
            label: manageCan ? t('chrome.admin') : t('chrome.editor'),
            icono: manageCan ? ('llave' as const) : ('content' as const),
            prueba: 'link-admin',
          } as const,
        ]
      : []),
  ];

  return (
    <header className="cabecera">
      <div className="header__mark">
        <ToggleSidebar />
        {/*
          El emblema es DECORATIVO y por eso lleva alt vacio: el nombre de la institucion esta
          justo al lado como texto, y darle tambien un texto alternativo haria que un lector de
          pantalla anunciara dos veces lo mismo.
        */}
        <img
          className="header__emblema"
          src={defaultIdentity.emblem.src}
          width={defaultIdentity.emblem.width}
          height={defaultIdentity.emblem.height}
          alt=""
        />
        {/*
          El nombre de la aplicacion manda y la institucion lo respalda: eso es una firma
          institucional, y por eso van en ese orden y con pesos distintos. El equipo activo NO
          esta aqui —cambia de una persona a otra y de un momento a otro— sino en el arbol de
          navegacion, que es lo que de verdad acota.
        */}
        <div className="header__texts">
          <span className="header__eyebrow" data-testid="institucion">
            {defaultIdentity.name}
          </span>
          <Link href="/" className="header__title">
            {t('app.name')}
          </Link>
        </div>
      </div>

      <div className="header__actions">
        {/*
          Todo lo que no es navegar por los datos vive en el menu de la cuenta.
          La cabecera tenia cuatro controles compitiendo con el arbol y con el titulo del modulo;
          lo que una persona hace aqui cien veces es mirar datos, y una vez al dia entrar al
          editor o a administracion.

          Cada entrada sigue dibujandose solo para quien puede usarla. Ocultarla no protege nada
          —eso lo hace el guardian del backend— pero no tiene sentido ofrecer una puerta cerrada.
        */}
        <AccountMenu
          user={sesion.userId}
          {...(perfil?.displayName ? { displayName: perfil.displayName } : {})}
          {...(perfil?.mail ? { mail: perfil.mail } : {})}
          entries={entradas}
        />
      </div>
    </header>
  );
}
