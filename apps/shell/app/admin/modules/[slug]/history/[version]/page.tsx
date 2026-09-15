import Link from 'next/link';
import { notFound } from 'next/navigation';
import { moduleLoad } from '../../../../../../src/server/data';
import { modules } from '../../../../../../src/server/moduleStore';
import { objectSerialize } from '../../../../../../src/server/serialize';
import { pageSessionRequire } from '../../../../../../src/server/session';
import { translator } from '../../../../../../src/server/locale';
import { VersionAntigua } from '../../../../../../src/components/admin/VersionAntigua';
import { RestoreVersion } from '../../../../../../src/components/admin/RestoreVersion';

export const dynamic = 'force-dynamic';

/**
 * Lo que se VEIA en una version publicada — seccion 4.5.
 *
 * El historial decia quien publico que y cuando, y ofrecia restaurar. Lo que no ofrecia era
 * MIRAR: para decidir si se vuelve a una version hay que ver lo que traia, y la unica forma era
 * restaurarla —es decir, publicarla— y juzgar despues. Restaurar dejo de ser la manera de
 * enterarse.
 *
 * Los DATOS son los de hoy, no los de entonces: lo que se guarda en el historial es la
 * definicion —objetos y posiciones—, no el contenido del cache, que se repuebla cada noche. Se
 * dice en pantalla, porque «ver la version 3» podria entenderse como ver las cifras de aquel dia.
 *
 * El permiso lo pone el `layout.tsx` del panel, igual que el resto de `/admin`.
 */
export default async function VersionPage({
  params,
}: {
  params: Promise<{ slug: string; version: string }>;
}) {
  const { slug, version } = await params;
  const numero = Number(version);
  if (!Number.isInteger(numero)) notFound();

  const modulo = await modules.bySlug(slug);
  if (!modulo) notFound();

  const [historial, sesion, t] = await Promise.all([
    modules.history(modulo.moduleId),
    pageSessionRequire(),
    translator(),
  ]);

  const foto = historial.find((v) => v.version === numero);
  if (!foto) notFound();

  const cargado = await moduleLoad({
    // La definicion de ENTONCES, con el moduleId de hoy: de el cuelgan el ambito y lo concedido,
    // asi que la comprobacion de acceso sigue siendo la del modulo, no la de la foto.
    module: { ...foto.definition, moduleId: modulo.moduleId },
    userId: sesion.userId,
    teamId: sesion.activeTeamId,
    requestedFilters: {},
  });
  if (!cargado) notFound();

  const vigente = foto.version === modulo.version;

  return (
    <section>
      <h2>{t('admin.history.version.title', { modulo: modulo.name, version: foto.version })}</h2>
      <p className="muted-text">{t('admin.history.version.intro')}</p>

      <p>
        <Link href={`/admin/modules/${modulo.slug}/history`}>← {t('admin.history.back')}</Link>
        {vigente ? null : (
          <>
            {' · '}
            <RestoreVersion slug={modulo.slug} version={foto.version} />
          </>
        )}
      </p>

      <VersionAntigua objetos={cargado.objetos.map(objectSerialize)} />
    </section>
  );
}
