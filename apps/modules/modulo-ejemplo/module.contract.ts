import type { FieldRef } from '@app/data-contracts';

/**
 * Contrato de modulo (seccion 3.3) — obligatorio en cada carpeta de /apps/modules/*.
 *
 * El pipeline de CI debe fallar si un modulo accede a datos o componentes no declarados
 * aqui. En el Entregable A este archivo fija la FORMA del contrato; el verificador que
 * lo contrasta contra el codigo real se implementa junto con el editor de modulos (Fase 2).
 */
export interface ModuleContract {
  /** Slug estable usado en la URL del modulo: /m/{slug} (seccion 4.11). */
  slug: string;
  name: string;
  /**
   * Medidas y dimensiones de la fuente ACTIVA que consume el modulo, via IDataConnector.
   * Se declaran sin asumir si la fuente terminara siendo un modelo semantico o el Data
   * Warehouse consultado directamente (seccion 3.3).
   */
  consumes: {
    measures: string[];
    dimensions: FieldRef[];
    /** datasetId del registro de datasets cacheables (6.6), para trazabilidad. */
    datasets: string[];
  };
  /** Componentes de packages/ui-components con la version EXACTA fijada (pin, seccion 4.5). */
  uiComponents: { name: string; version: string }[];
  /** Equipos que lo incluyen en su paquete de modulos (Team.moduleBundle, 4.10.2). */
  includedInTeamBundles: string[];
  /** Rol minimo para EDITARLO, frente a solo verlo (Visor siempre puede ver lo concedido). */
  minimumRoleToEdit: 'colaborador' | 'administrador';
}

export const contract: ModuleContract = {
  slug: 'casos-pendientes',
  name: 'Casos pendientes',
  consumes: {
    measures: ['CasosPendientes', 'DiasResolucion'],
    dimensions: [
      { table: 'DimTribunal', field: 'Distrito' },
      { table: 'DimTiempo', field: 'Trimestre' },
    ],
    // Dos datasets y dos granos: los pendientes se suman, asi que salen del agrupado; los dias
    // de resolucion se promedian, y un promedio solo se calcula bien sobre los casos uno a uno.
    datasets: ['casos-por-distrito-trimestre', 'casos-detalle'],
  },
  uiComponents: [
    { name: 'TablaBasica', version: '0.1.0' },
    { name: 'TarjetaKpi', version: '0.1.0' },
  ],
  includedInTeamBundles: ['equipo-distrito-norte', 'equipo-distrito-este'],
  minimumRoleToEdit: 'colaborador',
};

export default contract;
