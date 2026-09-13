import { Avisos } from '../../src/components/Avisos';
import { exigirSesionDePagina } from '../../src/server/session';

/** Pagina de avisos (4.9). */
export const metadata = { title: 'Avisos' };

export default async function PaginaAvisos() {
  await exigirSesionDePagina();
  return <Avisos />;
}
