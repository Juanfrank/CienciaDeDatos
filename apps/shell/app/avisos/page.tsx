import { Avisos } from '../../src/components/Avisos';

/**
 * Pagina de avisos (4.9).
 *
 * Fuera del grupo (modulos): la bandeja no pertenece a ningun modulo, y arrastrar el arbol de
 * navegacion al lado sugeriria que si.
 */
export const metadata = { title: 'Avisos' };

export default function PaginaAvisos() {
  return <Avisos />;
}
