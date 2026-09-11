import Link from 'next/link';

export const metadata = { title: 'Sin permiso para editar' };

export default function SinPermisoEditor() {
  return (
    <div className="vacio">
      <h1 data-testid="sin-permiso-editor">Sin permiso</h1>
      <p className="texto-atenuado">
        Crear y editar modulos esta reservado a los roles Colaborador y Administrador (4.10.1). Su
        rol permite ver los modulos de sus equipos y personalizar su vista.
      </p>
      <Link href="/" className="boton-enlace">
        Volver a los modulos
      </Link>
    </div>
  );
}
