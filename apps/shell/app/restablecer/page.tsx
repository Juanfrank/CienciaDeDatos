import { Restablecer } from '../../src/components/Restablecer';

export const metadata = { title: 'Restablecer contrasena' };

/**
 * Pantalla de restablecimiento — seccion 4.7.2.
 *
 * Sin sesion, por definicion: quien llega aqui no puede entrar. No recibe el resetId por la URL
 * a proposito: un identificador en la barra de direcciones acaba en el historial, en los logs
 * del proxy y en el `Referer` de la siguiente peticion. Se escribe, junto con el codigo.
 */
export default function PaginaRestablecer() {
  return <Restablecer />;
}
