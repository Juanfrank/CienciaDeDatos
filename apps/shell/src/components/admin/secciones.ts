import type { IconName } from '../iconos/Icono';

/** Las siete superficies de administracion (4.10.8), agrupadas por lo que se va a hacer. */

export interface SeccionDeAdmin {
  href: string;
  label: string;
  /** Que se hace aqui. Va en el DESTINO, no en el carril: ahi se lee una vez y estorba siempre. */
  desc: string;
  icono: IconName;
  /** De donde sale el numero del indicador, si lo tiene. */
  indicador?: 'ampliaciones' | 'papelera';
}

export interface GrupoDeAdmin {
  id: string;
  titulo: string;
  sections: SeccionDeAdmin[];
}

/** El resumen, fuera de los grupos. */
export const RESUMEN: SeccionDeAdmin = {
  href: '/admin',
  label: 'Resumen',
  desc: 'El estado del gobierno de un vistazo.',
  icono: 'indicador',
};

export const GRUPOS: GrupoDeAdmin[] = [
  {
    id: 'estructura',
    titulo: 'Estructura',
    sections: [
      {
        href: '/admin/arbol',
        label: 'Organizacion general',
        desc: 'La estructura canonica: donde vive cada modulo y que ambito hereda.',
        icono: 'carpeta',
        indicador: 'papelera',
      },
      {
        href: '/admin/paquetes',
        label: 'Paquetes visuales',
        desc: 'Reagrupan lo ya accesible para una audiencia. Nunca conceden nada nuevo.',
        icono: 'paquete',
      },
    ],
  },
  {
    id: 'acceso',
    titulo: 'Acceso',
    sections: [
      {
        href: '/admin/equipos',
        label: 'Equipos y membresia',
        desc: 'La unidad de agrupacion para el acceso a modulos y el ambito de datos.',
        icono: 'personas',
      },
      {
        href: '/admin/ambitos',
        label: 'Ambitos de acceso',
        desc: 'El filtro de negocio que se aplica a los datos de quien mira.',
        icono: 'ambito',
      },
      {
        href: '/admin/cuentas',
        label: 'Cuentas locales',
        desc: 'La excepcion, no la via por defecto.',
        icono: 'llave',
      },
    ],
  },
  {
    id: 'supervision',
    titulo: 'Supervision',
    sections: [
      {
        href: '/admin/quien-ve-que',
        label: 'Quien ve que',
        desc: 'El ambito efectivo de una persona sobre un modulo, y que carpeta lo origino.',
        icono: 'vista',
      },
      {
        href: '/admin/auditoria',
        label: 'Auditoria',
        desc: 'Cambios de configuracion, con las ampliaciones destacadas aparte.',
        icono: 'registro',
        indicador: 'ampliaciones',
      },
    ],
  },
];

export const SECCIONES: SeccionDeAdmin[] = [RESUMEN, ...GRUPOS.flatMap((g) => g.sections)];

/** La seccion a la que pertenece una ruta. */
export function seccionDe(path: string): SeccionDeAdmin | undefined {
  return [...SECCIONES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => path === s.href || path.startsWith(`${s.href}/`));
}

/** La seccion que se marca en el carril. */
export function seccionActivaEn(path: string): SeccionDeAdmin | undefined {
  return path === RESUMEN.href ? RESUMEN : GRUPOS.flatMap((g) => g.sections).find(
    (s) => path === s.href || path.startsWith(`${s.href}/`),
  );
}
