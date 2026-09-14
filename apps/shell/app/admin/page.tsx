import Link from 'next/link';
import { expansionsCount, auditList } from '../../src/server/audit';
import { getManagedTree, listTeams, listUsers } from '../../src/server/context';
import { AuditEvent } from '../../src/components/admin/AuditEvent';
import { Icon, type IconName } from '../../src/components/icons/Icon';

export const dynamic = 'force-dynamic';

/** Inicio del panel — el estado del gobierno de un vistazo. */
export default async function HomeAdmin() {
  const [arbol, equipos, personas, ampliaciones, recientes] = await Promise.all([
    getManagedTree(),
    listTeams(),
    listUsers(),
    expansionsCount(),
    auditList().then((e) => e.slice(0, 6)),
  ]);

  const nodesCount = (nodos: typeof arbol.nodes): number =>
    nodos.reduce((n, node) => n + 1 + (node.type === 'folder' ? nodesCount(node.children) : 0), 0);

  return (
    <div className="admin-home">
      <div className="tarjetas" data-testid="resumen-gobierno">
        <Resumen
          etiqueta="Nodos en la organizacion"
          valor={nodesCount(arbol.nodes)}
          href="/admin/modulos/arbol"
          icono="carpeta"
        />
        <Resumen etiqueta="En papelera" valor={arbol.trash.length} href="/admin/modulos/arbol" icono="carpeta" />
        <Resumen etiqueta="Equipos" valor={equipos.length} href="/admin/equipos" icono="personas" />
        <Resumen etiqueta="Personas" valor={personas.length} href="/admin/equipos" icono="personas" />
        <Resumen
          etiqueta="Ampliaciones de ambito vigentes"
          valor={ampliaciones}
          href="/admin/auditoria?filtro=ampliaciones"
          icono="ambito"
          // Deberia tender a cero. Un numero creciente es señal de que el gobierno de RLS se
          // relaja por acumulacion de excepciones (§7), asi que se destaca al dejar de ser cero.
          alerta={ampliaciones > 0}
          testId="ampliaciones-vigentes"
          nota={ampliaciones === 0 ? 'Es el valor deseable.' : 'Revise si siguen justificadas.'}
        />
      </div>

      <section className="admin-home__log">
        <div className="admin-home__header-log">
          <h2>Ultimos cambios</h2>
          <Link href="/admin/auditoria" className="button-link">
            Ver el registro completo
          </Link>
        </div>

        {recientes.length === 0 ? (
          <p className="muted-text">Sin cambios de configuracion registrados.</p>
        ) : (
          <ul className="registro">
            {recientes.map((e, i) => (
              <AuditEvent key={`${e.timestamp}-${i}`} evento={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  href,
  icono,
  nota,
  alerta,
  testId,
}: {
  etiqueta: string;
  valor: number;
  href: string;
  icono: IconName;
  nota?: string;
  alerta?: boolean;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      className={`tarjeta card--link ${alerta ? 'alert-card' : ''}`}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <span className="card__icon" aria-hidden="true">
        <Icon nombre={icono} tamano={18} />
      </span>
      <span className="card__value">{valor}</span>
      <span className="card__label">{etiqueta}</span>
      {nota ? <span className="card__nota">{nota}</span> : null}
    </Link>
  );
}
