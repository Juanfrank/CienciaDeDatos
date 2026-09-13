/** Consulta en lenguaje natural — seccion 4.9. */

export interface TerminoDeVocabulario {
  /** Lo que se escribe en la URL: nombre de medida o clave de dimension. */
  clave: string;
  /** Como se dice en la interfaz. */
  etiqueta: string;
}

export interface ValorDeDimension {
  dimension: string;
  valor: string;
}

/**
 * Lo que el resolutor puede reconocer.
 *
 * Se construye por persona y por modulo, nunca una vez para toda la aplicacion.
 */
export interface Vocabulario {
  moduleSlug: string;
  measures: TerminoDeVocabulario[];
  dimensions: TerminoDeVocabulario[];
  /** Valores presentes en los datos que quien pregunta puede ver. */
  values: ValorDeDimension[];
}

export type Intencion = 'total' | 'desglose' | 'ranking';

export interface ConsultaResuelta {
  /** Que se entendio. Vacio si no se entendio nada reconocible. */
  intencion: Intencion;
  measure?: string;
  /** Dimension por la que agrupar, cuando la pregunta pide un desglose. */
  groupBy?: string;
  filters: Record<string, string[]>;
  /** Cuantos elementos, cuando la pregunta pide un ranking. */
  limite?: number;
  /** Palabras de la pregunta que no se reconocieron. */
  noEntendido: string[];
  /** Explicacion legible de lo que se entendio, para enseñarla antes de aplicarla. */
  explicacion: string;
  /** true si se reconocio lo suficiente como para construir una vista. */
  resoluble: boolean;
}

/** Puerto del resolutor. */
export interface INaturalLanguageResolver {
  resolver(pregunta: string, vocabulario: Vocabulario): ConsultaResuelta;
}
