'use client';

import {
  ALIGNMENTS,
  AXES,
  LINE_STYLES,
  SHAPES,
  ORIENTACIONES,
  EMPTY_PANEL,
  LINE_POSITIONS,
  TRAZADOS,
  type Alignment,
  type ContainerSettings,
  type ElementSettings,
  type LineSettings,
  type Axis,
  type LineStyle,
  type Shape,
  type ObjectInstance,
  type Orientation,
  type LinePosition,
  type Dash,
  isContainer,
  isElement,
  panelsOf,
} from '@app/ui-components';
import { ColorPalette } from './EditorTextStyle';
import { Section } from './Section';

/** Configuracion propia de los elementos y los contenedores. */

const LINE_LABEL: Record<LinePosition, string> = {
  ninguna: 'Ninguna',
  izquierda: 'A la izquierda',
  derecha: 'A la derecha',
  ambos: 'A ambos lados',
  arriba: 'Encima',
  abajo: 'Debajo',
};

const STYLE_LABEL: Record<LineStyle, string> = {
  solida: 'Solida',
  discontinua: 'Discontinua',
  punteada: 'Punteada',
};

const SHAPE_LABEL: Record<Shape, string> = {
  rectangulo: 'Rectangulo',
  cuadrado: 'Cuadrado',
  triangulo: 'Triangulo',
  circulo: 'Circulo',
  rombo: 'Rombo',
  flecha: 'Flecha',
};

const AXIS_LABEL: Record<Axis, string> = { x: 'Horizontal (X)', y: 'Vertical (Y)' };

const DASH_LABEL: Record<Dash, string> = {
  recto: 'Recto',
  angulo: 'En angulo',
  curva: 'Curvo',
};

const ALIGNMENT_LABEL: Record<Alignment, string> = {
  izquierda: 'Izquierda',
  centro: 'Centro',
  derecha: 'Derecha',
};

const ORIENTATION_LABEL: Record<Orientation, string> = {
  horizontal: 'Horizontal',
  vertical: 'Vertical',
};

