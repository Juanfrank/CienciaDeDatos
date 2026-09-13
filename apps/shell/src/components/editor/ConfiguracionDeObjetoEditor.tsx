'use client';

import {
  ALINEACIONES,
  EJES,
  ESTILOS_DE_LINEA,
  FORMAS,
  ORIENTACIONES,
  PANEL_VACIO,
  POSICIONES_DE_LINEA,
  TRAZADOS,
  type Alineacion,
  type ContainerSettings,
  type ConfiguracionDeElemento,
  type ConfiguracionDeLinea,
  type Eje,
  type EstiloDeLinea,
  type Forma,
  type ObjectInstance,
  type Orientacion,
  type PosicionDeLinea,
  type Trazado,
  esContenedor,
  esElemento,
  panelesDe,
} from '@app/ui-components';
import { PaletaDeColores } from './EstiloDeTextoEditor';
import { Seccion } from './Seccion';

/** Configuracion propia de los elementos y los contenedores. */

const ETIQUETA_DE_LINEA: Record<PosicionDeLinea, string> = {
  ninguna: 'Ninguna',
  izquierda: 'A la izquierda',
  derecha: 'A la derecha',
  ambos: 'A ambos lados',
  arriba: 'Encima',
  abajo: 'Debajo',
};

const ETIQUETA_DE_ESTILO: Record<EstiloDeLinea, string> = {
  solida: 'Solida',
  discontinua: 'Discontinua',
  punteada: 'Punteada',
};

const ETIQUETA_DE_FORMA: Record<Forma, string> = {
  rectangulo: 'Rectangulo',
  cuadrado: 'Cuadrado',
  triangulo: 'Triangulo',
  circulo: 'Circulo',
  rombo: 'Rombo',
  flecha: 'Flecha',
};

const ETIQUETA_DE_EJE: Record<Eje, string> = { x: 'Horizontal (X)', y: 'Vertical (Y)' };

const ETIQUETA_DE_TRAZADO: Record<Trazado, string> = {
  recto: 'Recto',
  angulo: 'En angulo',
  curva: 'Curvo',
};

const ETIQUETA_DE_ALINEACION: Record<Alineacion, string> = {
  izquierda: 'Izquierda',
  centro: 'Centro',
  derecha: 'Derecha',
};

const ETIQUETA_DE_ORIENTACION: Record<Orientacion, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
};

