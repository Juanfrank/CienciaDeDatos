import { expect, type Page } from '@playwright/test';
import { initialCatalog } from '@app/ui-components';
import {
  DEMO_KEY,
  SECRETO_TOTP_DEMO,
  totpCodeOf,
  mailUser,
} from '../src/server/demoCredentials';

/** Inicio de sesion de verdad para las pruebas de navegador. */
export async function asLogin(page: Page, userId: string, base = ''): Promise<void> {
  const respuesta = await page.request.post(`${base}/api/sign-in`, {
    data: {
      mail: mailUser(userId),
      clave: DEMO_KEY,
      code: totpCodeOf(SECRETO_TOTP_DEMO),
    },
  });

  // Si el inicio de sesion falla, la prueba debe caerse AQUI y no diez pasos mas adelante con un
  // "no se encontro el elemento" que no dice nada de la causa.
  expect(
    respuesta.ok(),
    `No se pudo iniciar sesion como ${userId}: ${respuesta.status()} ${await respuesta.text()}`,
  ).toBe(true);

  await tokenAlContexto(page);
  await page.goto(`${base || '/'}`);
}

/**
 * El token anti-CSRF, puesto en el contexto — apartado 2.16.
 *
 * En el navegador lo pone `pedir` leyendo la cookie; las pruebas escriben con el cliente de
 * Playwright, que no pasa por ahi. Se hace AQUI, una vez, y no en las decenas de llamadas
 * repartidas por las suites: con una cabecera por llamada, la que se olvidara seria la de la
 * prueba que alguien escriba manana, y el sintoma —un 403 sin explicacion— no dice que falta.
 *
 * `setExtraHTTPHeaders` es del CONTEXTO, asi que cubre tanto lo que pide la pagina como lo que
 * pide `page.request`.
 */
async function tokenAlContexto(page: Page): Promise<void> {
  const cookie = (await page.context().cookies()).find((c) => c.name === 'csrf');
  if (cookie) await page.context().setExtraHTTPHeaders({ 'x-csrf-token': cookie.value });
}

/** Cierra la sesion del contexto, revocandola tambien del lado servidor. */
export async function salir(page: Page, base = ''): Promise<void> {
  await page.request.delete(`${base}/api/sign-in`);
}

/**
 * Un modulo vacio, listo para editar.
 *
 * Se crea por API y no rellenando el formulario. La diferencia importa: cincuenta y seis pruebas
 * usaban el formulario como MONTAJE —dos cargas de pagina y tres interacciones cada una, por algo
 * que no era lo que venian a comprobar—. Quien prueba la creacion por la interfaz, porque ESA es
 * su pregunta, es `editor.spec.ts`, y sigue haciendolo por el formulario.
 */
export async function newModule(page: Page, slug: string): Promise<void> {
  const creado = await page.request.post('/api/modules', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), `No se pudo crear el modulo ${slug}: ${await creado.text()}`).toBe(true);
  await page.goto(`/editor/${slug}`);
}

/**
 * Espera a que el editor este AL DIA: nada pendiente, nada en vuelo, nada dibujandose.
 *
 * Son tres esperas y hacen falta las tres. Al principio bastaba `data-saving`, porque cada gesto
 * escribia y el lienzo se dibujaba con lo que devolvia esa escritura; al separar dibujar de
 * guardar hizo falta `data-drawing`; y con el autoguardado aparece una tercera ventana —el
 * rebote— en la que no se esta guardando ni dibujando y el cambio sigue solo en el navegador.
 * Mirando dos de las tres, la espera pasa por encima de esa ventana y la prueba lee el estado
 * anterior.
 *
 * Vive aqui porque estaba copiada en tres archivos de pruebas, que es la forma conocida de que
 * una se arregle y las otras dos se queden como estaban: al anadir `data-dirty` paso exactamente
 * eso.
 */
export async function alDia(page: Page): Promise<void> {
  await expect(page.locator('.editor')).toHaveAttribute('data-dirty', 'no');
  await expect(page.locator('.editor')).toHaveAttribute('data-saving', 'no');
  await expect(page.locator('.editor')).toHaveAttribute('data-drawing', 'no');
}

/** El dataset y los campos de la semilla que usan los montajes de abajo. */
export const DATASET_DEMO = 'casos-por-distrito-trimestre';
export const DISTRITO_DEMO = { table: 'DimTribunal', field: 'Distrito' };

