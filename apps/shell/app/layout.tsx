import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { defaultIdentity } from '@app/design-tokens';
import { Header } from '../src/components/Header';
import { LocaleProvider } from '../src/components/Locale';
import { sessionGet } from '../src/server/session';
import { idioma } from '../src/server/locale';
import { activeTheme, colorMode, themeVariables } from '../src/server/theme';
import { PATH_HEADER } from '../src/server/csp';
import { isEmbeddablePath } from '../src/server/embedding';
import { headers } from 'next/headers';
import './globals.css';

/*
 * El titulo del documento es lo que se lee en la pestana del navegador y en un marcador, asi que
 * es el MISMO nombre que lleva el encabezado. Se quedo en «Capa de visualizacion» —el nombre con
 * el que se describe el proyecto por dentro— cuando el encabezado paso a nombrarse de cara a la
 * gente, y una pestana que no coincide con lo que se ve en pantalla es de las cosas que hacen
 * dudar de si uno esta donde cree.
 *
 * No sale del catalogo: `metadata` se evalua una vez, fuera de la peticion, asi que no hay
 * idioma que consultar. El nombre de la institucion tampoco se traduce.
 */
export const metadata: Metadata = {
  title: 'Gestión de Datos y Conocimiento',
  description: `${defaultIdentity.name} — Gestión de Datos y Conocimiento`,
};

/** Montserrat, la tipografia institucional. */
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  // La pila de alternativas la fija el tema; aqui solo se declara que variable la lleva.
  variable: '--font-montserrat',
});

/** Cromo comun a toda la aplicacion: documento, tema y cabecera. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [sesion, mode, locale, tema, cabeceras] = await Promise.all([
    sessionGet(),
    colorMode(),
    idioma(),
    activeTheme(),
    headers(),
  ]);

  /*
   * La cabecera de la aplicacion NO se dibuja sobre una vista incrustada.
   *
   * Incrustar servia dos encabezados —el de la aplicacion encima del institucional— y con ellos la
   * navegacion entera de la capa de visualizacion dentro del hueco del portal anfitrion. La
   * version «sin encabezado» tenia uno igualmente, que es lo que lo dejo a la vista.
   *
   * La ruta llega por una cabecera que pone el middleware: una disposicion de Next no sabe que
   * ruta sirve, y esta es la unica que necesita distinguirla.
   */
  const incrustada = isEmbeddablePath(cabeceras.get(PATH_HEADER) ?? '');

  /*
   * `colorScheme` no es decorativo: es lo que hace que el navegador dibuje en oscuro lo que no
   * pinta la hoja de estilo —barras de desplazamiento, casillas, desplegables nativos— y lo que
   * evita una casilla blanca sobre una tarjeta oscura, que ademas de feo es un fallo de contraste.
   */
  return (
    <html lang={locale} className={montserrat.variable} data-theme={mode}>
      <body
        data-tema={tema.id}
        style={
          {
            ...themeVariables(tema, mode),
            colorScheme: mode === 'dark' ? 'dark' : 'light',
          } as React.CSSProperties
        }
      >
        <LocaleProvider locale={locale}>
          {sesion && !incrustada ? <Header sesion={sesion} /> : null}
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
