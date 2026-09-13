'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icono } from '../iconos/Icono';
import { GRUPOS, RESUMEN, type SeccionDeAdmin, seccionActivaEn, seccionDe } from './secciones';

/** El carril de administracion. */

export interface Indicadores {
  ampliaciones: number;
  papelera: number;
}

export function CarrilDeAdmin({ indicadores, id }: { indicadores: Indicadores; id: string }) {
  const path = usePathname();
  const actual = seccionActivaEn(path);

  return (
    <nav className="admin__nav" id={id} aria-label="Secciones de administracion">
      <ul className="admin__grupo">
        <li>
          <EnlaceDeSeccion section={RESUMEN} activo={actual?.href === RESUMEN.href} cuenta={0} />
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
            {grupo.sections.map((s) => (
              <li key={s.href}>
                <EnlaceDeSeccion
                  section={s}
                  activo={actual?.href === s.href}
                  cuenta={s.indicador ? indicadores[s.indicador] : 0}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function EnlaceDeSeccion({
  section,
  activo,
  cuenta,
}: {
  section: SeccionDeAdmin;
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
      <Icono nombre={section.icono} tamano={20} />
      <span className="admin__nav-label">{section.label}</span>
      {cuenta > 0 ? (
        /*
         * El numero no puede ser el unico portador de la informacion (1.4.1): el texto accesible
         * dice de QUE son, porque «3» junto a «Auditoria» no significa nada por si solo.
         */
        <span className="admin__nav-indicador" data-testid={`indicador-${section.indicador}`}>
          <span aria-hidden="true">{cuenta > 99 ? '99+' : cuenta}</span>
          <span className="visualmente-oculto">
            {cuenta} {section.indicador === 'ampliaciones' ? 'ampliaciones vigentes' : 'en papelera'}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

/** El nombre de la seccion actual, en la cabecera. */
export function SeccionActual() {
  const section = seccionDe(usePathname());
  // En el resumen no se anade nada: «Administracion / Resumen» repite lo que el titulo ya dice.
  if (!section || section.href === RESUMEN.href) return null;

  return (
    <>
      <span className="admin__ruta-sep" aria-hidden="true">
        /
      </span>
      <span className="admin__ruta-actual" data-testid="admin-seccion-actual">
        {section.label}
      </span>
    </>
  );
}
