'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '../icons/Icon';
import { GRUPOS, RESUMEN, type AdminSection, activeSectionIn, sectionOf } from './sections';

/** El carril de administracion. */

export interface Indicadores {
  ampliaciones: number;
  papelera: number;
  /** Modulos propuestos y esperando una decision. */
  borradores: number;
}

export function AdminRail({ indicadores, id }: { indicadores: Indicadores; id: string }) {
  const path = usePathname();
  const actual = activeSectionIn(path);

  return (
    <nav className="admin__nav" id={id} aria-label="Secciones de administracion">
      <ul className="admin__grupo">
        <li>
          <SectionLink section={RESUMEN} activo={actual?.href === RESUMEN.href} cuenta={0} />
        </li>
      </ul>

      {GRUPOS.map((grupo) => (
        <div key={grupo.id} className="admin__grupo">
          {/*
            El titulo del grupo ETIQUETA la lista, no es solo un rotulo suelto: con
            `aria-labelledby`, quien navega con lector oye «Acceso, lista de tres elementos» al
            entrar, en vez de recorrer siete enlaces sin saber donde empieza cada bloque.
          */}
          <h2 className="admin__grupo-titulo" id={`grupo-${grupo.id}`}>
            {grupo.titulo}
          </h2>
          <ul aria-labelledby={`grupo-${grupo.id}`}>
            {grupo.sections.filter((s) => !s.oculta).map((s) => {
              const dentro = actual?.href === s.href;
              return (
                <li key={s.href}>
                  <SectionLink
                    section={s}
                    activo={dentro}
                    cuenta={s.indicador ? indicadores[s.indicador] : 0}
                  />
                  {/*
                    Las hijas solo se despliegan DENTRO de su madre.
                    Listarlas siempre convertiria el carril en catorce enlaces donde hoy hay
                    nueve, y las de Recursos no sirven de nada mientras se administran equipos.
                  */}
                  {dentro && s.hijas?.some((h) => !h.oculta) ? (
                    <ul className="admin__hijas" data-testid={`submenu-${s.href.split('/').pop()}`}>
                      {s.hijas.filter((h) => !h.oculta).map((hija) => (
                        <li key={hija.href}>
                          <SectionLink section={hija} activo={path === hija.href} cuenta={0} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SectionLink({
  section,
  activo,
  cuenta,
}: {
  section: AdminSection;
  activo: boolean;
  cuenta: number;
}) {
  return (
    <Link
      href={section.href}
      // El CSS se cuelga de `aria-current`, el MISMO atributo que anuncia el lector de pantalla,
      // no de una clase aparte: asi no puede darse que se vea marcada una seccion y se anuncie otra.
      aria-current={activo ? 'page' : undefined}
      data-testid={`admin-nav-${section.href.split('/').pop()}`}
      // La descripcion sale del carril y pasa a `title`: se lee una vez y despues estorba en cada
      // vistazo. Quien la necesite la tiene al pasar el raton, y entera en la propia seccion.
      title={section.desc}
    >
      <Icon nombre={section.icono} tamano={20} />
      <span className="admin__nav-label">{section.label}</span>
      {cuenta > 0 ? (
        /*
         * El numero no puede ser el unico portador de la informacion (1.4.1): el texto accesible
         * dice de QUE son, porque «3» junto a «Auditoria» no significa nada por si solo.
         */
        <span className="admin__indicator-nav" data-testid={`indicator-${section.indicador}`}>
          <span aria-hidden="true">{cuenta > 99 ? '99+' : cuenta}</span>
          <span className="visualmente-oculto">
            {cuenta}{' '}
            {section.indicador === 'ampliaciones' ? 'ampliaciones vigentes' : 'en papelera'}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

/** El nombre de la seccion actual, en la cabecera. */
export function CurrentSection() {
  const section = sectionOf(usePathname());
  // En el resumen no se anade nada: «Administracion / Resumen» repite lo que el titulo ya dice.
  if (!section || section.href === RESUMEN.href) return null;

  return (
    <>
      <span className="admin__path-sep" aria-hidden="true">
        /
      </span>
      <span className="admin__path-actual" data-testid="admin-section-current">
        {section.label}
      </span>
    </>
  );
}
