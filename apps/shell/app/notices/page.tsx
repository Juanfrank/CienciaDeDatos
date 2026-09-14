import { Notices } from '../../src/components/Notices';
import { pageSessionRequire } from '../../src/server/session';

/** Pagina de avisos (4.9). */
export const metadata = { title: 'Avisos' };

export default async function NoticesPage() {
  await pageSessionRequire();
  return <Notices />;
}
