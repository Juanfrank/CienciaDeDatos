import Link from 'next/link';
import type { MessageKey, Translator } from '@app/i18n';
import { can, isFolder, type NavNode } from '@app/access-control';
import { sectionOf } from '../../../src/components/admin/sections';
import { ModuleObjects } from '../../../src/components/admin/ModuleObjects';
import {
  TreeActions,
  type CicloDeModulo,
  type DestinoPosible,
} from '../../../src/components/admin/TreeActions';
import { CrearEnElArbol } from '../../../src/components/admin/CrearEnElArbol';
import {
  ArbolPlegable,
  BotonPlegar,
  type FilaDelArbol,
} from '../../../src/components/admin/ArbolPlegable';
import { modules } from '../../../src/server/moduleStore';
import { getGeneralTree, listUsers } from '../../../src/server/context';
import { objectsOfModule } from '../../../src/server/recursos';
import {
  looseModules,
  organizationRows,
  type FilaCarpeta,
  type FilaModulo,
  type FilaOrganizacion,
} from '../../../src/server/organizacion';
import { translator } from '../../../src/server/locale';
import { actorDe, seeCan } from '../../../src/server/cicloDeVida';
import { pageSessionRequire } from '../../../src/server/session';

export const dynamic = 'force-dynamic';

const ESTADO: Record<string, MessageKey> = {
  borrador: 'admin.modules.status.draft',
  'pendiente-de-aprobacion': 'admin.modules.status.pending',
  publicado: 'admin.modules.status.published',
  retirado: 'admin.modules.status.withdrawn',
};

/**
 * Las seis columnas, con su rotulo y su ancho, en un solo sitio.
 *
 * El ancho estaba sin declarar y cada tabla se lo repartia segun lo que le tocaba dentro: la de
 * vigentes lleva nombres largos y sangrias, la de sueltos no, y las dos acababan con las
 * columnas en sitios distintos aunque la cabecera fuera literalmente el mismo componente.
 * Leerlas una debajo de otra obligaba a volver a buscar donde estaba cada cosa.
 */
const COLUMNAS: { clave: MessageKey; ancho: string }[] = [
  { clave: 'admin.modules.column.module', ancho: 'auto' },
  { clave: 'admin.modules.column.status', ancho: '12rem' },
  { clave: 'admin.modules.column.version', ancho: '5rem' },
  { clave: 'admin.modules.column.pages', ancho: '5rem' },
  { clave: 'admin.modules.column.objects', ancho: '14rem' },
  { clave: 'admin.resources.column.actions', ancho: '15rem' },
];

/** Sangria de un nivel del arbol, en la primera columna. */
const SANGRIA = (profundidad: number) => ({ paddingInlineStart: `${profundidad * 1.5}rem` });

/**
 * Las carpetas a las que se puede mover algo, con la sangria puesta.
 *
 * Se ofrece la raiz tambien: sin ella, lo que baja a una carpeta no puede volver a salir, y no
 * habria forma de sacar nada sin pasar por la papelera.
 */
function destinos(nodos: NavNode[], t: Translator, profundidad = 0): DestinoPosible[] {
  const salida: DestinoPosible[] = profundidad === 0 ? [{ id: null, etiqueta: t('admin.tree.move.root') }] : [];
  for (const nodo of nodos) {
    if (!isFolder(nodo)) continue;
    salida.push({ id: nodo.id, etiqueta: `${'— '.repeat(profundidad)}${nodo.name}` });
    salida.push(...destinos(nodo.children, t, profundidad + 1));
  }
  return salida;
}

/**
 * Los modulos ANIDADOS en sus carpetas — secciones 4.1, 4.2 y 4.10.6.
 *
 * Estaban en una lista plana ordenada por nombre, y eso borra lo unico que explica el acceso: un
 * modulo hereda el ambito de la carpeta que lo contiene, asi que dos modulos contiguos en esa
 * lista podian verlos audiencias distintas sin que nada en pantalla lo dijera. Ahora la tabla es
 * el arbol, y cada fila lleva sus seis acciones.
 */
