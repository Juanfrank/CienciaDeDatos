import Link from 'next/link';
import { notFound } from 'next/navigation';
import { listUsers } from '../../../../../src/server/context';
import { modules } from '../../../../../src/server/moduleStore';
import { RestoreVersion } from '../../../../../src/components/admin/RestoreVersion';

export const dynamic = 'force-dynamic';

/**
 * Lo que estuvo publicado de un modulo, y desde cuando — seccion 4.5.
 *
 * El permiso lo pone el `layout.tsx` del panel, que corta a quien no administra antes de dibujar
 * nada. Esta pagina lee del almacen directamente en el servidor, sin pasar por la API: es la
 * misma lectura, sin un viaje de ida y vuelta que no anade nada.
 */
export default async function HistoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const modulo = await modules.bySlug(slug);
  if (!modulo) notFound();

  const [historial, personas] = await Promise.all([
    modules.history(modulo.moduleId),
    listUsers(),
  ]);
  const nombreDe = (id: string) =>
    personas.find((u) => u.userId === id)?.displayName ?? id;

  return (
    <section>
      <h2>Historial de {modulo.name}</h2>
      <p className="muted-text">
        Cada publicacion guarda una foto completa de la definicion. Volver atras no reescribe
        ninguna: publica una version nueva con el contenido de la que se elija, y queda dicho de
        cual salio.
      </p>

      <p>
        <Link href="/admin/modules">← Modulos</Link>
        {' · '}
        <Link href={`/editor/${modulo.slug}`}>Editar</Link>
        {' · '}
        <Link href={`/m/${modulo.slug}`}>Ver</Link>
      </p>

      {historial.length === 0 ? (
        <p className="muted-text" data-testid="history-empty">
          Este modulo todavia no se ha publicado ninguna vez. El historial empieza en la primera
          publicacion: no se inventa hacia atras.
        </p>
      ) : (
        <div className="container-table">
          <table className="tabla" data-testid="history-table">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Publicada</th>
                <th scope="col">Por</th>
                <th scope="col">Paginas</th>
                <th scope="col">Objetos</th>
                <th scope="col">Accion</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((v) => {
                const vigente = v.version === modulo.version;
                return (
                  <tr key={v.version} data-testid={`history-v${v.version}`}>
                    <th scope="row">
                      v{v.version}
                      {vigente ? (
                        <span className="insignia" data-testid={`history-vigente-${v.version}`}>
                          {' '}
                          Vigente
                        </span>
                      ) : null}
                      {v.restoredFrom === undefined ? null : (
                        <span className="muted-text"> · restaurada de v{v.restoredFrom}</span>
                      )}
                    </th>
                    <td>
                      <time dateTime={v.publishedAt}>
                        {new Date(v.publishedAt).toLocaleString('es-DO')}
                      </time>
                    </td>
                    <td>{nombreDe(v.publishedBy)}</td>
                    <td>{v.definition.pages.length}</td>
                    <td>
                      {v.definition.pages.reduce((n, p) => n + p.items.length, 0)}
                    </td>
                    <td>
                      {vigente ? (
                        <span className="muted-text">—</span>
                      ) : (
                        <RestoreVersion slug={modulo.slug} version={v.version} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
