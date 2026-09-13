import Link from 'next/link';

/** La cabecera del editor. */
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
