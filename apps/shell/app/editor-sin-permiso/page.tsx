import Link from 'next/link';

export const metadata = { title: 'Sin permiso para editar' };

export default function WithoutEditorPermission() {
  return (
    <div className="vacio">
      <h1 data-testid="sin-permiso-editor">Sin permiso</h1>
      <p className="muted-text">
        Crear y edit modulos esta reservado a los roles Colaborador y Administrador (4.10.1). Su
        rol permite ver los modulos de sus equipos y personalizar su view.
      </p>
      <Link href="/" className="boton-contorno">
        Volver a los modulos
      </Link>
    </div>
  );
}
