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
import { ProveedorDeIdioma } from '../src/components/Idioma';
import { obtenerSesion } from '../src/server/sesion';
import { idioma } from '../src/server/idioma';
import { modoDeColor } from '../src/server/tema';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capa de visualizacion',
  description: `Reporting institucional — ${defaultIdentity.name}`,
};

/** Montserrat, la tipografia institucional. */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  // La pila de alternativas la fija el tema; aqui solo se declara que variable la lleva.
  variable: '--font-montserrat',
});

/** El tema organizacional (4.3) se inyecta como variables CSS en la raiz del documento. */
function variablesDelTema(modo: ModoDeColor): Record<string, string> {
  const tema = temaPorModo(modo);
  return { ...variablesMaterial(tema), ...toCssVariables(comoThemeTokens(tema)) };
}

/** Cromo comun a toda la aplicacion: documento, tema y cabecera. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sesion, modo, locale] = await Promise.all([obtenerSesion(), modoDeColor(), idioma()]);

  /*
   * `colorScheme` no es decorativo: es lo que hace que el navegador dibuje en oscuro lo que no
   * pinta la hoja de estilo —barras de desplazamiento, casillas, desplegables nativos— y lo que
   * evita una casilla blanca sobre una tarjeta oscura, que ademas de feo es un fallo de contraste.
   */
  return (
    <html lang={locale} className={montserrat.variable} data-tema={modo}>
      <body
        style={{ ...variablesDelTema(modo), colorScheme: modo === 'oscuro' ? 'dark' : 'light' } as React.CSSProperties}
      >
        <ProveedorDeIdioma locale={locale}>
          {sesion ? <Cabecera sesion={sesion} /> : null}
          {children}
        </ProveedorDeIdioma>
      </body>
    </html>
  );
}
