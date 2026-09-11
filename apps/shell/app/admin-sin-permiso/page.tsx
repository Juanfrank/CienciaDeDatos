/**
 * Pagina de acceso denegado al panel.
 *
 * Vive FUERA del layout de /admin —en su propia ruta— porque ese layout redirige aqui: si
 * estuviera dentro, la redireccion seria un bucle.
 */
export default function SinPermiso() {
  return (
    <div className="vacio" data-testid="sin-permiso">
      <h1>Sin permiso</h1>
      <p className="texto-atenuado">
        El panel de administracion requiere el rol Administrador. Su rol actual no lo incluye.
      </p>
    </div>
  );
}
