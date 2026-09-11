/**
 * Metricas del camino de lectura — seccion 8.3: "estrategia de cache implementada y con METRICAS
 * VISIBLES en Application Insights".
 *
 * El lector de datasets ya emitia un evento por lectura desde B.5, y hasta ahora no lo recogia
 * nadie: el gancho existia y las metricas no llegaban a ninguna parte. Esto es lo que faltaba.
 *
 * Es un acumulador y no un cliente de Application Insights a proposito. Lo que hay que decidir
 * aqui es QUE se mide; a donde se manda es un adaptador, y en un App Service con varias
 * instancias cada una acumula lo suyo y el agregado lo hace el destino. Las cuatro cifras estan
 * elegidas para responder preguntas operativas concretas, no para llenar un panel:
 *
 *  - `aciertos` frente a `generandose`: si lo segundo crece, el job no llega a poblar lo que la
 *    gente pide, y eso se ve como pantallas vacias antes que como un error.
 *  - `desdeL1` frente a `desdeL2`: cuanto trabajo se ahorra al Storage Account. Es el dato que
 *    sustenta si conviene o no un Redis (6.1), en vez de decidirlo por intuicion.
 *  - `degradados`: lecturas servidas SIN ser el camino sano — desde L1 porque L2 no respondia
 *    (6.9), o con un dato ya vencido. Se cuentan juntas porque operativamente son la misma
 *    pregunta —"¿se esta sirviendo lo que deberia?"— y cualquier valor distinto de cero es una
 *    incidencia, no una estadistica.
 *  - `antiguedadMaximaMs`: cuanto de viejo es lo mas viejo que se ha servido. Responde a "¿que
 *    estan viendo?" mejor que la media, que esconde justo el caso que importa.
 */

export interface LecturaDeCache {
  datasetId: string;
  /** Los mismos tres estados que emite el lector de datasets. */
  status: 'ok' | 'generating' | 'degraded';
  servedFrom?: 'l1' | 'l2';
  stale: boolean;
  ageMs?: number;
}

export interface ResumenDeCache {
  total: number;
  aciertos: number;
  generandose: number;
  desdeL1: number;
  desdeL2: number;
  degradados: number;
  antiguedadMaximaMs: number;
  /** Proporcion de lecturas servidas con dato, de 0 a 1. `null` si todavia no hubo ninguna. */
  tasaDeAcierto: number | null;
}

export class CacheMetrics {
  private total = 0;
  private aciertos = 0;
  private generandose = 0;
  private desdeL1 = 0;
  private desdeL2 = 0;
  private degradados = 0;
  private antiguedadMaximaMs = 0;

  registrar(lectura: LecturaDeCache): void {
    this.total += 1;

    if (lectura.status === 'generating') {
      this.generandose += 1;
      // Una lectura sin dato no cuenta como acierto ni tiene procedencia ni antiguedad: sumarla
      // a cualquiera de las otras cifras las volveria mentira.
      return;
    }

    this.aciertos += 1;
    if (lectura.servedFrom === 'l1') this.desdeL1 += 1;
    if (lectura.servedFrom === 'l2') this.desdeL2 += 1;
    if (lectura.stale || lectura.status === 'degraded') this.degradados += 1;
    if (lectura.ageMs !== undefined) {
      this.antiguedadMaximaMs = Math.max(this.antiguedadMaximaMs, lectura.ageMs);
    }
  }

  resumen(): ResumenDeCache {
    return {
      total: this.total,
      aciertos: this.aciertos,
      generandose: this.generandose,
      desdeL1: this.desdeL1,
      desdeL2: this.desdeL2,
      degradados: this.degradados,
      antiguedadMaximaMs: this.antiguedadMaximaMs,
      tasaDeAcierto: this.total === 0 ? null : this.aciertos / this.total,
    };
  }

  /** Solo para pruebas y para el reinicio de un proceso. */
  reiniciar(): void {
    this.total = 0;
    this.aciertos = 0;
    this.generandose = 0;
    this.desdeL1 = 0;
    this.desdeL2 = 0;
    this.degradados = 0;
    this.antiguedadMaximaMs = 0;
  }
}
