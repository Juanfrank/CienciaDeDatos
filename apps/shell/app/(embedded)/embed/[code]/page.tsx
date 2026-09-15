import Link from 'next/link';
import { notFound } from 'next/navigation';
import { defaultIdentity } from '@app/design-tokens';
import { describeProvenance } from '@app/module-model';
import { moduleLoad } from '../../../../src/server/data';
import { actorDe, slugServableModule } from '../../../../src/server/cicloDeVida';
import { embedFind } from '../../../../src/server/incrustaciones';
import { objectSerialize } from '../../../../src/server/serialize';
import { sessionGet } from '../../../../src/server/session';
import { findUser } from '../../../../src/server/context';
import { AZURE_AD_AVAILABLE } from '../../../../src/server/identity';
import { Login } from '../../../../src/components/Login';
import { initialsOf } from '../../../../src/components/initials';
import { ModuleView } from '../../../../src/components/ModuleView';
import { PageNavigator } from '../../../../src/components/PageNavigator';

/**
 * Modulo incrustado en otro portal, por su CODIGO — seccion 4.9.
 *
 * La URL no dice el modulo: dice el codigo. De el cuelgan el modulo, la pagina, el cromo y los
 * filtros con los que se genero, ademas de quien lo genero y cuando. Antes era `/embed/m/{slug}`
 * con los filtros en la query, es decir, una URL que cualquiera componia a mano y que despues no
 * respondia la pregunta que importa cuando un dato de la institucion aparece en la pagina de
 * otro: quien lo puso ahi.
 *
 * Y un codigo REVOCADO no responde 404. Sigue existiendo y lo dice: un 404 dentro del portal de
 * otra institucion se lee como que la aplicacion se cayo, y quien la mantiene no tiene por donde
 * empezar a preguntar.
 */
