import Link from 'next/link';
import { contarAmpliaciones, listarAuditoria } from '../../src/server/auditoria';
import { getManagedTree, listTeams, listUsers } from '../../src/server/contexto';

export const dynamic = 'force-dynamic';

/** Resumen del estado de gobierno. */
export default async function AdminInicio() {
  const arbol = await getManagedTree();
  const equipos = await listTeams();
  const ampliaciones = await contarAmpliaciones();
  const recientes = (await listarAuditoria()).slice(0, 5);

  const contarNodos = (nodos: typeof arbol.nodes): number =>
    nodos.reduce((n, nodo) => n + 1 + (nodo.type === 'folder' ? contarNodos(nodo.children) : 0), 0);

  return (
    <div className="admin-inicio">
      <div className="tarjetas">
        <Resumen etiqueta="Nodos en la organizacion general" valor={contarNodos(arbol.nodes)} />
        <Resumen etiqueta="En papelera" valor={arbol.trash.length} />
        <Resumen etiqueta="Equipos" valor={equipos.length} />
        <Resumen etiqueta="Personas" valor={(await listUsers()).length} />
        <Resumen
          etiqueta="Ampliaciones de ambito vigentes"
          valor={ampliaciones}
          // Deberia tender a cero. Un numero creciente es señal de gobierno de RLS
          // deteriorandose (seccion 7), asi que se destaca cuando deja de ser cero.
          alerta={ampliaciones > 0}
          testId="ampliaciones-vigentes"
        />
      </div>

      <section>
        <h2>Ultimos cambios</h2>
        {recientes.length === 0 ? (
          <p className="texto-atenuado">Sin cambios de configuracion registrados.</p>
        ) : (
          <ul className="lista-simple">
            {recientes.map((e, i) => (
              <li key={i}>
                <code>{e.entityType}</code> · {e.action} · {e.entityId}
                {e.isScopeExpansion ? <span className="insignia insignia--error">Ampliacion</span> : null}
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/auditoria" className="boton-enlace">
          Ver el registro completo
        </Link>
      </section>
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  alerta,
  testId,
}: {
  etiqueta: string;
  valor: number;
  alerta?: boolean;
  testId?: string;
}) {
  return (
    <div className={`tarjeta ${alerta ? 'tarjeta--alerta' : ''}`} {...(testId ? { 'data-testid': testId } : {})}>
      <p className="tarjeta__valor">{valor}</p>
      <p className="tarjeta__etiqueta">{etiqueta}</p>
    </div>
  );
}
