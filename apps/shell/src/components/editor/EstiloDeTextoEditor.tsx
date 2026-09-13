'use client';

import {
  ALIGNMENTS,
  VERTICAL_ALIGNMENTS,
  TEXT_COLORS,
  type Alignment,
  type VerticalAlignment,
  type TextColor,
  type TextStyle,
} from '@app/ui-components';
import { Ayuda } from './Ayuda';

/** Peso, estilo, alineacion y color de un texto — el mismo control para los tres destinos. */

const ETIQUETA_DE_COLOR: Record<TextColor, string> = {
  predeterminado: 'Predeterminado',
  primario: 'Primario',
  secundario: 'Secundario',
  terciario: 'Terciario',
  error: 'Error',
  atenuado: 'Atenuado',
};

/** La muestra de cada rol. Se lee del tema, no de una lista de hex duplicada aqui. */
const VARIABLE: Record<TextColor, string> = {
  predeterminado: 'var(--md-sys-color-on-surface)',
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

const ETIQUETA_DE_ALINEACION: Record<Alignment, string> = {
  izquierda: 'Izquierda',
  centro: 'Centro',
  derecha: 'Derecha',
};

const ETIQUETA_VERTICAL: Record<VerticalAlignment, string> = {
  arriba: 'Arriba',
  medio: 'Medio',
  abajo: 'Abajo',
};

/** La paleta, como metodo comun. */
export function PaletaDeColores({
  valor,
  nombre,
  prueba,
  onCambiar,
}: {
  valor: TextColor;
  nombre: string;
  prueba: string;
  onCambiar: (color: TextColor) => void;
}) {
  return (
    /*
      El grupo lleva su propio identificador, ademas del de cada muestra.

      Sin el, para preguntar «¿esta la paleta?» hay que nombrar una muestra concreta —«el rojo»— y
      la pregunta pasa a depender de que ese color siga en la lista. El grupo ES el control; las
      muestras son sus opciones.
    */
    <div
      className="paleta"
      role="radiogroup"
      aria-label={`Color de ${nombre}`}
      data-testid={prueba}
    >
      {TEXT_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={valor === color}
          // El nombre del rol, no «muestra 3»: es lo que distingue una opcion de otra, y el color
          // por si solo no puede ser el unico portador de la diferencia (1.4.1).
          aria-label={ETIQUETA_DE_COLOR[color]}
          title={ETIQUETA_DE_COLOR[color]}
          className="paleta__muestra"
          data-testid={`${prueba}-${color}`}
          style={{ background: VARIABLE[color] }}
          onClick={() => onCambiar(color)}
        />
      ))}
    </div>
  );
}

export function EstiloDeTextoEditor({
  titulo,
  help,
  style,
  conVertical = false,
  prueba,
  guardando,
  onCambiar,
}: {
  titulo: string;
  help?: string;
  style: TextStyle;
  /** Solo donde hay alto que repartir. */
  conVertical?: boolean;
  prueba: string;
  guardando: boolean;
  onCambiar: (style: TextStyle) => void;
}) {
  const cambiar = (parcial: Partial<TextStyle>) => onCambiar({ ...style, ...parcial });

  const interruptor = (
    clave: 'negrita' | 'cursiva' | 'subrayado',
    etiqueta: string,
    glifo: string,
  ) => (
    <button
      type="button"
      className="estilo-texto__boton"
      aria-pressed={style[clave] === true}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={guardando}
      data-testid={`${prueba}-${clave}`}
      onClick={() => cambiar({ [clave]: !style[clave] })}
    >
      <span
        aria-hidden="true"
        style={{
          fontWeight: clave === 'negrita' ? 700 : 400,
          fontStyle: clave === 'cursiva' ? 'italic' : 'normal',
          textDecoration: clave === 'subrayado' ? 'underline' : 'none',
        }}
      >
        {glifo}
      </span>
    </button>
  );

  return (
    // Igual que la paleta: el bloque entero lleva identificador, ademas de cada control suyo.
    // Preguntar «¿se puede dar estilo al titulo?» no deberia obligar a nombrar la negrita.
    <div className="estilo-texto" data-testid={prueba}>
      <p className="estilo-texto__rotulo">
        {titulo}
        {help ? <Ayuda content={help} de={titulo} /> : null}
      </p>

      <div className="estilo-texto__fila" role="group" aria-label={`Estilo de ${titulo}`}>
        {interruptor('negrita', 'Negrita', 'B')}
        {interruptor('cursiva', 'Cursiva', 'I')}
        {interruptor('subrayado', 'Subrayado', 'U')}
      </div>

      <label className="formulario__campo">
        <span>Alineacion</span>
        <select
          value={style.alignment ?? 'izquierda'}
          disabled={guardando}
          data-testid={`${prueba}-alineacion`}
          onChange={(e) => cambiar({ alignment: e.target.value as Alignment })}
        >
          {ALIGNMENTS.map((a) => (
            <option key={a} value={a}>
              {ETIQUETA_DE_ALINEACION[a]}
            </option>
          ))}
        </select>
      </label>

      {conVertical ? (
        <label className="formulario__campo">
          <span>Alineacion vertical</span>
          <select
            value={style.verticalAlignment ?? 'arriba'}
            disabled={guardando}
            data-testid={`${prueba}-vertical`}
            onChange={(e) => cambiar({ verticalAlignment: e.target.value as VerticalAlignment })}
          >
            {VERTICAL_ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {ETIQUETA_VERTICAL[a]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="formulario__campo">
        <span>Color</span>
        <PaletaDeColores
          valor={style.color ?? 'predeterminado'}
          nombre={titulo}
          prueba={`${prueba}-color`}
          onCambiar={(color) => cambiar({ color })}
        />
      </div>
    </div>
  );
}