export default async function EmbeddedPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const query = await searchParams;
  const codigo = await embedFind(code);
  if (!codigo) notFound();

  if (codigo.revokedAt) {
    return (
      <main className="embedded__body">
        <p className="aviso notice-atencion" data-testid="embed-revocado">
          {codigo.reason
            ? `Este vinculo fue suprimido: ${codigo.reason}`
            : 'Este vinculo fue suprimido por la institucion y ya no muestra datos.'}
        </p>
      </main>
    );
  }

  const slug = codigo.moduleSlug;
  const cromo = codigo.chrome;
  const filtros: Record<string, string | string[]> = { ...codigo.filters };

  const sesion = await sessionGet();
  if (!sesion) {
    /*
     * Sin sesion se dibuja la PANTALLA DE ACCESO, aqui dentro.
     *
     * Antes se dibujaba un aviso con un enlace a otra pestana, por una razon que sigue siendo
     * cierta: un formulario de contrasena dentro de un marco ajeno es indistinguible de uno falso
     * que ponga el anfitrion, y acostumbra a la gente a escribir su clave dentro del marco de otro.
     *
     * Lo que lo hace aceptable es que el marco NO es de cualquiera: `frame-ancestors` solo deja
     * enmarcar a los origenes que un Administrador autorizo, asi que la superficie es la lista de
     * portales de la propia institucion, no la web entera. Aun asi se conserva la salida a una
     * pestana propia, y no solo por precaucion: un iframe de otro sitio muchas veces no puede
     * escribir la cookie de sesion —los navegadores bloquean la de terceros—, y sin esa salida
     * entrar aqui fallaria en silencio y sin explicacion.
     */
    const volverAqui = `/embed/${code}`;
    return (
      <main className="embedded__body">
        <Login azureAdAvailable={AZURE_AD_AVAILABLE} identity={defaultIdentity} destino={volverAqui} />
        <p className="embedded__pie" data-testid="embedded-without-session">
          <a href="/sign-in" target="_blank" rel="noopener noreferrer">
            Si no puede entrar aqui, abra la aplicacion en otra pestana
          </a>
        </p>
      </main>
    );
  }

  // Se resuelve DESPUES de la sesion, y filtrando por estado: incrustar no puede ser el atajo
  // que sirva un borrador ajeno.
  const module = await slugServableModule(slug, await actorDe(sesion));
  if (!module) notFound();

  /*
   * La pagina puede venir del codigo o del enlace del navegador, y el enlace manda.
   *
   * Moverse de una pagina a otra es moverse DENTRO de lo que se incrusto, asi que no hace falta
   * un codigo por pagina: el modulo y el cromo siguen siendo los del codigo, y lo unico que
   * cambia es cual de sus paginas se dibuja.
   */
  const pagina = typeof query['pagina'] === 'string' ? query['pagina'] : codigo.pageSlug;

  const loaded = await moduleLoad({
    module,
    ...(pagina ? { pageSlug: pagina } : {}),
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: filtros,
  });

  if (!loaded) notFound();

  const usuario = await findUser(sesion.userId);
  const quienMira = usuario?.displayName ?? sesion.userId;

  /*
   * Quien mira, con la MISMA estructura que en la cabecera de la aplicacion.
   *
   * Nombre, correo debajo y el avatar con sus iniciales, reusando `account__*` y `initialsOf` en
   * vez de escribir aqui otra version: la gente reconoce ese bloque, y una segunda forma de
   * dibujar la misma cosa acaba divergiendo —otro tamano, otras iniciales— sin que nadie lo decida.
   *
   * Lo que NO lleva es el desplegable: desde una vista incrustada no se cierra sesion ni se cambia
   * de equipo. Es una identidad, no un menu.
   */
  const identidad = (
    <span className="account account--estatico" data-testid="embedded-quien">
      <span className="account__identity">
        <span className="account__name">{quienMira}</span>
        {usuario?.mail ? <span className="account__mail">{usuario.mail}</span> : null}
      </span>
      <span className="account__avatar" aria-hidden="true">
        {initialsOf(quienMira)}
      </span>
    </span>
  );

  /*
   * El navegador SI entra en la vista incrustada, y no es una excepcion a «no se puede salir».
   *
   * Lo que no puede hacer una vista incrustada es llevarse a quien la mira a otra aplicacion; ir
   * de una pagina del modulo a otra es moverse DENTRO de lo que se incrusto. Sin el, incrustar un
   * modulo de once paginas ensenaria una y escondaria diez, que es el mismo agujero que el
   * navegador vino a cerrar.
   */
  const navegador = module.pages.length > 1 ? module.navigator : undefined;
  const filtrosDelPanel =
    loaded.navigatorFilters?.result && loaded.navigatorFilters.item
      ? {
          instance: loaded.navigatorFilters.item.instance,
          result: loaded.navigatorFilters.result,
          titulo: module.navigator?.filtros?.etiqueta ?? 'Filtros',
        }
      : undefined;

  return (
    <>
      {cromo === 'completo' ? (
        <header className="embedded__header">
          <img
            className="embedded__emblema"
            src={defaultIdentity.emblem.src}
            width={defaultIdentity.emblem.width}
            height={defaultIdentity.emblem.height}
            alt=""
          />
          <span className="embedded__institucion">{defaultIdentity.name}</span>
          <span className="embedded__quien">{identidad}</span>
        </header>
      ) : (
        /*
          Lo UNICO que sobrevive del encabezado: quien mira.
          No es adorno. Lo que se ve depende del ambito de quien tiene la sesion abierta, asi que
          una vista que no diga con que identidad esta dibujada invita a leerla como si fuera la de
          todo el mundo — y en una pantalla compartida, a leer los datos de otro como propios.
        */
        <p className="embedded__identidad">{identidad}</p>
      )}

      <main className="embedded__body">
        <div
          className={navegador ? 'con-navegador' : 'sin-navegador'}
          {...(navegador ? { 'data-tipo': navegador.tipo } : {})}
        >
        {navegador ? (
          <PageNavigator
            navegador={navegador}
            paginas={module.pages.map((p) => ({
              slug: p.slug,
              name: p.name,
              ...(p.icon ? { icon: p.icon } : {}),
            }))}
            moduleSlug={module.slug}
            actual={loaded.pageSlug}
            embedCode={code}
            {...(filtrosDelPanel ? { filtros: filtrosDelPanel } : {})}
          />
        ) : null}
        <article className="modulo">
          <header className="module__header">
            <h1 data-testid="module-title">{module.name}</h1>
            <p className="muted-text" data-testid="frescura">
              {loaded.generatedAt
                ? `Datos actualizados el ${new Date(loaded.generatedAt).toLocaleString('es-DO')}`
                : 'Sin datos poblados todavia'}
            </p>
          </header>

          {/*
            Sin `drillTargets`, y no por olvido.

            Un salto lleva a OTRO modulo, es decir, saca a quien lo pulsa de lo que se incrusto y lo
            mete en la aplicacion entera dentro de un hueco de 640 px. Es la misma razon por la que
            el enlace de salida solo existe en la version completa y abre en pestana nueva. Moverse
            entre paginas del modulo si se puede: eso es moverse DENTRO de lo incrustado.
          */}
          <ModuleView
            objetos={loaded.objetos.map(objectSerialize)}
            provenance={describeProvenance(false)}
            moduleSlug={module.slug}
            pageSlug={loaded.pageSlug}
            embedded
          />

          {/*
            La salida a la aplicacion existe SOLO en la version completa.
            La limpia se incrusta dentro de un sistema que ya es de la institucion, como una pieza
            mas de su pantalla: un enlace que se lleva a quien lo pulsa a otra aplicacion es
            justamente lo que quien la incrusta no quiere. En pestana nueva en cualquier caso —
            navegar en el mismo marco dejaria la aplicacion entera metida en un hueco de 640 px.
          */}
          {cromo === 'completo' ? (
            <p className="embedded__pie">
              <Link
                href={`/m/${module.slug}`}
                target="_blank"
                rel="noopener"
                data-testid="see-completo"
              >
                Ver en la capa de visualizacion
              </Link>
            </p>
          ) : null}
        </article>
        </div>
      </main>
    </>
  );
}
