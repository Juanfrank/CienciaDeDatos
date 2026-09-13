/**
 * Catalogo de referencia. El espanol se escribe primero y los demas idiomas se comparan contra el.
 *
 * Las claves son jerarquicas por area (`editor.pestana.datos`) y no por pantalla: una cadena que
 * se reutiliza en dos sitios tiene una clave, no dos. Lo que decide la clave es QUE dice el
 * mensaje, no donde aparece.
 *
 * Los mensajes son frases completas. Una cadena partida en trozos que el codigo concatena no se
 * puede traducir: el orden de las palabras cambia entre idiomas, y el traductor recibe fragmentos
 * sin contexto. Lo variable va como argumento ICU.
 */
export const es = {
  'app.nombre': 'Capa de visualizacion',
  'app.institucion': 'Poder Judicial de la Republica Dominicana',

  'accion.guardar': 'Guardar',
  'accion.cancelar': 'Cancelar',
  'accion.cerrar': 'Cerrar',
  'accion.anadir': 'Anadir',
  'accion.quitar': 'Quitar',
  'accion.buscar': 'Buscar',
  'accion.exportar': 'Exportar',
  'accion.reintentar': 'Reintentar',
  'accion.verTodo': 'Ver todo',

  'estado.cargando': 'Cargando',
  'estado.guardando': 'Guardando',
  'estado.guardado': 'Guardado',
  'estado.sinResultados': 'Ningun resultado coincide con «{consulta}»',
  'estado.sinPermiso': 'No tiene permiso para ver esto',
  'estado.noEncontrado': 'No se encontro lo que se pidio',

  'objeto.roto': 'Objeto roto',
  'objeto.rotoDetalle':
    '{faltan, plural, one {Falta el campo {campos}} other {Faltan los campos {campos}}} en el dataset.',
  'objeto.sinDatos': 'Sin datos para el ambito actual',
  'objeto.datosDe': 'Datos de {titulo}',
  'objeto.filtrarPor': 'Filtrar por {valor}',

  'grafico.escala': 'Escala',
  'grafico.objetivo': 'Objetivo',
  'grafico.diferencia': 'Diferencia',
  'grafico.total': 'Total',
  'grafico.omitidos':
    '{n, plural, one {Se omite # panel} other {Se omiten # paneles}} por encima del limite de {maximo}.',

  'editor.pestana.objetos': 'Objetos',
  'editor.pestana.datos': 'Datos',
  'editor.pestana.formato': 'Formato',
  'editor.pestana.complementos': 'Complementos',
  'editor.buscarObjeto': 'Buscar un objeto',
  'editor.buscarAjuste': 'Buscar un ajuste',
  'editor.sinObjetos': 'Ningun objeto coincide con «{consulta}»',
  'editor.mapeeMedida': 'Mapee al menos una medida para poder darle color.',

  'familia.valor': 'Una sola cifra',
  'familia.comparacion': 'Comparar entre categorias',
  'familia.evolucion': 'Ver como cambia en el tiempo',
  'familia.proporcion': 'Repartir un total',
  'familia.relacion': 'Dos medidas a la vez',
  'familia.detalle': 'El dato, fila a fila',
  'familia.ubicacion': 'Donde',
  'familia.control': 'Filtrar',

  'ambito.restringido':
    '{n, plural, one {Una restriccion de ambito} other {# restricciones de ambito}} se aplican a esta vista.',
  'ambito.origen': 'Lo impone {carpeta}',

  'exportacion.encolada': 'La exportacion esta en cola',
  'exportacion.lista': 'La exportacion esta lista',
  'exportacion.fallida': 'La exportacion fallo',

  'acceso.correo': 'Correo institucional',
  'acceso.clave': 'Contrasena',
  'acceso.codigo': 'Codigo de verificacion',
  'acceso.entrar': 'Entrar',
  'acceso.credencialesInvalidas': 'El correo o la contrasena no son correctos',
} as const;

export type MessageKey = keyof typeof es;
