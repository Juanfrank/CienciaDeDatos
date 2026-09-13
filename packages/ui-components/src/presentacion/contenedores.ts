import type { ObjectInstance } from '../registry/types';
import {
  CONEXION_POR_DEFECTO,
  CUADRO_DE_TEXTO_POR_DEFECTO,
  FORMA_POR_DEFECTO,
  LINEA_DIVISORIA_POR_DEFECTO,
  TITULO_DE_SECCION_POR_DEFECTO,
  type ConfiguracionDeElemento,
  type IdDeElemento,
  esElemento,
} from './elementos';

/**
 * Contenedores: objetos que agrupan a otros objetos.
 *
 * Un contenedor ocupa una celda de la rejilla principal como cualquier otro objeto, y dentro tiene
 * SU PROPIA rejilla. Esa es la parte que hace que funcionen: si los hijos se posicionaran contra la
 * rejilla del modulo, mover el contenedor obligaria a recolocar todo lo que lleva dentro, y
 * «agrupar» no significaria nada.
 *
 * Todos llevan titulo, subtitulo e icono opcionales, con el mismo patron visual y los mismos
 * interruptores que un objeto visual — no una cabecera propia parecida pero distinta. Un contenedor
 * es un objeto: si su cabecera se configurara aparte, la personalizacion volveria a depender de
 * que clase de cosa se selecciono, que es justo lo que el estandar minimo cerro.
 */

