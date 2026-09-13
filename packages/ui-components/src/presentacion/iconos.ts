/**
 * Catalogo de iconos, como DATO.
 *
 * Los trazos viven aqui, en una libreria pura, y no junto al componente de React que los dibuja,
 * por un motivo concreto: el nombre del icono es parte de la configuracion de un objeto, y la
 * validacion tiene que poder rechazar un nombre que no existe ANTES de guardar, no descubrirlo al
 * dibujar. 4.2 pide exactamente eso del mapeo, y un icono elegido en el editor es mapeo tambien.
 *
 * Son trazos, no rellenos: con `stroke="currentColor"` un icono hereda el color del sitio donde
 * se pone y sigue al tema oscuro sin declarar nada.
 */

export const TRAZOS_DE_ICONO = {
  // Cromo de la aplicacion.
  sandwich: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
  'chevron-abajo': 'm7 10 5 5 5-5',
  // Acciones del modulo.
  marcador: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z',
  exportar:
    'M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18v1.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V18',
  aviso: 'M18 16.5V11a6 6 0 1 0-12 0v5.5L4.5 18h15zM10 21a2 2 0 0 0 4 0',
  incrustar: 'm9 18-6-6 6-6M15 6l6 6-6 6',
  vista: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  ambito: 'M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z',
  // Complementos.
  informacion: 'M12 11v5M12 7.6v.4',
  datos: 'M4.5 5.5h15v13h-15zM4.5 10h15M4.5 14.5h15M10 5.5v13',
  // Secciones de administracion. Cada una necesita una silueta distinta: el icono es lo que
  // permite volver a un sitio conocido sin releer siete rotulos parecidos.
  carpeta: 'M4 6h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z',
  paquete: 'M12 3 21 7.5v9L12 21 3 16.5v-9zM3 7.5 12 12l9-4.5M12 12v9',
  llave: 'M14 10a4 4 0 1 1-3.9 5H8v2H6v2H3v-3l7.1-7.1A4 4 0 0 1 14 10zM16 13v.01',
  registro: 'M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM15 4v4h4M8 12h8M8 16h5',
  // Contenedores y ampliacion.
  expandir: 'M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6',
  // Tipos de objeto. Sirven de icono por defecto de cada uno.
  indicador: 'M4 18V9M10 18V5M16 18v-6M20 18H4',
  barras: 'M5 19V10M11 19V5M17 19v-7M3 21h18',
  lineas: 'M4 16l4-5 4 3 5-7M4 20h16',
  'barras-horizontales': 'M5 5h11M5 10h7M5 15h14M5 20h4M3 3v18',
  area: 'M3 19l5-7 4 3 5-8 4 4v8z',
  tabla: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  filtro: 'M4 5h16l-6 7v6l-4 2v-8z',
  // Elementos: no miden nada, componen.
  texto: 'M5 6V4h14v2M12 4v16M9 20h6',
  titulo: 'M4 7h16M4 12h9M4 17h13',
  linea: 'M4 12h16',
  forma: 'M5 5h14v14H5z',
  conexion: 'M4 7h6v10h10M20 17l-3-3M20 17l-3 3',
  contenedor: 'M4 5h16v14H4zM4 9h16M9 9v10',
  pestanas: 'M4 8h6V5h10v14H4zM4 8v11',
  calendario:
    'M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM4 10h16M8 4v4M16 4v4',
  // Vocabulario de dominio, para rotular una tarjeta por lo que mide.
  expediente: 'M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 4v5h5',
  balanza: 'M12 4v16M7 20h10M5 8h14M5 8l-2.5 5.5a3 3 0 0 0 5 0zM19 8l2.5 5.5a3 3 0 0 1-5 0z',
  reloj: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  personas:
    'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 5.6a3.5 3.5 0 0 1 0 6.8M18 14.4a6.5 6.5 0 0 1 3.5 5.6',
  alza: 'M4 17l6-6 4 4 6-7M15 8h5v5',
  baja: 'M4 7l6 6 4-4 6 7M15 16h5v-5',
  aviso_triangulo: 'M12 4.5 2.8 20h18.4zM12 10v4.5M12 17v.4',
  lugar: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const;

export type NombreDeIcono = keyof typeof TRAZOS_DE_ICONO;

export const NOMBRES_DE_ICONO = Object.keys(TRAZOS_DE_ICONO) as NombreDeIcono[];

export const esNombreDeIcono = (valor: unknown): valor is NombreDeIcono =>
  typeof valor === 'string' && valor in TRAZOS_DE_ICONO;

/**
 * Los iconos que se ofrecen para rotular un objeto.
 *
 * Es un subconjunto del catalogo a proposito: el cromo de la aplicacion —el sandwich, el aspa de
 * cerrar— no significa nada sobre un dato, y ofrecerlo en el editor solo invita a poner un aspa
 * de cerrar encima de una cifra.
 */
export const ICONOS_DE_OBJETO: NombreDeIcono[] = [
  'indicador',
  'barras',
  'lineas',
  'tabla',
  'filtro',
  'calendario',
  'expediente',
  'balanza',
  'reloj',
  'personas',
  'alza',
  'baja',
  'aviso_triangulo',
  'lugar',
  'marcador',
  'ambito',
];
