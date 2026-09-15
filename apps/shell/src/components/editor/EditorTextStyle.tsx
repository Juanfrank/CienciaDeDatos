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
import { Help } from './Help';
import { useTranslator } from '../Locale';

/** Peso, estilo, alineacion y color de un texto — el mismo control para los tres destinos. */

const COLOR_LABEL: Record<TextColor, string> = {
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

const ALIGNMENT_LABEL: Record<Alignment, string> = {
  izquierda: 'Izquierda',
  centro: 'Centro',
  derecha: 'Derecha',
};

const VERTICAL_LABEL: Record<VerticalAlignment, string> = {
  arriba: 'Arriba',
  medio: 'Medio',
  abajo: 'Abajo',
};

/** La paleta, como metodo comun. */
export function ColorPalette({
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
          aria-label={COLOR_LABEL[color]}
          title={COLOR_LABEL[color]}
          className="palette__muestra"
          data-testid={`${prueba}-${color}`}
          style={{ background: VARIABLE[color] }}
          onClick={() => onCambiar(color)}
        />
      ))}
    </div>
  );
}

export function EditorTextStyle({
  titulo,
  help,
  style,
  withVertical = false,
  prueba,
  saving,
  onCambiar,
}: {
  titulo: string;
  help?: string;
  style: TextStyle;
  /** Solo donde hay alto que repartir. */
  withVertical?: boolean;
  prueba: string;
  saving: boolean;
  onCambiar: (style: TextStyle) => void;
}) {
  const t = useTranslator();
  const cambiar = (parcial: Partial<TextStyle>) => onCambiar({ ...style, ...parcial });

  const interruptor = (
    clave: 'negrita' | 'cursiva' | 'subrayado',
    etiqueta: string,
    glifo: string,
  ) => (
    <button
      type="button"
      className="text-style__button"
      aria-pressed={style[clave] === true}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={saving}
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
    <div className="text-style" data-testid={prueba}>
      <p className="text-style__label">
        {titulo}
        {help ? <Help content={help} de={titulo} /> : null}
      </p>

      <div className="text-style__row" role="group" aria-label={`Estilo de ${titulo}`}>
        {interruptor('negrita', 'Negrita', 'B')}
        {interruptor('cursiva', 'Cursiva', 'I')}
        {interruptor('subrayado', 'Subrayado', 'U')}
      </div>

      <label className="form__field">
        <span>{t('editor.align')}</span>
        <select
          value={style.alignment ?? 'izquierda'}
          disabled={saving}
          data-testid={`${prueba}-alineacion`}
          onChange={(e) => cambiar({ alignment: e.target.value as Alignment })}
        >
          {ALIGNMENTS.map((a) => (
            <option key={a} value={a}>
              {ALIGNMENT_LABEL[a]}
            </option>
          ))}
        </select>
      </label>

      {withVertical ? (
        <label className="form__field">
          <span>{t('editor.alignVertical')}</span>
          <select
            value={style.verticalAlignment ?? 'arriba'}
            disabled={saving}
            data-testid={`${prueba}-vertical`}
            onChange={(e) => cambiar({ verticalAlignment: e.target.value as VerticalAlignment })}
          >
            {VERTICAL_ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {VERTICAL_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="form__field">
        <span>{t('color.rules.color')}</span>
        <ColorPalette
          valor={style.color ?? 'predeterminado'}
          nombre={titulo}
          prueba={`${prueba}-color`}
          onCambiar={(color) => cambiar({ color })}
        />
      </div>
    </div>
  );
}
