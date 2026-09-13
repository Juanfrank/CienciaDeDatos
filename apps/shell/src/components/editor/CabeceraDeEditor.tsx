import Link from 'next/link';

/**
 * La cabecera del editor.
 *
 * Vivia en el layout de la ruta, y sale de ahi por una razon de disposicion: el panel de objetos
 * tiene que ser un carril de pantalla completa pegado al borde derecho, y desde dentro del `main`
 * del layout no habia forma de llegar al borde sin sacarlo del flujo. Ahora la pagina del editor
 * monta ella misma las dos columnas y pone esta cabecera DENTRO de la izquierda, que es donde le
 * corresponde: encabeza el taller, no el panel.
 *
 * Es un componente y no dos copias porque la lista y el editor de un modulo la comparten: con dos
 * copias, cambiar el rotulo significaria acordarse de tocar las dos.
 */
export function CabeceraDeEditor() {
  return (
    <header className="admin__cabecera">
      <div>
        <h1>Editor de modulos</h1>
        <p className="texto-atenuado">
          Objetos prediseñados enlazados a datasets certificados, nunca a una consulta escrita a
          mano
        </p>
      </div>
      <Link href="/" className="boton-contorno" data-testid="volver-a-modulos">
        Volver a los modulos
      </Link>
    </header>
  );
}
