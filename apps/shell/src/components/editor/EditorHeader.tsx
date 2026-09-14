import Link from 'next/link';

/** La cabecera del editor. */
export function EditorHeader() {
  return (
    <header className="admin__header">
      <div>
        <h1>Editor de modulos</h1>
        <p className="muted-text">
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
