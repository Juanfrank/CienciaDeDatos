import type { MessageKey } from './es';

/**
 * Catalogo en ingles.
 *
 * El tipo `Record<MessageKey, string>` lo ata al de referencia: una clave nueva en espanol es
 * un error de compilacion aqui hasta que se traduce, y una clave que sobra tambien. Una prueba
 * comprueba ademas que los argumentos ICU de cada mensaje coinciden entre los dos idiomas, que es
 * lo que el tipo no puede ver.
 */
export const en: Record<MessageKey, string> = {
  'app.nombre': 'Visualization layer',
  'app.institucion': 'Judiciary of the Dominican Republic',

  'accion.guardar': 'Save',
  'accion.cancelar': 'Cancel',
  'accion.cerrar': 'Close',
  'accion.anadir': 'Add',
  'accion.quitar': 'Remove',
  'accion.buscar': 'Search',
  'accion.exportar': 'Export',
  'accion.reintentar': 'Retry',
  'accion.verTodo': 'View all',

  'estado.cargando': 'Loading',
  'estado.guardando': 'Saving',
  'estado.guardado': 'Saved',
  'estado.sinResultados': 'No results match "{consulta}"',
  'estado.sinPermiso': 'You do not have permission to view this',
  'estado.noEncontrado': 'What was requested could not be found',

  'objeto.roto': 'Broken object',
  'objeto.rotoDetalle':
    '{faltan, plural, one {Field {campos} is missing} other {Fields {campos} are missing}} from the dataset.',
  'objeto.sinDatos': 'No data within the current scope',
  'objeto.datosDe': 'Data for {titulo}',
  'objeto.filtrarPor': 'Filter by {valor}',

  'grafico.escala': 'Scale',
  'grafico.objetivo': 'Target',
  'grafico.diferencia': 'Difference',
  'grafico.total': 'Total',
  'grafico.omitidos':
    '{n, plural, one {# panel is omitted} other {# panels are omitted}} beyond the limit of {maximo}.',

  'editor.pestana.objetos': 'Objects',
  'editor.pestana.datos': 'Data',
  'editor.pestana.formato': 'Format',
  'editor.pestana.complementos': 'Add-ons',
  'editor.buscarObjeto': 'Search for an object',
  'editor.buscarAjuste': 'Search for a setting',
  'editor.sinObjetos': 'No object matches "{consulta}"',
  'editor.mapeeMedida': 'Map at least one measure before choosing its colour.',

  'familia.valor': 'A single figure',
  'familia.comparacion': 'Compare across categories',
  'familia.evolucion': 'See how it changes over time',
  'familia.proporcion': 'Break down a total',
  'familia.relacion': 'Two measures at once',
  'familia.detalle': 'The data, row by row',
  'familia.ubicacion': 'Where',
  'familia.control': 'Filter',

  'ambito.restringido':
    '{n, plural, one {One scope restriction applies} other {# scope restrictions apply}} to this view.',
  'ambito.origen': 'Imposed by {carpeta}',

  'exportacion.encolada': 'The export is queued',
  'exportacion.lista': 'The export is ready',
  'exportacion.fallida': 'The export failed',

  'acceso.correo': 'Institutional email',
  'acceso.clave': 'Password',
  'acceso.codigo': 'Verification code',
  'acceso.entrar': 'Sign in',
  'acceso.credencialesInvalidas': 'The email or password is incorrect',
};