export default async function ModulosPage() {
  const seccion = sectionOf('/admin/modules');
  const [sesion, t, definiciones, arbol, usuarios] = await Promise.all([
    pageSessionRequire(),
    translator(),
    modules.list(),
    getGeneralTree(),
    listUsers(),
  ]);
  const actor = await actorDe(sesion);

  const porId = new Map(definiciones.map((m) => [m.moduleId, m]));
  const filas = organizationRows(arbol, porId);
  const sueltos = looseModules(arbol, porId);
  const esperando = definiciones.filter((m) => m.status === 'pendiente-de-aprobacion');

  /*
   * El identificador de una persona no es su nombre.
   *
   * La columna decia «Autor» y ensenaba `u-ana`, que no es el autor: es su clave en el directorio.
   * Y para un modulo publicado salia «—», porque lo publicado no tiene autor —tiene a quien lo
   * aprobo—. Ahora el nombre acompana al modulo y solo cuando lo hay.
   */
  const nombreDe = (userId: string | undefined): string | null => {
    if (!userId) return null;
    const persona = usuarios.find((u) => u.userId === userId);
    return persona?.displayName ?? userId;
  };

  const posibles = destinos(arbol, t);

  /*
   * Que puede hacer ESTE actor con el estado de ESTE modulo.
   *
   * Se decide en el servidor, donde estan el papel y la matriz de 4.10.1, y baja como tres
   * banderas. Que el boton no se dibuje no protege nada —el camino de escritura vuelve a
   * comprobarlo—, pero ofrecer una accion que va a devolver 403 es peor que no ofrecerla.
   */
  const cicloDe = (m: (typeof definiciones)[number]): CicloDeModulo => ({
    slug: m.slug,
    status: m.status,
    verPuede: seeCan(m, actor),
    retirarPuede: can(actor.role, 'publicar-modulo-institucional'),
    borrarPuede: can(actor.role, 'borrar-definitivamente'),
  });

  return (
    <section>
      <h2>{t('admin.modules.title')}</h2>
      <p className="muted-text">{seccion?.desc}</p>


      {/*
        Lo que espera una decision va PRIMERO y aparte.
        En un arbol, un modulo propuesto hace tres semanas queda enterrado en una subcarpeta y no
        lo ve nadie — igual que pasaba en la lista ordenada por nombre.
      */}
      {esperando.length > 0 ? (
        <div className="notice-atencion" data-testid="modulos-esperando">
          {t('admin.modules.awaiting', {
            n: esperando.length,
            nombres: t.lista(esperando.map((m) => m.name)),
          })}{' '}
          <Link href="/admin/modules/pending" data-testid="ir-a-pendientes">
            {t('admin.review.go')}
          </Link>
        </div>
      ) : null}

      <h3>{t('admin.modules.current', { n: definiciones.length })}</h3>
      <p className="muted-text">{t('admin.modules.tree.intro')}</p>

      <CrearEnElArbol destinos={posibles} />

      {/*
        La tabla se dibuja aqui, en el servidor, y quien decide que filas se ven es un componente
        de cliente que la envuelve. Las filas le llegan como `children` y no se enteran: lo unico
        que cruza la frontera son datos —id, profundidad y padre— y el traductor se queda de este
        lado, que es lo que impide repetir el fallo de pasar funciones a un componente de cliente.
      */}
      <ArbolPlegable
        clase="tabla--modulos"
        filas={filas.map(
          (fila): FilaDelArbol => ({
            id: fila.id,
            tipo: fila.tipo,
            profundidad: fila.profundidad,
            padre: fila.padre,
            // Lo que se puede escribir para dar con la fila. Se arma aqui, en el servidor, donde
            // estan el traductor y los datos: el filtro de cliente solo recibe texto.
            texto:
              fila.tipo === 'carpeta'
                ? fila.nombre
                : `${fila.modulo.name} ${fila.modulo.slug} ${fila.modulo.description ?? ''}`,
          }),
        )}
        cabecera={<Cabecera t={t} />}
      >
        {filas.map((fila) => (
          <Fila
            key={`${fila.tipo}-${fila.id}`}
            fila={fila}
            t={t}
            destinos={posibles}
            autor={fila.tipo === 'modulo' ? nombreDe(fila.modulo.ownerUserId) : null}
            cicloDe={cicloDe}
          />
        ))}
      </ArbolPlegable>

      {/*
        Lo que el arbol no coloca. Un borrador recien creado entra en la organizacion general al
        publicarse, asi que hasta entonces no cuelga de ninguna carpeta: sin esta tabla habria
        desaparecido de la pantalla justo al pasar de lista plana a arbol.
      */}
      {sueltos.length > 0 ? (
        <>
          <h3>{t('admin.modules.loose', { n: sueltos.length })}</h3>
          <p className="muted-text">{t('admin.modules.loose.intro')}</p>
          <div className="container-table">
            <table className="tabla tabla--modulos" data-testid="tabla-modulos-sueltos">
              <Cabecera t={t} />
              <tbody>
                {sueltos.map((m) => (
                  <Modulo
                    key={m.moduleId}
                    fila={{
                      tipo: 'modulo',
                      id: m.moduleId,
                      profundidad: 0,
                      indice: 0,
                      hermanos: 1,
                      hidden: false,
                      padre: null,
                      modulo: m,
                    }}
                    t={t}
                    destinos={posibles}
                    autor={nombreDe(m.ownerUserId)}
                    ciclo={cicloDe(m)}
                    // Un modulo que no esta en el arbol no se puede mover dentro de el: los tres
                    // primeros iconos no tendrian sobre que actuar.
                    enElArbol={false}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <p className="muted-text">
        {t('admin.modules.footer')} <Link href="/editor">{t('admin.modules.footer.link')}</Link>
      </p>
    </section>
  );
}

/** Las seis columnas, iguales en las dos tablas: una cabecera, un solo sitio que mantener. */
function Cabecera({ t }: { t: Translator }) {
  return (
    <>
      <colgroup>
        {COLUMNAS.map((columna) => (
          <col key={columna.clave} style={{ width: columna.ancho }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {COLUMNAS.map((columna) => (
            <th key={columna.clave} scope="col">
              {t(columna.clave)}
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}

function Fila({
  fila,
  t,
  destinos: posibles,
  autor,
  cicloDe,
}: {
  fila: FilaOrganizacion;
  t: Translator;
  destinos: DestinoPosible[];
  autor: string | null;
  /*
   * La funcion, no el resultado.
   *
   * Solo una fila de MODULO tiene ciclo de vida, y pasar `CicloDeModulo | null` obligaba a este
   * componente a admitir un modulo sin ciclo —que no existe— y a decidir que hacer con el.
   * Se queda en el servidor: no cruza a ningun componente de cliente.
   */
  cicloDe: (modulo: FilaModulo['modulo']) => CicloDeModulo;
}) {
  if (fila.tipo === 'carpeta') return <Carpeta fila={fila} t={t} destinos={posibles} />;
  return (
    <Modulo
      fila={fila}
      t={t}
      destinos={posibles}
      autor={autor}
      ciclo={cicloDe(fila.modulo)}
      enElArbol
    />
  );
}

function Modulo({
  fila,
  t,
  destinos: posibles,
  autor,
  ciclo,
  enElArbol,
}: {
  fila: FilaModulo;
  t: Translator;
  destinos: DestinoPosible[];
  autor: string | null;
  ciclo: CicloDeModulo;
  enElArbol: boolean;
}) {
  const m = fila.modulo;

  return (
    <tr
      data-testid={`modulo-${m.slug}`}
      data-depth={fila.profundidad}
      data-hidden={fila.hidden ? 'si' : 'no'}
    >
      <th scope="row" style={SANGRIA(fila.profundidad)}>
        <Link href={`/editor/${m.slug}`}>{m.name}</Link>
        <span className="muted-text"> /m/{m.slug}</span>
        {/* El nombre de quien lo tiene a su cargo va DEBAJO del modulo y no en una columna
            propia: solo lo tiene un borrador, y una columna vacia en cuatro de cada cinco filas
            es una columna que no dice nada. */}
        {autor ? <p className="muted-text">{t('admin.modules.owner', { quien: autor })}</p> : null}
      </th>
      <td>
        {t(ESTADO[m.status] ?? 'admin.modules.status.draft')}
        {fila.hidden ? <Oculto t={t} /> : null}
      </td>
      <td>
        {/* La version es el enlace a lo que hubo antes: es la pregunta que se hace mirando ese
            numero. */}
        <Link href={`/admin/modules/${m.slug}/history`} data-testid={`history-${m.slug}`}>
          v{m.version}
        </Link>
      </td>
      <td>{m.pages.length}</td>
      <td>
        <ModuleObjects slug={m.slug} objetos={objectsOfModule(m)} />
      </td>
      <td>
        <TreeActions
          nodeId={fila.id}
          nombre={m.name}
          hidden={fila.hidden}
          indice={fila.indice}
          puedeSubir={enElArbol && fila.indice > 0}
          puedeBajar={enElArbol && fila.indice < fila.hermanos - 1}
          destinos={posibles}
          hrefConfigurar={`/admin/modules/${m.slug}/settings`}
          hrefPermisos={`/admin/modules/${m.slug}/permissions`}
          ciclo={ciclo}
          {...(m.status === 'publicado' ? { editable: m.slug } : {})}
        />
      </td>
    </tr>
  );
}

/**
 * Una carpeta, con su ambito en la columna de ESTADO.
 *
 * Antes ocupaba cuatro columnas con `colSpan` y dejaba el ambito bajo «Objetos» y el enlace bajo
 * «Autor»: la tabla ensenaba valores en columnas que no eran las suyas. El ambito es el estado de
 * una carpeta —hereda o restringe—, asi que va donde el modulo pone el suyo y todo lo demas queda
 * vacio, que es la verdad: una carpeta no tiene version ni paginas ni objetos.
 */
function Carpeta({
  fila,
  t,
  destinos: posibles,
}: {
  fila: FilaCarpeta;
  t: Translator;
  destinos: DestinoPosible[];
}) {
  const restricciones = fila.scope?.restrictions ?? [];

  return (
    <tr
      className="fila-carpeta"
      data-testid={`carpeta-${fila.id}`}
      data-depth={fila.profundidad}
      data-hidden={fila.hidden ? 'si' : 'no'}
    >
      <th scope="row" style={SANGRIA(fila.profundidad)}>
        <BotonPlegar nodeId={fila.id} nombre={fila.nombre} />{' '}
        <span className="fila-carpeta__nombre">{fila.nombre}</span>{' '}
        <span className="muted-text">{t('admin.modules.folder.count', { n: fila.modulos })}</span>
      </th>
      <td data-testid={`carpeta-${fila.id}-ambito`}>
        {restricciones.length === 0 ? (
          <span className="muted-text">{t('admin.modules.folder.inherits')}</span>
        ) : (
          <span className="insignia">
            {t('admin.modules.folder.restricts', {
              cuales: t.lista(restricciones.map((r) => `${r.dimension.table}.${r.dimension.field}`)),
            })}
          </span>
        )}
        {fila.hidden ? <Oculto t={t} /> : null}
      </td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>
        <TreeActions
          nodeId={fila.id}
          nombre={fila.nombre}
          hidden={fila.hidden}
          indice={fila.indice}
          puedeSubir={fila.indice > 0}
          puedeBajar={fila.indice < fila.hermanos - 1}
          // Una carpeta no se puede meter dentro de si misma ni de una de sus hijas: la lista se
          // recorta antes de ofrecerla, en vez de dejar que la operacion lo rechace despues.
          destinos={posibles.filter((d) => d.id !== fila.id)}
          hrefConfigurar={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}
          hrefPermisos={`/admin/scopes?destino=${encodeURIComponent(fila.id)}`}
        />
      </td>
    </tr>
  );
}

/** La insignia de oculto, que dice tambien lo que implica. */
function Oculto({ t }: { t: Translator }) {
  return (
    <>
      {' '}
      <span className="insignia badge--error" title={t('admin.tree.hidden.explain')}>
        {t('admin.tree.hidden')}
      </span>
    </>
  );
}