/** Posicion dentro de una rejilla, igual que `GridPosition` de module-model. */
export interface PosicionEnRejilla {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Un objeto dentro de un contenedor.
 *
 * Es la misma forma que un `GridItem` del modulo, a proposito: asi el mismo componente dibuja la
 * rejilla de dentro y la de fuera, y el dia que un contenedor lleve otro contenedor no hace falta
 * nada nuevo.
 */
export interface ItemAnidado {
  id: string;
  instance: ObjectInstance;
  position: PosicionEnRejilla;
}

/**
 * Un panel de contenido.
 *
 * Los contenedores que no tienen pestanas tienen exactamente UNO. Modelarlo asi y no con «items
 * sueltos, y ademas pestanas» evita el estado imposible de un contenedor con las dos cosas, y hace
 * que anadir pestanas a un contenedor simple sea anadir un panel, no migrar su contenido.
 */
export interface PanelDeContenedor {
  panelId: string;
  /** Rotulo de la pestana. Se ignora en los contenedores de un solo panel. */
  nombre: string;
  items: ItemAnidado[];
}

/* ── Ejes, lados y tamanos ─────────────────────────────────────────────────────────────────── */

/**
 * El eje por el que se desplaza un contenedor desplazable. UNO, nunca los dos.
 *
 * Dos barras a la vez obligan a buscar el contenido en un plano en lugar de en una linea: no se ve
 * cuanto falta por ninguno de los dos lados, y el gesto de rueda deja de ser predecible porque
 * depende de que eje crea el navegador que se esta moviendo. Por eso el modelo ni siquiera admite
 * «ambos» — no es una opcion que se desaconseje, es una que no existe.
 */
export const EJES = ['x', 'y'] as const;
export type Eje = (typeof EJES)[number];

/* ── Configuracion por tipo ────────────────────────────────────────────────────────────────── */

export interface ConfiguracionDeContenedorSimple {
  /** Columnas de la rejilla interna. Menos que las doce de fuera, porque el ancho tambien es menor. */
  columnas?: number;
}

export interface ConfiguracionDeContenedorDesplazable extends ConfiguracionDeContenedorSimple {
  eje?: Eje;
}

/**
 * Contenedor ampliable: ensena una parte y se abre a una ventana con su propia rejilla.
 *
 * La rejilla de la ventana es INDEPENDIENTE de la de la tarjeta. Reutilizar la misma haria que
 * ampliar solo estirase lo mismo, y lo que se quiere es lo contrario: en la tarjeta caben dos
 * cosas y en la ventana caben diez, colocadas de otra forma.
 */
export interface ConfiguracionDeContenedorAmpliable extends ConfiguracionDeContenedorSimple {
  /** Columnas de la rejilla de la ventana ampliada. */
  columnasAmpliado?: number;
  /** Texto del control que amplia. */
  textoDeAmpliar?: string;
}

export interface ConfiguracionDeContenedorConPestanas extends ConfiguracionDeContenedorSimple {
  /** Que pestana se ve al abrir. Si el id no existe, la primera. */
  pestanaInicial?: string;
}

export interface ConfiguracionDeContenedor {
  /**
   * El contenido. Una lista de paneles para TODOS los tipos; los que no tienen pestanas usan el
   * primero.
   */
  paneles?: PanelDeContenedor[];
  simple?: ConfiguracionDeContenedorSimple;
  desplazable?: ConfiguracionDeContenedorDesplazable;
  ampliable?: ConfiguracionDeContenedorAmpliable;
  pestanas?: ConfiguracionDeContenedorConPestanas;
}

export const CONTENEDORES = [
  'contenedor-simple',
  'contenedor-desplazable',
  'contenedor-ampliable',
  'contenedor-con-pestanas',
] as const;
export type IdDeContenedor = (typeof CONTENEDORES)[number];

export const esContenedor = (objectId: string): objectId is IdDeContenedor =>
  (CONTENEDORES as readonly string[]).includes(objectId);

export const COLUMNAS_INTERNAS_POR_DEFECTO = 6;

export const PANEL_VACIO = (n = 1): PanelDeContenedor => ({
  panelId: `p${n}`,
  nombre: `Pestana ${n}`,
  items: [],
});

/** Los paneles de un contenedor, siempre al menos uno. */
export function panelesDe(config: ConfiguracionDeContenedor | undefined): PanelDeContenedor[] {
  const paneles = config?.paneles ?? [];
  return paneles.length > 0 ? paneles : [PANEL_VACIO()];
}

/** Todas las instancias anidadas de un contenedor, para los avisos de deprecacion y la validacion. */
export function instanciasAnidadas(config: ConfiguracionDeContenedor | undefined): ObjectInstance[] {
  return panelesDe(config).flatMap((p) => p.items.map((i) => i.instance));
}

/* ── Validacion ────────────────────────────────────────────────────────────────────────────── */

export interface ProblemaDeContenedor {
  slot: string;
  problema: string;
}

/**
 * Lo que un contenedor tiene que cumplir antes de guardarse.
 *
 * Se comprueba en el MISMO sitio que el resto de la configuracion (4.2) y no al dibujar: un
 * contenedor con dos hijos superpuestos, o uno con pestanas sin ninguna pestana, es un error de
 * configuracion como un campo inexistente, y tiene que bloquear la publicacion igual.
 *
 * La rejilla interna se comprueba con las mismas reglas que la de fuera —dentro de los limites, sin
 * solapamiento— pero aqui, y no delegando en `validateLayout` de module-model, porque este paquete
 * no puede depender de aquel. La comprobacion es corta y la alternativa seria invertir la dependencia
 * para ahorrar quince lineas.
 */
export function validarContenedor(
  itemId: string,
  instance: { objectId: string; configuracion?: unknown },
): ProblemaDeContenedor[] {
  if (!esContenedor(instance.objectId)) return [];
  const config = (instance.configuracion ?? {}) as ConfiguracionDeContenedor;
  const problemas: ProblemaDeContenedor[] = [];
  const columnas = columnasDe(instance.objectId, config);

  const paneles = config.paneles ?? [];
  if (instance.objectId === 'contenedor-con-pestanas' && paneles.length < 2) {
    problemas.push({
      slot: `contenedor.${itemId}`,
      problema:
        'Un contenedor con pestanas necesita al menos dos. Con una sola, la barra de pestanas ' +
        'ocupa sitio sin ofrecer a donde ir: eso es un contenedor simple.',
    });
  }

  const ids = new Set<string>();
  for (const panel of paneles) {
    if (ids.has(panel.panelId)) {
      problemas.push({
        slot: `contenedor.${itemId}.${panel.panelId}`,
        problema: `Hay dos paneles con el id '${panel.panelId}'. El id identifica a cual se cambia.`,
      });
    }
    ids.add(panel.panelId);

    for (const item of panel.items) {
      if (item.position.w < 1 || item.position.h < 1) {
        problemas.push({
          slot: `contenedor.${itemId}.${item.id}`,
          problema: 'Un objeto de ancho o alto cero no se puede ver ni seleccionar.',
        });
      }
      if (item.position.x < 0 || item.position.x + item.position.w > columnas) {
        problemas.push({
          slot: `contenedor.${itemId}.${item.id}`,
          problema: `Se sale de las ${columnas} columnas del contenedor.`,
        });
      }
    }

    for (let i = 0; i < panel.items.length; i += 1) {
      for (let j = i + 1; j < panel.items.length; j += 1) {
        const a = panel.items[i];
        const b = panel.items[j];
        if (a && b && seSolapanEnRejilla(a.position, b.position)) {
          problemas.push({
            slot: `contenedor.${itemId}.${a.id}`,
            problema: `Se solapa con '${b.id}' dentro del contenedor.`,
          });
        }
      }
    }
  }

  if (instance.objectId === 'contenedor-desplazable') {
    const eje = config.desplazable?.eje;
    if (eje !== undefined && !(EJES as readonly string[]).includes(eje)) {
      problemas.push({
        slot: `contenedor.${itemId}`,
        problema: `'${String(eje)}' no es un eje. Se desplaza por X o por Y, nunca por los dos.`,
      });
    }
  }

  return problemas;
}

export const seSolapanEnRejilla = (a: PosicionEnRejilla, b: PosicionEnRejilla): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Las columnas de la rejilla interna de un contenedor, sea cual sea su tipo. */
export function columnasDe(objectId: string, config: ConfiguracionDeContenedor | undefined): number {
  const propia =
    config?.simple?.columnas ??
    config?.desplazable?.columnas ??
    config?.ampliable?.columnas ??
    config?.pestanas?.columnas;
  return Math.max(1, Math.round(propia ?? COLUMNAS_INTERNAS_POR_DEFECTO));
}

/* ── Lo que trae un objeto recien puesto ───────────────────────────────────────────────────── */

/**
 * La configuracion inicial de un elemento o un contenedor.
 *
 * Vive AQUI y no en el editor porque hay dos caminos que crean objetos —el panel y el sembrado de
 * modulos de ejemplo— y con dos copias de los valores por defecto un contenedor sembrado y uno
 * puesto a mano acabarian pareciendose solo por casualidad.
 *
 * Nunca devuelve un contenedor vacio de paneles: un contenedor sin ningun panel no tiene donde
 * poner lo que se le arrastre, y el primer gesto que alguien hace con el fallaria en silencio.
 */
export function configuracionInicial(
  objectId: string,
):
  | ({ objectId: IdDeContenedor } & ConfiguracionDeContenedor)
  | ({ objectId: IdDeElemento } & ConfiguracionDeElemento)
  | undefined {
  if (esElemento(objectId)) {
    switch (objectId) {
      case 'cuadro-de-texto':
        return { objectId, cuadroDeTexto: CUADRO_DE_TEXTO_POR_DEFECTO };
      case 'titulo-de-seccion':
        return { objectId, tituloDeSeccion: TITULO_DE_SECCION_POR_DEFECTO };
      case 'linea-divisoria':
        return { objectId, lineaDivisoria: LINEA_DIVISORIA_POR_DEFECTO };
      case 'forma':
        return { objectId, forma: FORMA_POR_DEFECTO };
      case 'conexion':
        return { objectId, conexion: CONEXION_POR_DEFECTO };
    }
  }

  if (!esContenedor(objectId)) return undefined;

  // El de pestanas nace con DOS: su validacion exige al menos dos, asi que nacer con una lo haria
  // nacer roto — y el editor lo marcaria antes de que nadie hubiera hecho nada mal.
  const paneles =
    objectId === 'contenedor-con-pestanas' ? [PANEL_VACIO(1), PANEL_VACIO(2)] : [PANEL_VACIO()];

  switch (objectId) {
    case 'contenedor-desplazable':
      return { objectId, paneles, desplazable: { eje: 'y' } };
    case 'contenedor-ampliable':
      return { objectId, paneles, ampliable: { columnasAmpliado: 12, textoDeAmpliar: 'Ampliar' } };
    case 'contenedor-con-pestanas':
      return { objectId, paneles, pestanas: { pestanaInicial: 'p1' } };
    default:
      return { objectId, paneles };
  }
}
