import type { ModuleDefinition } from '@app/module-model';
import { modulos } from './almacenModulos';

/**
 * Definiciones de modulo de arranque.
 *
 * En produccion las produce el editor de modulos (4.2) y viven en la base de gobierno. Aqui se
 * declaran como dato para que el shell tenga algo que renderizar contra el seed, y para que las
 * pruebas de punta a punta tengan modulos reales que abrir.
 *
 * Los `moduleId` coinciden con los del arbol del seed: es lo que permite que la resolucion de
 * ambito (4.10.4) encuentre el modulo en la organizacion general y aplique la herencia de
 * carpetas.
 */

const DISTRITO = { table: 'DimTribunal', field: 'Distrito' };
const MATERIA = { table: 'DimTribunal', field: 'Materia' };
const DATASET = 'casos-por-distrito-trimestre';

export const modulosDemo: ModuleDefinition[] = [
  {
    moduleId: 'casos-pendientes',
    slug: 'casos-pendientes',
    name: 'Casos pendientes',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-pendientes',
            position: { x: 0, y: 0, w: 3, h: 2 },
            instance: {
              instanceId: 'kpi-pendientes',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Casos pendientes',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
              attachments: [
                {
                  instanceId: 'tooltip-kpi-pendientes',
                  objectId: 'tooltip-explicativo',
                  version: '1.0.0',
                  text:
                    'Suma de casos que siguen abiertos al cierre del trimestre, sobre los ' +
                    'distritos y materias que su ambito de acceso permite ver.',
                },
                // Sin dimensiones mapeadas no hay subobjeto por el que desglosar: el alcance
                // tiene que ser de objeto, y la validacion lo rechazaria de otro modo.
                {
                  instanceId: 'datos-kpi-pendientes',
                  objectId: 'tabla-de-datos',
                  version: '1.0.0',
                  scope: 'objeto',
                },
              ],
            },
          },
          {
            id: 'kpi-ingresados',
            position: { x: 3, y: 0, w: 3, h: 2 },
            instance: {
              instanceId: 'kpi-ingresados',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Ingresados vs resueltos',
              binding: {
                datasetId: DATASET,
                dimensions: [],
                measures: ['CasosIngresados', 'CasosResueltos'],
              },
            },
          },
          {
            id: 'segmentador-materia',
            position: { x: 6, y: 0, w: 6, h: 2 },
            instance: {
              instanceId: 'segmentador-materia',
              objectId: 'segmentador',
              version: '1.0.0',
              title: 'Materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: [] },
            },
          },
          {
            id: 'barras-distrito',
            position: { x: 0, y: 2, w: 6, h: 4 },
            instance: {
              instanceId: 'barras-distrito',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Pendientes por distrito',
              binding: { datasetId: DATASET, dimensions: [DISTRITO], measures: ['CasosPendientes'] },
              attachments: [
                {
                  instanceId: 'tooltip-barras-distrito',
                  objectId: 'tooltip-explicativo',
                  version: '1.0.0',
                  text:
                    'Cada barra agrega los cuatro trimestres y todas las materias de ese ' +
                    'distrito. Pulse una barra para filtrar el resto del modulo.',
                },
                {
                  instanceId: 'datos-barras-distrito',
                  objectId: 'tabla-de-datos',
                  version: '1.0.0',
                  scope: 'subobjeto',
                },
              ],
            },
          },
          {
            id: 'matriz-distrito-materia',
            position: { x: 6, y: 2, w: 6, h: 4 },
            instance: {
              instanceId: 'matriz-distrito-materia',
              objectId: 'matriz',
              version: '1.0.0',
              title: 'Distrito por materia',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO, MATERIA],
                measures: ['CasosPendientes'],
              },
            },
          },
          {
            id: 'tabla-detalle',
            position: { x: 0, y: 6, w: 12, h: 4 },
            instance: {
              instanceId: 'tabla-detalle',
              objectId: 'tabla',
              version: '1.0.0',
              title: 'Detalle',
              binding: {
                datasetId: DATASET,
                dimensions: [DISTRITO, MATERIA],
                measures: ['CasosIngresados', 'CasosResueltos', 'CasosPendientes'],
              },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'audiencias',
    slug: 'audiencias',
    name: 'Audiencias',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'roto-demo',
            position: { x: 0, y: 0, w: 6, h: 3 },
            instance: {
              instanceId: 'roto-demo',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Objeto con un campo que ya no existe',
              // Deliberadamente roto: 'CampoRetirado' no esta en el dataset. Sirve para
              // comprobar en vivo lo que exige 4.2 — marcarlo visualmente roto, no fallar en
              // silencio ni omitirlo, y que el resto del modulo siga funcionando.
              binding: {
                datasetId: DATASET,
                dimensions: [{ table: 'DimTribunal', field: 'CampoRetirado' }],
                measures: ['CasosPendientes'],
              },
            },
          },
          {
            id: 'barras-materia',
            position: { x: 6, y: 0, w: 6, h: 3 },
            instance: {
              instanceId: 'barras-materia',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Resueltos por materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosResueltos'] },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'casos-este',
    slug: 'casos-este',
    name: 'Casos pendientes Este',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-este',
            position: { x: 0, y: 0, w: 4, h: 2 },
            instance: {
              instanceId: 'kpi-este',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Pendientes',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
            },
          },
          {
            id: 'barras-este',
            position: { x: 4, y: 0, w: 8, h: 4 },
            instance: {
              instanceId: 'barras-este',
              objectId: 'barras',
              version: '1.0.0',
              title: 'Por materia',
              binding: { datasetId: DATASET, dimensions: [MATERIA], measures: ['CasosPendientes'] },
            },
          },
        ],
      },
    ],
  },
  {
    moduleId: 'estadisticas',
    slug: 'estadisticas',
    name: 'Estadisticas nacionales',
    status: 'publicado',
    version: 1,
    createdAt: '2026-09-11T08:00:00.000Z',
    updatedAt: '2026-09-11T08:00:00.000Z',
    pages: [
      {
        pageId: 'p-general',
        slug: 'general',
        name: 'General',
        items: [
          {
            id: 'kpi-nacional',
            position: { x: 0, y: 0, w: 4, h: 2 },
            instance: {
              instanceId: 'kpi-nacional',
              objectId: 'tarjeta-kpi',
              version: '1.0.0',
              title: 'Total nacional',
              binding: { datasetId: DATASET, dimensions: [], measures: ['CasosPendientes'] },
            },
          },
        ],
      },
    ],
  },
];

/**
 * Busqueda por slug, contra el ALMACEN y no contra la semilla.
 *
 * Es asincrona desde que existe el editor: los modulos se escriben, asi que ya no se pueden
 * resolver leyendo un array del modulo. La semilla sigue siendo el estado inicial.
 *
 * OJO: esto NO filtra por estado. Devuelve tambien borradores, porque el editor tiene que poder
 * abrirlos. Quien sirva un modulo a una persona debe pasar ademas por `puedeVer` del ciclo de
 * vida; servir un borrador ajeno seria mostrar trabajo en curso de otro como si fuera oficial.
 */
export async function findModuleBySlug(slug: string): Promise<ModuleDefinition | undefined> {
  return modulos.bySlug(slug);
}

export async function findModuleById(moduleId: string): Promise<ModuleDefinition | undefined> {
  return modulos.get(moduleId);
}