/** Estilo, grosor y color de una linea: el mismo control para las cuatro que hay. */
function LineaEditor({
  line,
  prueba,
  guardando,
  onCambiar,
}: {
  line: ConfiguracionDeLinea | undefined;
  prueba: string;
  guardando: boolean;
  onCambiar: (line: ConfiguracionDeLinea) => void;
}) {
  const cambiar = (parcial: Partial<ConfiguracionDeLinea>) => onCambiar({ ...line, ...parcial });

  return (
    <>
      <label className="formulario__campo">
        <span>Estilo de line</span>
        <select
          value={line?.estilo ?? 'solida'}
          disabled={guardando}
          data-testid={`${prueba}-estilo`}
          onChange={(e) => cambiar({ estilo: e.target.value as EstiloDeLinea })}
        >
          {ESTILOS_DE_LINEA.map((v) => (
            <option key={v} value={v}>
              {ETIQUETA_DE_ESTILO[v]}
            </option>
          ))}
        </select>
      </label>

      <label className="formulario__campo">
        <span>Grosor</span>
        <select
          value={String(line?.grosor ?? 1)}
          disabled={guardando}
          data-testid={`${prueba}-grosor`}
          onChange={(e) => cambiar({ grosor: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 6, 8].map((g) => (
            <option key={g} value={g}>
              {g} px
            </option>
          ))}
        </select>
      </label>

      <div className="formulario__campo">
        <span>Color de line</span>
        <PaletaDeColores
          valor={line?.color ?? 'atenuado'}
          nombre="la linea"
          prueba={`${prueba}-color`}
          onCambiar={(color) => cambiar({ color })}
        />
      </div>
    </>
  );
}

export function ConfiguracionDeObjetoEditor({
  instance,
  guardando,
  onCambiar,
}: {
  instance: ObjectInstance;
  guardando: boolean;
  onCambiar: (cambio: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const { objectId } = instance;
  if (!esElemento(objectId) && !esContenedor(objectId)) return null;

  const prueba = `conf-${instance.instanceId}`;

  /*
   * Cada cambio funde sobre lo ya guardado y REPONE el `objectId`.
   */
  const poner = (parcial: ConfiguracionDeElemento | ContainerSettings) =>
    onCambiar((i) => ({
      ...i,
      configuracion: { ...(i.configuracion ?? {}), ...parcial, objectId } as ObjectInstance['configuracion'],
    }));

  const conf = (instance.configuracion ?? {}) as ConfiguracionDeElemento & ContainerSettings;

  if (objectId === 'cuadro-de-texto') {
    const parrafos = conf.cuadroDeTexto?.parrafos ?? [];
    return (
      <Seccion titulo="Texto" nivel={2} prueba={prueba}>
        {parrafos.map((parrafo, i) => (
          <label key={i} className="formulario__campo">
            <span>Parrafo {i + 1}</span>
            <textarea
              defaultValue={parrafo.content}
              rows={3}
              disabled={guardando}
              data-testid={`${prueba}-parrafo-${i}`}
              onBlur={(e) =>
                poner({
                  cuadroDeTexto: {
                    parrafos: parrafos.map((p, j) => (j === i ? { ...p, content: e.target.value } : p)),
                  },
                })
              }
            />
          </label>
        ))}
        <button
          type="button"
          className="boton-contorno"
          disabled={guardando}
          data-testid={`${prueba}-anadir-parrafo`}
          onClick={() => poner({ cuadroDeTexto: { parrafos: [...parrafos, { content: '' }] } })}
        >
          Anadir parrafo
        </button>
      </Seccion>
    );
  }

  if (objectId === 'titulo-de-seccion') {
    const t = conf.tituloDeSeccion;
    return (
      <Seccion titulo="Titulo de seccion" nivel={2} prueba={prueba}>
        <label className="formulario__campo">
          <span>Texto</span>
          <input
            defaultValue={t?.content ?? ''}
            disabled={guardando}
            data-testid={`${prueba}-texto`}
            onBlur={(e) => poner({ tituloDeSeccion: { ...t, content: e.target.value } })}
          />
        </label>

        <label className="formulario__campo">
          <span>Posicion del content</span>
          <select
            value={t?.posicionDelTexto ?? 'izquierda'}
            disabled={guardando}
            data-testid={`${prueba}-posicion`}
            onChange={(e) =>
              poner({
                tituloDeSeccion: { ...t, content: t?.content ?? '', posicionDelTexto: e.target.value as Alineacion },
              })
            }
          >
            {ALINEACIONES.map((a) => (
              <option key={a} value={a}>
                {ETIQUETA_DE_ALINEACION[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="formulario__campo">
          <span>Lineas</span>
          <select
            value={t?.line ?? 'ninguna'}
            disabled={guardando}
            data-testid={`${prueba}-linea`}
            onChange={(e) =>
              poner({
                tituloDeSeccion: { ...t, content: t?.content ?? '', line: e.target.value as PosicionDeLinea },
              })
            }
          >
            {POSICIONES_DE_LINEA.map((v) => (
              <option key={v} value={v}>
                {ETIQUETA_DE_LINEA[v]}
              </option>
            ))}
          </select>
          <span className="campo__pista">Se reparten el ancho que sobre after del content.</span>
        </label>

        <LineaEditor
          line={t?.estiloDeLinea}
          prueba={`${prueba}-l`}
          guardando={guardando}
          onCambiar={(estiloDeLinea) =>
            poner({ tituloDeSeccion: { ...t, content: t?.content ?? '', estiloDeLinea } })
          }
        />
      </Seccion>
    );
  }

  if (objectId === 'linea-divisoria') {
    const l = conf.lineaDivisoria;
    return (
      <Seccion titulo="Linea divisoria" nivel={2} prueba={prueba}>
        <label className="formulario__campo">
          <span>Orientacion</span>
          <select
            value={l?.orientacion ?? 'horizontal'}
            disabled={guardando}
            data-testid={`${prueba}-orientacion`}
            onChange={(e) =>
              poner({ lineaDivisoria: { ...l, orientacion: e.target.value as Orientacion } })
            }
          >
            {ORIENTACIONES.map((o) => (
              <option key={o} value={o}>
                {ETIQUETA_DE_ORIENTACION[o]}
              </option>
            ))}
          </select>
        </label>
        <LineaEditor
          line={l}
          prueba={`${prueba}-l`}
          guardando={guardando}
          onCambiar={(line) => poner({ lineaDivisoria: { ...l, ...line } })}
        />
      </Seccion>
    );
  }

  if (objectId === 'forma') {
    const f = conf.forma;
    return (
      <Seccion titulo="Forma" nivel={2} prueba={prueba}>
        <label className="formulario__campo">
          <span>Forma</span>
          <select
            value={f?.forma ?? 'rectangulo'}
            disabled={guardando}
            data-testid={`${prueba}-forma`}
            onChange={(e) => poner({ forma: { ...f, forma: e.target.value as Forma } })}
          >
            {FORMAS.map((v) => (
              <option key={v} value={v}>
                {ETIQUETA_DE_FORMA[v]}
              </option>
            ))}
          </select>
        </label>

        <div className="formulario__campo">
          <span>Relleno</span>
          <PaletaDeColores
            valor={f?.relleno ?? 'primario'}
            nombre="el relleno"
            prueba={`${prueba}-relleno`}
            onCambiar={(relleno) => poner({ forma: { ...f, forma: f?.forma ?? 'rectangulo', relleno } })}
          />
        </div>

        <label className="formulario__campo">
          <span>Opacidad</span>
          <select
            value={String(f?.opacidad ?? 100)}
            disabled={guardando}
            data-testid={`${prueba}-opacidad`}
            onChange={(e) =>
              poner({ forma: { ...f, forma: f?.forma ?? 'rectangulo', opacidad: Number(e.target.value) } })
            }
          >
            {[12, 25, 50, 75, 100].map((o) => (
              <option key={o} value={o}>
                {o} %
              </option>
            ))}
          </select>
        </label>

        <label className="formulario__campo">
          <span>Texto dentro</span>
          <input
            defaultValue={f?.content ?? ''}
            disabled={guardando}
            data-testid={`${prueba}-texto`}
            onBlur={(e) =>
              poner({
                forma: { ...f, forma: f?.forma ?? 'rectangulo', content: e.target.value || undefined },
              })
            }
          />
        </label>
      </Seccion>
    );
  }

  if (objectId === 'conexion') {
    const c = conf.conexion;
    return (
      <Seccion titulo="Conexion" nivel={2} prueba={prueba}>
        {/*
          Los extremos se escriben por id y no se eligen de una lista porque el editor de esta
          seccion no conoce los demas objetos del modulo. Es la limitacion honesta: el campo dice
          exactamente que espera, y la conexion avisa en el lienzo cuando un extremo no existe.
        */}
        <label className="formulario__campo">
          <span>Desde (id del objeto)</span>
          <input
            defaultValue={c?.desde ?? ''}
            disabled={guardando}
            data-testid={`${prueba}-desde`}
            onBlur={(e) => poner({ conexion: { ...c, desde: e.target.value || undefined } })}
          />
        </label>
        <label className="formulario__campo">
          <span>Hasta (id del objeto)</span>
          <input
            defaultValue={c?.hasta ?? ''}
            disabled={guardando}
            data-testid={`${prueba}-hasta`}
            onBlur={(e) => poner({ conexion: { ...c, hasta: e.target.value || undefined } })}
          />
        </label>
        <label className="formulario__campo">
          <span>Trazado</span>
          <select
            value={c?.trazado ?? 'angulo'}
            disabled={guardando}
            data-testid={`${prueba}-trazado`}
            onChange={(e) => poner({ conexion: { ...c, trazado: e.target.value as Trazado } })}
          >
            {TRAZADOS.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_DE_TRAZADO[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="editor__interruptor">
          <input
            type="checkbox"
            checked={c?.extremoFinal === 'flecha'}
            disabled={guardando}
            data-testid={`${prueba}-flecha`}
            onChange={(e) =>
              poner({ conexion: { ...c, extremoFinal: e.target.checked ? 'flecha' : 'ninguno' } })
            }
          />{' '}
          Punta de flecha al final
        </label>
        <LineaEditor
          line={c?.estiloDeLinea}
          prueba={`${prueba}-l`}
          guardando={guardando}
          onCambiar={(estiloDeLinea) => poner({ conexion: { ...c, estiloDeLinea } })}
        />
      </Seccion>
    );
  }

  /* ── Contenedores ─────────────────────────────────────────────────────────────────────── */

  const panels = panelesDe(conf);
  const gridColumns =
    conf.simple?.gridColumns ??
    conf.desplazable?.gridColumns ??
    conf.ampliable?.gridColumns ??
    conf.pestanas?.gridColumns ??
    6;

  const ponerColumnas = (n: number) => {
    // Las columnas viven en el bloque del tipo, asi que cada uno pone las suyas. Se resuelve con
    // un mapa y no con cinco ifs sueltos para que anadir un contenedor no tenga que acordarse.
    const block: Record<string, keyof ContainerSettings> = {
      'contenedor-simple': 'simple',
      'contenedor-desplazable': 'desplazable',
      'contenedor-ampliable': 'ampliable',
      'contenedor-con-pestanas': 'pestanas',
    };
    const clave = block[objectId] ?? 'simple';
    poner({ [clave]: { ...(conf[clave] as object), gridColumns: n } } as ContainerSettings);
  };

  return (
    <Seccion titulo="Contenedor" nivel={2} prueba={prueba}>
      <label className="formulario__campo">
        <span>Columnas internas</span>
        <select
          value={String(gridColumns)}
          disabled={guardando}
          data-testid={`${prueba}-columnas`}
          onChange={(e) => ponerColumnas(Number(e.target.value))}
        >
          {[2, 3, 4, 6, 8, 12].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="campo__pista">La rejilla de dentro es independiente de la del modulo.</span>
      </label>

      {objectId === 'contenedor-desplazable' ? (
        <label className="formulario__campo">
          <span>Eje de desplazamiento</span>
          <select
            value={conf.desplazable?.eje ?? 'y'}
            disabled={guardando}
            data-testid={`${prueba}-eje`}
            onChange={(e) =>
              poner({ desplazable: { ...conf.desplazable, eje: e.target.value as Eje } })
            }
          >
            {EJES.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_DE_EJE[e]}
              </option>
            ))}
          </select>
          <span className="campo__pista">Uno solo. El other eje nunca se desplaza.</span>
        </label>
      ) : null}

      {objectId === 'contenedor-ampliable' ? (
        <label className="formulario__campo">
          <span>Columnas al ampliar</span>
          <select
            value={String(conf.ampliable?.columnasAmpliado ?? 12)}
            disabled={guardando}
            data-testid={`${prueba}-columnas-ampliado`}
            onChange={(e) =>
              poner({ ampliable: { ...conf.ampliable, columnasAmpliado: Number(e.target.value) } })
            }
          >
            {[6, 8, 12, 16].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {objectId === 'contenedor-con-pestanas' ? (
        <>
          {panels.map((panel, i) => (
            <label key={panel.panelId} className="formulario__campo">
              <span>Pestana {i + 1}</span>
              <input
                defaultValue={panel.nombre}
                disabled={guardando}
                data-testid={`${prueba}-pestana-${panel.panelId}`}
                onBlur={(e) =>
                  poner({
                    panels: panels.map((p) =>
                      p.panelId === panel.panelId ? { ...p, nombre: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="boton-contorno"
            disabled={guardando}
            data-testid={`${prueba}-anadir-pestana`}
            onClick={() => poner({ panels: [...panels, PANEL_VACIO(panels.length + 1)] })}
          >
            Anadir pestana
          </button>
        </>
      ) : null}
    </Seccion>
  );
}
