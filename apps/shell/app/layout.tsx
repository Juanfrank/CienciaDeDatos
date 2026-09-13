import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import {
  comoThemeTokens,
  defaultIdentity,
  temaPorModo,
  toCssVariables,
  variablesMaterial,
  type ModoDeColor,
} from '@app/design-tokens';
import { Cabecera } from '../src/components/Cabecera';
import { obtenerSesion } from '../src/server/sesion';
import { modoDeColor } from '../src/server/tema';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capa de visualizacion',
  description: `Reporting institucional — ${defaultIdentity.name}`,
};

/**
 * Montserrat, la tipografia institucional.
 *
 * Se carga con `next/font`, que la descarga EN TIEMPO DE CONSTRUCCION y la sirve desde el propio
 * origen. Un `<link>` a fonts.googleapis.com haria que el navegador hablase con un tercero, y
 * eso incumple el principio 1 —el navegador solo habla con esta aplicacion—; hay una prueba de
 * navegador que lo comprueba y que ese enlace romperia. De paso evita el parpadeo de la fuente y
 * una peticion externa en cada carga.
 */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  // La pila de alternativas la fija el tema; aqui solo se declara que variable la lleva.
  variable: '--font-montserrat',
});

/**
 * El tema organizacional (4.3) se inyecta como variables CSS en la raiz del documento.
 *
 * Se emiten LOS DOS juegos: los roles de Material Design 3 (`--md-sys-*`), que es el sistema
 * sobre el que esta escrita la interfaz, y los del tema derivado, que todavia usan unas cuantas
 * hojas de estilo y el paquete de exportacion. Salen del mismo sitio, asi que no pueden
 * discrepar; los segundos desapareceran cuando no quede nadie leyendolos.
 *
 * Los DOS se calculan desde el MISMO modo. Emitir los roles de MD3 en oscuro y los derivados en
 * claro —que es lo que pasaria dejando `defaultTheme` fijo aqui— daria una pagina oscura con
 * texto pensado para fondo blanco: el fallo de contraste mas facil de introducir y el mas dificil
 * de atribuir, porque cada juego de variables esta bien por separado.
 */
function variablesDelTema(modo: ModoDeColor): Record<string, string> {
  const tema = temaPorModo(modo);
  return { ...variablesMaterial(tema), ...toCssVariables(comoThemeTokens(tema)) };
}

/**
 * Cromo comun a toda la aplicacion: documento, tema y cabecera.
 *
 * La navegacion de MODULOS no vive aqui, sino en el grupo de rutas (modulos). El panel de
 * administracion es "una superficie de gestion dedicada, SEPARADA de los modulos de negocio"
 * (4.10.8), asi que no debe arrastrar el arbol de modulos a un lado mientras se administra.
 *
 * La cabecera solo se dibuja con sesion. Este layout envuelve tambien la pantalla de acceso, y
 * alli no hay equipo activo del que hablar ni campana que atender. Que falte la cabecera NO es
 * lo que protege las paginas: cada una exige su sesion por su cuenta.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sesion, modo] = await Promise.all([obtenerSesion(), modoDeColor()]);

  /*
   * `colorScheme` no es decorativo: es lo que hace que el navegador dibuje en oscuro lo que no
   * pinta la hoja de estilo —barras de desplazamiento, casillas, desplegables nativos— y lo que
   * evita una casilla blanca sobre una tarjeta oscura, que ademas de feo es un fallo de contraste.
   */
  return (
    <html lang="es" className={montserrat.variable} data-tema={modo}>
      <body
        style={{ ...variablesDelTema(modo), colorScheme: modo === 'oscuro' ? 'dark' : 'light' } as React.CSSProperties}
      >
        {sesion ? <Cabecera sesion={sesion} /> : null}
        {children}
      </body>
    </html>
  );
}
