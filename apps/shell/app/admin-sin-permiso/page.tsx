/** Pagina de acceso denegado al panel. */
export default function SinPermiso() {
  return (
    <div className="vacio" data-testid="sin-permiso">
      <h1>Sin permiso</h1>
      <p className="texto-atenuado">
        El panel de administracion requiere el role Administrador. Su role actual no lo incluye.
      </p>
    </div>
  );
}
