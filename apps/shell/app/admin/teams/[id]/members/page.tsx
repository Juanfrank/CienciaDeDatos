import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TeamMembers } from '../../../../../src/components/admin/TeamMembers';
import { listTeams, listUsers } from '../../../../../src/server/context';
import { translator } from '../../../../../src/server/locale';

export const dynamic = 'force-dynamic';

/** Quien esta en un equipo, y con que rol — seccion 4.10.2. */
export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, equipos, personas] = await Promise.all([translator(), listTeams(), listUsers()]);

  const equipo = equipos.find((e) => e.id === id);
  if (!equipo) notFound();

  return (
    <section>
      <h2>{t('admin.teams.members.title', { equipo: equipo.name })}</h2>
      <p className="muted-text">{t('admin.teams.members.intro')}</p>

      <p>
        <Link href="/admin/teams">← {t('admin.teams.title')}</Link>
      </p>

      <TeamMembers
        equipo={equipo}
        personas={personas.map((u) => ({ userId: u.userId, displayName: u.displayName ?? u.userId }))}
      />
    </section>
  );
}
