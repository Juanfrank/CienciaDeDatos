import { defaultIdentity } from '@app/design-tokens';

/**
 * Disposicion de una vista incrustada — seccion 4.9.
 *
 * Sin arbol de navegacion, sin selector de equipo y sin campana: dentro del portal anfitrion
 * esos controles no llevan a ningun sitio util y compiten con la navegacion del propio portal.
 *
 * Lo que SI se conserva es la identidad institucional y, en la propia vista, la procedencia
 * (4.6) y la marca de tiempo del dato (4.8). Un grafico incrustado en otro portal es justo el
 * caso en el que mas falta hacen: quien lo mira ya no tiene alrededor la aplicacion que le diga
 * de donde salen las cifras ni de cuando son.
 */
export default function IncrustadoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="incrustado">
      <header className="incrustado__cabecera">
        <img
          className="incrustado__emblema"
          src={defaultIdentity.emblem.src}
          width={defaultIdentity.emblem.width}
          height={defaultIdentity.emblem.height}
          alt=""
        />
        <span className="incrustado__institucion">{defaultIdentity.name}</span>
      </header>
      <main className="incrustado__cuerpo">{children}</main>
    </div>
  );
}