/**
 * Un modulo con UN objeto YA mapeado, y el editor abierto encima con ese objeto seleccionado.
 *
 * Colocar desde la paleta no mapea nada: el editor elegia la primera medida y la primera
 * dimension del dataset y las ponia solas, asi que el objeto nacia ensenando una cifra que nadie
 * habia pedido, y quien lo colocaba no tenia por que sospechar que no era la suya. Las pruebas
 * que necesitan un objeto configurado parten de aqui.
 *
 * Se escribe por la API y no a golpe de clic en los pozos. Encadenar «anadir» y «elegir» por cada
 * campo deja abierta la lista de opciones del ultimo pozo tocado, que se cierra al abrir la del
 * siguiente: el panel se encoge DESPUES de que el editor diga que no queda nada pendiente, y el
 * clic que venga a continuacion cae en el hueco que el boton acaba de dejar. Ademas, lo que esas
 * pruebas miran no es como se mapea, sino que pasa con un objeto ya mapeado.
 */
export async function moduleWithObject(
  page: Page,
  slug: string,
  instancia: { objectId: string } & Record<string, unknown>,
): Promise<string> {
  const creado = await page.request.post('/api/modules', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), `No se pudo crear el modulo ${slug}: ${await creado.text()}`).toBe(true);
  const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };

  const id = 'obj-fijo';
  const guardado = await page.request.put(`/api/modules/${slug}/edit`, {
    data: {
      paginas: [
        {
          ...modulo.pages[0],
          slug: 'general',
          name: 'General',
          items: [
            {
              id,
              position: { x: 0, y: 0, w: 6, h: 4 },
              // La ULTIMA version del catalogo, que es la que el editor pone al colocar.
              // Fijarla a mano en cada montaje dejaba las pruebas contra una version vieja: los
              // multiplos, por ejemplo, no existen en la 1.0.0 de `barras`, y el objeto se
              // dibujaba entero en vez de repartido sin que nada dijera por que.
              instance: { instanceId: id, version: ultimaVersion(instancia.objectId), ...instancia },
            },
          ],
        },
      ],
    },
  });
  expect(guardado.ok(), `No se pudo montar el objeto: ${await guardado.text()}`).toBe(true);

  await page.goto(`/editor/${slug}`);
  // Seleccionado, que es de donde cuelga el panel lateral entero.
  await page.getByTestId(`select-${id}`).click();
  await alDia(page);
  return id;
}

/**
 * Un borrador con un objeto VALIDO, listo para enviar a aprobacion y publicar.
 *
 * Vive aqui porque lo necesitan dos archivos. `newModule` deja el modulo vacio, y un modulo con un
 * objeto sin mapear no se puede publicar —la validacion lo bloquea, y con razon—, asi que toda
 * prueba del ciclo de vida necesita exactamente esto. Copiado en el segundo archivo se habria
 * quedado atras en cuanto cambiara el contrato de `tarjeta-kpi`.
 */
export async function objectDraft(page: Page, slug: string): Promise<void> {
  const creado = await page.request.post('/api/modules', {
    data: { nombre: `Modulo ${slug}`, slug },
  });
  expect(creado.ok(), await creado.text()).toBe(true);

  const { modulo } = (await creado.json()) as { modulo: { pages: { pageId: string }[] } };
  const pagina = modulo.pages[0];

  const guardado = await page.request.put(`/api/modules/${slug}/edit`, {
    data: {
      paginas: [
        {
          ...pagina,
          slug: 'general',
          name: 'General',
          items: [
            {
              id: 'kpi',
              position: { x: 0, y: 0, w: 3, h: 2 },
              instance: {
                instanceId: 'kpi',
                objectId: 'tarjeta-kpi',
                version: '1.0.0',
                title: 'Pendientes',
                binding: {
                  datasetId: DATASET_DEMO,
                  dimensions: [],
                  measures: ['CasosPendientes'],
                },
              },
            },
          ],
        },
      ],
    },
  });
  expect(guardado.ok(), await guardado.text()).toBe(true);
}

/** La ultima version publicada de un objeto del catalogo. */
function ultimaVersion(objectId: string): string {
  const definicion = initialCatalog.find((o) => o.objectId === objectId);
  const version = definicion?.versions[definicion.versions.length - 1]?.version;
  expect(version, `El catalogo no tiene ningun '${objectId}'`).toBeDefined();
  return version ?? '1.0.0';
}
