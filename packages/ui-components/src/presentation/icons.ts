/** Catalogo de iconos, como DATO. */

export const ICON_STROKES = {
  // Cromo de la aplicacion.
  sandwich: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  'chevron-abajo': 'm7 10 5 5 5-5',
  // Acciones del modulo.
  marcador: 'M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z',
  exportar:
    'M12 4v10m0 0 3.5-3.5M12 14l-3.5-3.5M5 18v1.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V18',
  notice: 'M18 16.5V11a6 6 0 1 0-12 0v5.5L4.5 18h15zM10 21a2 2 0 0 0 4 0',
  embed: 'm9 18-6-6 6-6M15 6l6 6-6 6',
  view: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
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
  pastel: 'M12 21a9 9 0 1 0-9-9h9zM12 12V3a9 9 0 0 1 9 9z',
  dona: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 3v4.5',
  medidor: 'M3.5 18a8.5 8.5 0 1 1 17 0M12 18l4.5-5.5M12 18h.01',
  combinado: 'M3 21h18M6 19v-6M11 19V9M16 19v-8M5 9l5-4 6 3 3-4',
  dispersion: 'M4 20V4M4 20h16M8 15.5h.01M12 10h.01M15 16h.01M18 7h.01M10 6h.01',
  embudo: 'M3 5h18l-7 8v7l-4-2v-5z',
  cascada: 'M3 21h18M5 6h3v5H5zM10 9h3v5h-3zM15 13h3v5h-3z',
  histograma: 'M3 21h18M5 21v-6h3v6M8 21v-10h3v10M11 21v-7h3v7M14 21v-4h3v4',
  caja: 'M8 8h8v8H8zM8 12h8M12 4v4M12 16v4M9 4h6M9 20h6',
  flujo: 'M4 5h4c4 0 4 6 8 6h4M4 13h4c4 0 4 6 8 6h4M4 5v14',
  'mapa-de-calor': 'M4 4h5v5H4zM10 4h5v5h-5zM16 4h4v5h-4zM4 10h5v5H4zM10 10h5v5h-5zM16 10h4v5h-4zM4 16h5v4H4zM10 16h5v4h-5zM16 16h4v4h-4z',
  arbol: 'M4 5h16v14H4zM13 5v14M13 12h7',
  tabla: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  filtro: 'M4 5h16l-6 7v6l-4 2v-8z',
  // Elementos: no miden nada, componen.
  content: 'M5 6V4h14v2M12 4v16M9 20h6',
  titulo: 'M4 7h16M4 12h9M4 17h13',
  line: 'M4 12h16',
  forma: 'M5 5h14v14H5z',
  conexion: 'M4 7h6v10h10M20 17l-3-3M20 17l-3 3',
  contenedor: 'M4 5h16v14H4zM4 9h16M9 9v10',
  tabs: 'M4 8h6V5h10v14H4zM4 8v11',
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
  // Acciones de una fila de tabla.
  editar: 'M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L4 18v2zM14 8l3 3',
  ojo: 'M12 5C5 5 2 12 2 12s3 7 10 7 10-7 10-7-3-7-10-7zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z',
  'ojo-tachado':
    'M12 5C5 5 2 12 2 12s3 7 10 7 10-7 10-7-3-7-10-7zM12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6zM4 4l16 16',
  // Una lupa. El buscador llevaba el icono de «ver» —una persona— porque no habia lupa en el
  // catalogo, y una persona delante de un campo de texto no dice «buscar», dice «usuario».
  /*
   * Plegar y desplegar un panel lateral: un rectangulo con su carril y una flecha.
   *
   * Dos iconos y no uno girado. El giro por CSS parece la economia obvia y no lo es: la flecha
   * apunta hacia DENTRO al plegar y hacia FUERA al desplegar, y girar 180 grados el mismo dibujo
   * deja el carril al otro lado — el panel de la izquierda pasaria a dibujarse como si estuviera
   * a la derecha.
   */
  'plegar-panel': 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 5v14M17 9l-3 3 3 3',
  'desplegar-panel':
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 5v14M14 9l3 3-3 3',
  lupa: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  /*
   * Los dos complementos que no tenian icono propio.
   *
   * El pie de pagina es la caja del objeto con una banda separada abajo, que es literalmente lo
   * que hace; el paginado, una hoja entre dos flechas. Ninguno reutiliza otro icono: `content`
   * para el pie diria «texto» —que es lo que un cuadro de texto ya dice— y `tabs` para el
   * paginado diria «pestanas», que es un contenedor distinto y esta a dos lineas de aqui.
   */
  'pie-de-pagina': 'M4 4h16v16H4zM4 15h16M7 18h7',
  paginado: 'M9 5h6v14H9zM6 9l-2 3 2 3M18 9l2 3-2 3',
  // Acciones sobre una fila del arbol: mover, configurar, permisos.
  'flecha-arriba': 'M12 20V5M6 11l6-6 6 6',
  'flecha-abajo': 'M12 4v15M6 13l6 6 6-6',
  /*
   * «Mover a»: una carpeta con una flecha hacia la derecha DENTRO.
   *
   * Antes era la misma carpeta con una flecha hacia arriba y no se entendia: al lado de las dos
   * flechas de subir y bajar parecia una tercera flecha, y lo que hace no es mover una posicion
   * sino llevar a otro sitio del arbol. La flecha horizontal, dentro de la carpeta, dice «va a
   * parar aqui dentro».
   */
  mover: 'M4 6h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8.5 14.5h7M13 12l2.5 2.5L13 17',
  /*
   * El engranaje de Lucide, no uno dibujado a mano.
   *
   * Dos intentos propios antes: la tuerca clasica de ocho dientes se funde en una mancha a 18 px,
   * y el circulo con radios se lee como un sol. Un engranaje legible a ese tamano no es un dibujo
   * geometrico, son doce arcos calculados — y eso ya esta resuelto. Se copia el trazado, no se
   * anade una dependencia: el principio 1 dice que el navegador no habla con nadie mas, y eso
   * incluye una fuente de iconos de un tercero.
   *
   * Lucide, licencia ISC — https://lucide.dev. Consta en `NOTICE`, que es donde se conserva la
   * atribucion. El `<circle>` del original va aqui como arco, porque este catalogo es de trazados.
   */
  tuerca:
    'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  /*
   * Ciclo de vida de un modulo publicado.
   *
   * Los tres se dibujan aparte y no se reaprovechan de los que ya hay. `ojo-tachado` ya
   * significa «oculto en la navegacion», que es reversible y no cambia el estado del modulo;
   * usarlo tambien para retirar habria puesto el mismo dibujo en dos acciones que un
   * Administrador tiene que poder distinguir de un vistazo.
   */
  // Una caja con una flecha que entra: sale de la vista y queda guardado.
  retirar: 'M4 8.5h16M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5M6 8.5 8 4.5h8l2 4M12 11.5v4.5m0 0 2-2m-2 2-2-2',
  // Una flecha que vuelve sobre un arco: deshacer lo retirado.
  restablecer: 'M4 12a8 8 0 1 1 2.5 5.8M4 8v4.5h4.5',
  // Una papelera: borrado definitivo, del que no se vuelve.
  papelera: 'M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7v12a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7M10 11v6M14 11v6',
  /*
   * Una persona con un engranaje: gestionar QUIEN esta dentro de un equipo.
   *
   * Distinto de `persona-ojo`, que es quien VE algo, y de `tuerca` a secas, que es lo que ese
   * algo puede hacer. Las tres van juntas en la misma fila de la tabla de equipos, asi que
   * tienen que distinguirse a dieciocho pixeles.
   */
  'persona-tuerca':
    'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 9-5.2M17.5 14.2a1.4 1.4 0 0 1 2.8 0 1.4 1.4 0 0 0 2 1.15 1.4 1.4 0 0 1-1.4 2.42 1.4 1.4 0 0 0 0 2.3 1.4 1.4 0 0 1-2 1.16 1.4 1.4 0 0 0-2.8 0 1.4 1.4 0 0 1-2-1.15 1.4 1.4 0 0 0 0-2.3 1.4 1.4 0 0 1 1.4-2.43 1.4 1.4 0 0 0 2-1.15M18.9 17.4v.01',
  // Una persona con un ojo: gestionar QUIEN ve esto. El `view` de al lado es solo la persona.
  'persona-ojo':
    'M9.5 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6.5 6.5 0 0 1 11-4.7M14 18.5s2-3 4.5-3 4.5 3 4.5 3-2 3-4.5 3-4.5-3-4.5-3zM18.5 19v.4',
} as const;

export type IconName = keyof typeof ICON_STROKES;

export const ICON_NAMES = Object.keys(ICON_STROKES) as IconName[];

export const iconNameIs = (valor: unknown): valor is IconName =>
  typeof valor === 'string' && valor in ICON_STROKES;

/** Los iconos que se ofrecen para rotular un objeto. */
export const OBJECT_ICONS: IconName[] = [
  'indicador',
  'barras',
  'lineas',
  'pastel',
  'dona',
  'medidor',
  'combinado',
  'dispersion',
  'embudo',
  'cascada',
  'histograma',
  'caja',
  'mapa-de-calor',
  'flujo',
  'arbol',
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
