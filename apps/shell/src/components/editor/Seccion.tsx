'use client';

/**
 * Seccion colapsable del panel.
 *
 * Es un `<details>` y no un div con estado por el mismo motivo de siempre: el navegador ya trae
 * el gesto, el manejo de teclado y el anuncio de plegado a un lector de pantalla. Reimplementarlo
 * son treinta lineas que se rompen en el primer caso raro.
 *
 * `abierta` decide el estado INICIAL, no lo controla. Una seccion controlada se cerraria sola en
 * cada guardado —el panel se redibuja entero— y quien estuviera trabajando en ella la veria
 * plegarse bajo el cursor.
 */
export function Seccion({
  titulo,
  abierta = true,
  nivel = 1,
  prueba,
  children,
}: {
  titulo: string;
  abierta?: boolean;
  /** 2 para una subseccion: mismo mecanismo, menos peso visual. */
  nivel?: 1 | 2;
  prueba?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="seccion" data-nivel={nivel} open={abierta} {...(prueba ? { 'data-testid': prueba } : {})}>
      <summary className="seccion__titulo">{titulo}</summary>
      <div className="seccion__cuerpo">{children}</div>
    </details>
  );
}
