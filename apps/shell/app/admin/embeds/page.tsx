import { EmbedsTable, type FilaDeCodigo } from '../../../src/components/admin/EmbedsTable';
import { listUsers } from '../../../src/server/context';
import { embedsList } from '../../../src/server/incrustaciones';
import { translator } from '../../../src/server/locale';

export const dynamic = 'force-dynamic';

/**
 * Los codigos de incrustacion vivos, y quien los genero — seccion 4.9.
 *
 * El permiso lo pone el `layout.tsx` del panel. Esta pantalla es la respuesta a una pregunta que
 * antes no tenia ninguna: donde estan las vistas de la institucion metidas en paginas de fuera.
 */
export default async function EmbedsPage() {
  const [t, codigos, personas] = await Promise.all([translator(), embedsList(), listUsers()]);

  // El identificador de una persona no es su nombre: `u-ana` no dice quien genero el codigo.
  const nombreDe = (id: string) =>
    personas.find((u) => u.userId === id)?.displayName ?? id;

  const filas: FilaDeCodigo[] = codigos.map((c) => ({
    code: c.code,
    modulo: c.moduleName,
    pagina: c.pageSlug ?? null,
    cromo: c.chrome,
    filtros: Object.keys(c.filters).length,
    creadoPor: nombreDe(c.createdBy),
    creadoEn: c.createdAt,
    revocadoPor: c.revokedBy ? nombreDe(c.revokedBy) : null,
    revocadoEn: c.revokedAt ?? null,
    motivo: c.reason ?? null,
  }));

  return (
    <section>
      <h2>{t('admin.embeds.title')}</h2>
      <p className="muted-text">{t('admin.embeds.intro')}</p>

      <EmbedsTable codigos={filas} />
    </section>
  );
}
