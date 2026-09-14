/** Pagina de acceso denegado al panel. */
export default function WithoutPermission() {
  return (
    <div className="vacio" data-testid="sin-permiso">
      <h1>Sin permiso</h1>
      <p className="muted-text">
        El panel de administracion requiere el rol Administrador. Su rol actual no lo incluye.
      </p>
    </div>
  );
}
