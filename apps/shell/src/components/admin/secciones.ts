import type { NombreDeIcono } from '../iconos/Icono';

/**
 * Las siete superficies de administracion (4.10.8), agrupadas por lo que se va a hacer.
 *
 * Estaban en una lista plana de siete. Siete elementos indistinguibles superan lo que alguien
 * recorre de un vistazo, y ademas mezclaban tres cosas que no se hacen en el mismo momento:
 * ordenar la institucion, dar acceso a personas, y comprobar que lo anterior quedo bien. Con los
 * grupos, quien entra a «revisar quien ve que» no recorre antes las cuatro de configurar.
 *
 * Vive aparte del layout porque lo consumen tanto el carril como el rotulo de la cabecera, y con
 * dos copias el dia que se renombre una seccion se renombraria solo en uno de los dos sitios.
 */

export interface SeccionDeAdmin {
  href: string;
  label: string;
  /** Que se hace aqui. Va en el DESTINO, no en el carril: ahi se lee una vez y estorba siempre. */
  desc: string;
  icono: NombreDeIcono;
  /**
   * De donde sale el numero del indicador, si lo tiene.
   *
   * Solo donde un numero PIDE atencion, no para decorar: las ampliaciones de ambito deberian
   * tender a cero (§7) y la papelera acumula lo borrado. Un indicador en cada seccion los volveria
   * a todos invisibles.
   */
  indicador?: 'ampliaciones' | 'papelera';
}

export interface GrupoDeAdmin {
  id: string;
  titulo: string;
  secciones: SeccionDeAdmin[];
}

/**
 * El resumen, fuera de los grupos.
 *
 * Va suelto y primero porque no es una de las siete superficies: es el punto de partida. Sin el,
 * quien aterriza en /admin no ve NADA marcado en el carril —no hay forma de saber donde esta— y
 * para volver aqui desde cualquier seccion hay que dar con el titulo de la cabecera.
 */
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
    secciones: [
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
    secciones: [
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
    secciones: [
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

export const SECCIONES: SeccionDeAdmin[] = [RESUMEN, ...GRUPOS.flatMap((g) => g.secciones)];

/**
 * La seccion a la que pertenece una ruta.
 *
 * Por prefijo: `/admin/equipos/e-1/miembros` sigue siendo «Equipos y membresia». Se ordena de
 * mas larga a mas corta para que una ruta anidada no la reclame una seccion de prefijo mas corto.
 */
export function seccionDe(ruta: string): SeccionDeAdmin | undefined {
  return [...SECCIONES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => ruta === s.href || ruta.startsWith(`${s.href}/`));
}

/**
 * La seccion que se marca en el carril.
 *
 * El resumen solo se marca en la ruta EXACTA. Con la regla de prefijo, `/admin` reclamaria
 * `/admin/equipos` y se verian dos entradas activas a la vez.
 */
export function seccionActivaEn(ruta: string): SeccionDeAdmin | undefined {
  return ruta === RESUMEN.href ? RESUMEN : GRUPOS.flatMap((g) => g.secciones).find(
    (s) => ruta === s.href || ruta.startsWith(`${s.href}/`),
  );
}
