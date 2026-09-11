/**
 * Consulta en lenguaje natural — seccion 4.9.
 *
 * El documento la pide como "ventaja diferencial nativa, sin depender de licencia premium
 * adicional". Tres decisiones la ordenan, y las tres vienen del resto del contrato:
 *
 * 1. NO GENERA CONSULTAS. La seccion 4.2 prohibe el SQL libre construido por un modulo, y una
 *    pregunta en lenguaje natural traducida a SQL es exactamente eso con otro nombre. Lo que se
 *    resuelve aqui es una SELECCION —que dataset, que medida, que dimension, que filtros— sobre
 *    lo que ya esta cacheado y certificado. El camino de lectura sigue siendo el de siempre.
 *
 * 2. LA RESPUESTA ES UNA URL. Como el estado visible vive en la query string (4.11), resolver
 *    una pregunta es construir una URL. Eso la vuelve compartible y marcable por construccion,
 *    y —lo que mas importa— hace que la aplique el mismo camino que aplica el ambito a
 *    cualquier otra URL: una pregunta no puede ser una via distinta de lectura.
 *
 * 3. EL VOCABULARIO SALE DE LO QUE QUIEN PREGUNTA YA PUEDE VER. Es la parte delicada. Si el
 *    resolutor conociera todos los valores de una dimension, una pregunta por un valor fuera de
 *    alcance se contestaria con "entendi Distrito = Este", y eso confirma que ese distrito
 *    existe — justo lo que 4.11 pide no revelar. El vocabulario se construye con los valores
 *    presentes en los datos YA filtrados por el ambito de quien pregunta.
 */

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
  /**
   * Palabras de la pregunta que no se reconocieron.
   *
   * Se devuelven para poder decir "no entendi X" en vez de contestar a medias y sin avisar. NO
   * se intenta adivinar a que se parecen: una sugerencia del tipo "¿querra decir Distrito Este?"
   * sobre un valor fuera de alcance seria la fuga que 4.11 prohibe.
   */
  noEntendido: string[];
  /** Explicacion legible de lo que se entendio, para enseñarla antes de aplicarla. */
  explicacion: string;
  /** true si se reconocio lo suficiente como para construir una vista. */
  resoluble: boolean;
}

/**
 * Puerto del resolutor.
 *
 * La implementacion por defecto es local y determinista: funciona sin contratar nada, que es lo
 * que pide el documento al decir "sin depender de licencia premium adicional". Un adaptador
 * apoyado en un modelo de lenguaje puede entrar despues por esta misma interfaz, y seguira
 * obligado a devolver una `ConsultaResuelta` sobre el vocabulario permitido — no una consulta
 * libre. La puerta de 4.2 la pone la FORMA del resultado, no la confianza en el resolutor.
 */
export interface INaturalLanguageResolver {
  resolver(pregunta: string, vocabulario: Vocabulario): ConsultaResuelta;
}
