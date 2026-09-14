import Link from 'next/link';
import { Icon } from '../icons/Icon';
import type { AdminSection } from './sections';

/**
 * La portada de una seccion que tiene hijas.
 *
 * Una seccion con submenus necesita una pagina propia: si no, al pulsarla en el carril no pasa
 * nada, o hay que adivinar cual de las hijas es «la principal». Aqui se ve de que va cada una y
 * se entra sabiendo a donde.
 */
export function SectionIndex({ sections }: { sections: AdminSection[] }) {
  return (
    <ul className="section-index" data-testid="indice-de-seccion">
      {sections.map((s) => (
        <li key={s.href}>
          <Link href={s.href} className="section-index__card" data-testid={`ir-a-${s.href.split('/').pop()}`}>
            <span className="section-index__icon">
              <Icon nombre={s.icono} tamano={20} />
            </span>
            <span>
              <b>{s.label}</b>
              <span className="muted-text">{s.desc}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
