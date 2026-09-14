import { defaultIdentity } from '@app/design-tokens';

/** Disposicion de una vista incrustada — seccion 4.9. */
export default function LayoutEmbedded({ children }: { children: React.ReactNode }) {
  return (
    <div className="incrustado">
      <header className="embedded__header">
        <img
          className="embedded__emblema"
          src={defaultIdentity.emblem.src}
          width={defaultIdentity.emblem.width}
          height={defaultIdentity.emblem.height}
          alt=""
        />
        <span className="embedded__institucion">{defaultIdentity.name}</span>
      </header>
      <main className="embedded__body">{children}</main>
    </div>
  );
}
