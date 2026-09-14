import type { IconName } from '../icons/Icon';

/**
 * El panel de administracion, agrupado por lo que se administra (4.10.8).
 *
 * La organizacion anterior agrupaba por CONCEPTO —estructura, acceso, supervision— y obligaba a
 * saber en que concepto cae lo que uno busca: los permisos de un equipo estaban en «Acceso», el
 * arbol donde viven los modulos en «Estructura», y quien quisiera cambiar las dos cosas de un
 * equipo pasaba por dos sitios.
 *
 * Ahora se agrupa por el OBJETO que se administra —modulos, recursos, usuarios, equipos,
 * temas, origenes de datos—, que es como se formula la peticion: «quiero cambiar los permisos de
 * Ana», no «quiero ir a la seccion de acceso». Supervision se queda aparte porque no administra
 * nada: mira.
 */

export interface AdminSection {
  href: string;
  label: string;
  /** Que se hace aqui. Va en el DESTINO, no en el carril: ahi se lee una vez y estorba siempre. */
  desc: string;
  icono: IconName;
  /** De donde sale el numero del indicador, si lo tiene. */
  indicador?: 'ampliaciones' | 'papelera' | 'borradores';
  /** Las paginas que cuelgan de esta seccion y comparten su entrada en el carril. */
  hijas?: AdminSection[];
}

export interface GrupoDeAdmin {
  id: string;
  titulo: string;
  sections: AdminSection[];
}

/** El resumen, fuera de los grupos. */
export const RESUMEN: AdminSection = {
  href: '/admin',
  label: 'Resumen',
  desc: 'El estado del gobierno de un vistazo.',
  icono: 'indicador',
};

export const GRUPOS: GrupoDeAdmin[] = [
  {
    id: 'contenido',
    titulo: 'Contenido',
    sections: [
      {
        href: '/admin/modules',
        label: 'Modulos',
        desc:
          'El arbol de navegacion, los modulos que cuelgan de el, sus versiones y que puede ' +
          'hacer cada quien con ellos.',
        icono: 'carpeta',
        indicador: 'papelera',
        hijas: [
          {
            href: '/admin/modules/pending',
            label: 'Propuestas por revisar',
            desc: 'Lo que espera una decision, con quien lo propuso y que cambia respecto a lo publicado.',
            icono: 'reloj',
          },
          {
            href: '/admin/modules/tree',
            label: 'Organizacion general',
            desc: 'La estructura canonica: donde vive cada modulo y que ambito hereda.',
            icono: 'carpeta',
          },
          {
            href: '/admin/modules/packages',
            label: 'Paquetes visuales',
            desc: 'Reagrupan lo ya accesible para una audiencia. Nunca conceden nada nuevo.',
            icono: 'paquete',
          },
        ],
      },
      {
        href: '/admin/resources',
        label: 'Recursos',
        desc:
          'Lo que un modulo puede COLOCAR: visualizaciones, elementos, contenedores, ' +
          'complementos y los recursos sueltos.',
        icono: 'paquete',
        hijas: [
          {
            href: '/admin/resources/proposals',
            label: 'Propuestas del catalogo',
            desc: 'Que version de que objeto se propone certificar, quien la propuso y que cambia.',
            icono: 'reloj',
          },
          {
            href: '/admin/resources/visualizations',
            label: 'Visualizaciones',
            desc: 'Los objetos que leen datos de un dataset certificado.',
            icono: 'barras',
          },
          {
            href: '/admin/resources/elements',
            label: 'Elementos',
            desc: 'Lo que compone la pagina sin leer datos: texto, titulos, lineas, formas.',
            icono: 'titulo',
          },
          {
            href: '/admin/resources/containers',
            label: 'Contenedores',
            desc: 'Agrupan objetos en su propia rejilla.',
            icono: 'contenedor',
          },
          {
            href: '/admin/resources/addons',
            label: 'Complementos',
            desc: 'Se adjuntan a un objeto y no amplian lo que se puede ver.',
            icono: 'informacion',
          },
          {
            href: '/admin/resources/other',
            label: 'Otros recursos',
            desc: 'Iconos, imagenes, SVG y geometrias de mapa.',
            icono: 'lugar',
          },
        ],
      },
      {
        href: '/admin/themes',
        label: 'Temas',
        desc: 'La identidad visual: color, tipografia y forma. Versionada como todo lo demas.',
        icono: 'view',
      },
    ],
  },
  {
    id: 'personas',
    titulo: 'Personas',
    sections: [
      {
        href: '/admin/users',
        label: 'Usuarios',
        desc: 'Quien es cada quien, a que equipos pertenece y con que rol en cada uno.',
        icono: 'personas',
        hijas: [
          {
            href: '/admin/users/permissions',
            label: 'Roles y permisos',
            desc: 'Que puede cada uno de los tres roles, dibujado desde el codigo que lo decide.',
            icono: 'llave',
          },
        ],
      },
      {
        href: '/admin/teams',
        label: 'Equipos',
        desc: 'La unidad de agrupacion para el acceso a modulos y el ambito de datos.',
        icono: 'personas',
      },
      {
        href: '/admin/accounts',
        label: 'Cuentas locales',
        desc: 'La excepcion, no la via por defecto.',
        icono: 'llave',
      },
    ],
  },
  {
    id: 'datos',
    titulo: 'Datos',
    sections: [
      {
        href: '/admin/sources',
        label: 'Origenes de datos',
        desc: 'De donde sale lo que se dibuja, y si esta alcanzable.',
        icono: 'datos',
      },
      {
        href: '/admin/scopes',
        label: 'Ambitos de acceso',
        desc: 'El filtro de negocio que se aplica a los datos de quien mira.',
        icono: 'ambito',
      },
    ],
  },
  {
    id: 'supervision',
    titulo: 'Supervision',
    sections: [
      {
        href: '/admin/who-sees-what',
        label: 'Quien ve que',
        desc: 'El ambito efectivo de una persona sobre un modulo, y que carpeta lo origino.',
        icono: 'view',
      },
      {
        href: '/admin/audit',
        label: 'Auditoria',
        desc: 'Cambios de configuracion, con las ampliaciones destacadas aparte.',
        icono: 'registro',
        indicador: 'ampliaciones',
      },
    ],
  },
];

/** Todas las secciones, incluidas las que cuelgan de otra. */
export const SECTIONS: AdminSection[] = [
  RESUMEN,
  ...GRUPOS.flatMap((g) => g.sections).flatMap((s) => [s, ...(s.hijas ?? [])]),
];

/** La seccion a la que pertenece una ruta. */
export function sectionOf(path: string): AdminSection | undefined {
  return [...SECTIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => path === s.href || path.startsWith(`${s.href}/`));
}

/**
 * La seccion que se marca en el carril.
 *
 * Una pagina hija marca a su MADRE: el carril ensena donde se esta, y `/admin/modules/tree` esta
 * en Modulos. Marcar la hija obligaria a que el carril listara todo el arbol de paginas.
 */
export function activeSectionIn(path: string): AdminSection | undefined {
  if (path === RESUMEN.href) return RESUMEN;
  return GRUPOS.flatMap((g) => g.sections).find(
    (s) => path === s.href || path.startsWith(`${s.href}/`),
  );
}
