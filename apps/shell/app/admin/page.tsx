import Link from 'next/link';
import { contarAmpliaciones, listarAuditoria } from '../../src/server/audit';
import { getManagedTree, listTeams, listUsers } from '../../src/server/context';
import { EventoDeAuditoria } from '../../src/components/admin/EventoDeAuditoria';
import { Icono, type IconName } from '../../src/components/iconos/Icono';

export const dynamic = 'force-dynamic';

/** Inicio del panel — el estado del gobierno de un vistazo. */
export default async function AdminInicio() {
  const [arbol, equipos, personas, ampliaciones, recientes] = await Promise.all([
    getManagedTree(),
    listTeams(),
    listUsers(),
    contarAmpliaciones(),
    listarAuditoria().then((e) => e.slice(0, 6)),
  ]);

  const contarNodos = (nodos: typeof arbol.nodes): number =>
    nodos.reduce((n, node) => n + 1 + (node.type === 'folder' ? contarNodos(node.children) : 0), 0);

  return (
    <div className="admin-inicio">
      <div className="tarjetas" data-testid="resumen-gobierno">
        <Resumen
          etiqueta="Nodos en la organizacion"
          valor={contarNodos(arbol.nodes)}
          href="/admin/arbol"
          icono="carpeta"
        />
        <Resumen etiqueta="En papelera" valor={arbol.trash.length} href="/admin/arbol" icono="carpeta" />
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

      <section className="admin-inicio__registro">
        <div className="admin-inicio__registro-cabecera">
          <h2>Ultimos cambios</h2>
          <Link href="/admin/auditoria" className="boton-enlace">
            Ver el registro completo
          </Link>
        </div>

        {recientes.length === 0 ? (
          <p className="texto-atenuado">Sin cambios de configuracion registrados.</p>
        ) : (
          <ul className="registro">
            {recientes.map((e, i) => (
              <EventoDeAuditoria key={`${e.timestamp}-${i}`} evento={e} />
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
      className={`tarjeta tarjeta--enlace ${alerta ? 'tarjeta--alerta' : ''}`}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <span className="tarjeta__icono" aria-hidden="true">
        <Icono nombre={icono} tamano={18} />
      </span>
      <span className="tarjeta__valor">{valor}</span>
      <span className="tarjeta__etiqueta">{etiqueta}</span>
      {nota ? <span className="tarjeta__nota">{nota}</span> : null}
    </Link>
  );
}