/** Estilo, grosor y color de una linea: el mismo control para las cuatro que hay. */
function EditorLine({
  line,
  prueba,
  saving,
  onCambiar,
}: {
  line: LineSettings | undefined;
  prueba: string;
  saving: boolean;
  onCambiar: (line: LineSettings) => void;
}) {
  const cambiar = (parcial: Partial<LineSettings>) => onCambiar({ ...line, ...parcial });

  return (
    <>
      <label className="form__field">
        <span>Estilo de linea</span>
        <select
          value={line?.style ?? 'solida'}
          disabled={saving}
          data-testid={`${prueba}-estilo`}
          onChange={(e) => cambiar({ style: e.target.value as LineStyle })}
        >
          {LINE_STYLES.map((v) => (
            <option key={v} value={v}>
              {STYLE_LABEL[v]}
            </option>
          ))}
        </select>
      </label>

      <label className="form__field">
        <span>Grosor</span>
        <select
          value={String(line?.thickness ?? 1)}
          disabled={saving}
          data-testid={`${prueba}-grosor`}
          onChange={(e) => cambiar({ thickness: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 6, 8].map((g) => (
            <option key={g} value={g}>
              {g} px
            </option>
          ))}
        </select>
      </label>

      <div className="form__field">
        <span>Color de linea</span>
        <ColorPalette
          valor={line?.color ?? 'atenuado'}
          nombre="la linea"
          prueba={`${prueba}-color`}
          onCambiar={(color) => cambiar({ color })}
        />
      </div>
    </>
  );
}

export function EditorObjectSettings({
  instance,
  saving,
  onCambiar,
}: {
  instance: ObjectInstance;
  saving: boolean;
  onCambiar: (change: (i: ObjectInstance) => ObjectInstance) => void;
}) {
  const { objectId } = instance;
  if (!isElement(objectId) && !isContainer(objectId)) return null;

  const prueba = `conf-${instance.instanceId}`;

  /*
   * Cada cambio funde sobre lo ya guardado y REPONE el `objectId`.
   */
  const set = (parcial: ElementSettings | ContainerSettings) =>
    onCambiar((i) => ({
      ...i,
      settings: { ...(i.settings ?? {}), ...parcial, objectId } as ObjectInstance['settings'],
    }));

  const conf = (instance.settings ?? {}) as ElementSettings & ContainerSettings;

  if (objectId === 'cuadro-de-texto') {
    const parrafos = conf.textBox?.parrafos ?? [];
    return (
      <Section titulo="Texto" nivel={2} prueba={prueba}>
        {parrafos.map((paragraph, i) => (
          <label key={i} className="form__field">
            <span>Parrafo {i + 1}</span>
            <textarea
              defaultValue={paragraph.content}
              rows={3}
              disabled={saving}
              data-testid={`${prueba}-parrafo-${i}`}
              onBlur={(e) =>
                set({
                  textBox: {
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
          disabled={saving}
          data-testid={`${prueba}-anadir-parrafo`}
          onClick={() => set({ textBox: { parrafos: [...parrafos, { content: '' }] } })}
        >
          Anadir parrafo
        </button>
      </Section>
    );
  }

  if (objectId === 'titulo-de-seccion') {
    const t = conf.sectionTitle;
    return (
      <Section titulo="Titulo de seccion" nivel={2} prueba={prueba}>
        <label className="form__field">
          <span>Texto</span>
          <input
            defaultValue={t?.content ?? ''}
            disabled={saving}
            data-testid={`${prueba}-texto`}
            onBlur={(e) => set({ sectionTitle: { ...t, content: e.target.value } })}
          />
        </label>

        <label className="form__field">
          <span>Posicion del content</span>
          <select
            value={t?.textPosition ?? 'izquierda'}
            disabled={saving}
            data-testid={`${prueba}-posicion`}
            onChange={(e) =>
              set({
                sectionTitle: { ...t, content: t?.content ?? '', textPosition: e.target.value as Alignment },
              })
            }
          >
            {ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {ALIGNMENT_LABEL[a]}
              </option>
            ))}
          </select>
        </label>

        <label className="form__field">
          <span>Lineas</span>
          <select
            value={t?.line ?? 'ninguna'}
            disabled={saving}
            data-testid={`${prueba}-linea`}
            onChange={(e) =>
              set({
                sectionTitle: { ...t, content: t?.content ?? '', line: e.target.value as LinePosition },
              })
            }
          >
            {LINE_POSITIONS.map((v) => (
              <option key={v} value={v}>
                {LINE_LABEL[v]}
              </option>
            ))}
          </select>
          <span className="field__pista">Se reparten el ancho que sobre despues del content.</span>
        </label>

        <EditorLine
          line={t?.estiloDeLinea}
          prueba={`${prueba}-l`}
          saving={saving}
          onCambiar={(estiloDeLinea) =>
            set({ sectionTitle: { ...t, content: t?.content ?? '', estiloDeLinea } })
          }
        />
      </Section>
    );
  }

  if (objectId === 'linea-divisoria') {
    const l = conf.lineDivider;
    return (
      <Section titulo="Linea divisoria" nivel={2} prueba={prueba}>
        <label className="form__field">
          <span>Orientacion</span>
          <select
            value={l?.orientation ?? 'horizontal'}
            disabled={saving}
            data-testid={`${prueba}-orientacion`}
            onChange={(e) =>
              set({ lineDivider: { ...l, orientation: e.target.value as Orientation } })
            }
          >
            {ORIENTACIONES.map((o) => (
              <option key={o} value={o}>
                {ORIENTATION_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <EditorLine
          line={l}
          prueba={`${prueba}-l`}
          saving={saving}
          onCambiar={(line) => set({ lineDivider: { ...l, ...line } })}
        />
      </Section>
    );
  }

  if (objectId === 'forma') {
    const f = conf.forma;
    return (
      <Section titulo="Forma" nivel={2} prueba={prueba}>
        <label className="form__field">
          <span>Forma</span>
          <select
            value={f?.forma ?? 'rectangulo'}
            disabled={saving}
            data-testid={`${prueba}-forma`}
            onChange={(e) => set({ forma: { ...f, forma: e.target.value as Shape } })}
          >
            {SHAPES.map((v) => (
              <option key={v} value={v}>
                {SHAPE_LABEL[v]}
              </option>
            ))}
          </select>
        </label>

        <div className="form__field">
          <span>Relleno</span>
          <ColorPalette
            valor={f?.relleno ?? 'primario'}
            nombre="el relleno"
            prueba={`${prueba}-relleno`}
            onCambiar={(relleno) => set({ forma: { ...f, forma: f?.forma ?? 'rectangulo', relleno } })}
          />
        </div>

        <label className="form__field">
          <span>Opacidad</span>
          <select
            value={String(f?.opacidad ?? 100)}
            disabled={saving}
            data-testid={`${prueba}-opacidad`}
            onChange={(e) =>
              set({ forma: { ...f, forma: f?.forma ?? 'rectangulo', opacidad: Number(e.target.value) } })
            }
          >
            {[12, 25, 50, 75, 100].map((o) => (
              <option key={o} value={o}>
                {o} %
              </option>
            ))}
          </select>
        </label>

        <label className="form__field">
          <span>Texto dentro</span>
          <input
            defaultValue={f?.content ?? ''}
            disabled={saving}
            data-testid={`${prueba}-texto`}
            onBlur={(e) =>
              set({
                forma: { ...f, forma: f?.forma ?? 'rectangulo', content: e.target.value || undefined },
              })
            }
          />
        </label>
      </Section>
    );
  }

  if (objectId === 'conexion') {
    const c = conf.conexion;
    return (
      <Section titulo="Conexion" nivel={2} prueba={prueba}>
        {/*
          Los extremos se escriben por id y no se eligen de una lista porque el editor de esta
          seccion no conoce los demas objetos del modulo. Es la limitacion honesta: el campo dice
          exactamente que espera, y la conexion avisa en el lienzo cuando un extremo no existe.
        */}
        <label className="form__field">
          <span>Desde (id del objeto)</span>
          <input
            defaultValue={c?.desde ?? ''}
            disabled={saving}
            data-testid={`${prueba}-desde`}
            onBlur={(e) => set({ conexion: { ...c, desde: e.target.value || undefined } })}
          />
        </label>
        <label className="form__field">
          <span>Hasta (id del objeto)</span>
          <input
            defaultValue={c?.hasta ?? ''}
            disabled={saving}
            data-testid={`${prueba}-hasta`}
            onBlur={(e) => set({ conexion: { ...c, hasta: e.target.value || undefined } })}
          />
        </label>
        <label className="form__field">
          <span>Trazado</span>
          <select
            value={c?.dash ?? 'angulo'}
            disabled={saving}
            data-testid={`${prueba}-trazado`}
            onChange={(e) => set({ conexion: { ...c, dash: e.target.value as Dash } })}
          >
            {TRAZADOS.map((t) => (
              <option key={t} value={t}>
                {DASH_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="editor__interruptor">
          <input
            type="checkbox"
            checked={c?.finalEnd === 'flecha'}
            disabled={saving}
            data-testid={`${prueba}-flecha`}
            onChange={(e) =>
              set({ conexion: { ...c, finalEnd: e.target.checked ? 'flecha' : 'ninguno' } })
            }
          />{' '}
          Punta de flecha al final
        </label>
        <EditorLine
          line={c?.estiloDeLinea}
          prueba={`${prueba}-l`}
          saving={saving}
          onCambiar={(estiloDeLinea) => set({ conexion: { ...c, estiloDeLinea } })}
        />
      </Section>
    );
  }

  /* ── Contenedores ─────────────────────────────────────────────────────────────────────── */

  const panels = panelsOf(conf);
  const gridColumns =
    conf.simple?.gridColumns ??
    conf.scrollable?.gridColumns ??
    conf.expandable?.gridColumns ??
    conf.tabs?.gridColumns ??
    6;

  const columnSet = (n: number) => {
    // Las columnas viven en el bloque del tipo, asi que cada uno pone las suyas. Se resuelve con
    // un mapa y no con cinco ifs sueltos para que anadir un contenedor no tenga que acordarse.
    const block: Record<string, keyof ContainerSettings> = {
      'contenedor-simple': 'simple',
      'contenedor-desplazable': 'scrollable',
      'contenedor-ampliable': 'expandable',
      'contenedor-con-pestanas': 'tabs',
    };
    const clave = block[objectId] ?? 'simple';
    set({ [clave]: { ...(conf[clave] as object), gridColumns: n } } as ContainerSettings);
  };

  return (
    <Section titulo="Contenedor" nivel={2} prueba={prueba}>
      <label className="form__field">
        <span>Columnas internas</span>
        <select
          value={String(gridColumns)}
          disabled={saving}
          data-testid={`${prueba}-columnas`}
          onChange={(e) => columnSet(Number(e.target.value))}
        >
          {[2, 3, 4, 6, 8, 12].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="field__pista">La rejilla de dentro es independiente de la del modulo.</span>
      </label>

      {objectId === 'contenedor-desplazable' ? (
        <label className="form__field">
          <span>Eje de desplazamiento</span>
          <select
            value={conf.scrollable?.axis ?? 'y'}
            disabled={saving}
            data-testid={`${prueba}-eje`}
            onChange={(e) =>
              set({ scrollable: { ...conf.scrollable, axis: e.target.value as Axis } })
            }
          >
            {AXES.map((e) => (
              <option key={e} value={e}>
                {AXIS_LABEL[e]}
              </option>
            ))}
          </select>
          <span className="field__pista">Uno solo. El otro eje nunca se desplaza.</span>
        </label>
      ) : null}

      {objectId === 'contenedor-ampliable' ? (
        <label className="form__field">
          <span>Columnas al ampliar</span>
          <select
            value={String(conf.expandable?.expandedColumns ?? 12)}
            disabled={saving}
            data-testid={`${prueba}-columnas-ampliado`}
            onChange={(e) =>
              set({ expandable: { ...conf.expandable, expandedColumns: Number(e.target.value) } })
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
            <label key={panel.panelId} className="form__field">
              <span>Tab {i + 1}</span>
              <input
                defaultValue={panel.nombre}
                disabled={saving}
                data-testid={`${prueba}-pestana-${panel.panelId}`}
                onBlur={(e) =>
                  set({
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
            disabled={saving}
            data-testid={`${prueba}-anadir-pestana`}
            onClick={() => set({ panels: [...panels, EMPTY_PANEL(panels.length + 1)] })}
          >
            Anadir pestana
          </button>
        </>
      ) : null}
    </Section>
  );
}
