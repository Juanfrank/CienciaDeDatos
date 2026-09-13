import { defaultIdentity } from '@app/design-tokens';

/** Disposicion de una vista incrustada — seccion 4.9. */
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
