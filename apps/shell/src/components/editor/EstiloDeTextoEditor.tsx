'use client';

import {
  ALINEACIONES,
  ALINEACIONES_VERTICALES,
  COLORES_DE_TEXTO,
  type Alineacion,
  type AlineacionVertical,
  type ColorDeTexto,
  type EstiloDeTexto,
} from '@app/ui-components';
import { Ayuda } from './Ayuda';

/**
 * Peso, estilo, alineacion y color de un texto — el mismo control para los tres destinos.
 *
 * Es un componente y no tres bloques copiados en el panel porque configurar el titulo y configurar
 * la cifra son la misma operacion sobre cosas distintas: con tres copias, anadir «tachado» algun
 * dia significaria acordarse de tocar tres sitios.
 *
 * La alineacion vertical solo se ofrece donde hay alto que repartir. En un titulo de una linea no
 * significa nada, y un control que no hace nada es peor que no tenerlo.
 */

const ETIQUETA_DE_COLOR: Record<ColorDeTexto, string> = {
  predeterminado: 'Predeterminado',
  primario: 'Primario',
  secundario: 'Secundario',
  terciario: 'Terciario',
  error: 'Error',
  atenuado: 'Atenuado',
};

/** La muestra de cada rol. Se lee del tema, no de una lista de hex duplicada aqui. */
const VARIABLE: Record<ColorDeTexto, string> = {
  predeterminado: 'var(--md-sys-color-on-surface)',
  primario: 'var(--md-sys-color-primary)',
  secundario: 'var(--md-sys-color-secondary)',
  terciario: 'var(--md-sys-color-tertiary)',
  error: 'var(--md-sys-color-error)',
  atenuado: 'var(--md-sys-color-on-surface-variant)',
};

const ETIQUETA_DE_ALINEACION: Record<Alineacion, string> = {
  izquierda: 'Izquierda',
  centro: 'Centro',
  derecha: 'Derecha',
};

const ETIQUETA_VERTICAL: Record<AlineacionVertical, string> = {
  arriba: 'Arriba',
  medio: 'Medio',
  abajo: 'Abajo',
};

/**
 * La paleta, como metodo comun.
 *
 * Seis muestras, y cada una es un ROL del tema — no un color elegido a mano. Es la unica forma de
 * que siga existiendo la garantia de 4.3: un color suelto no tiene par de contraste comprobado
 * contra la superficie donde acabe, ni sigue al tema oscuro. La muestra se pinta con la variable
 * del tema, asi que la paleta cambia sola cuando cambia el tema.
 *
 * `radiogroup` y no una lista de botones: elegir un color es elegir UNO de un conjunto, y con
 * radios las flechas del teclado recorren la paleta como se espera.
 */
export function PaletaDeColores({
  valor,
  nombre,
  prueba,
  onCambiar,
}: {
  valor: ColorDeTexto;
  nombre: string;
  prueba: string;
  onCambiar: (color: ColorDeTexto) => void;
}) {
  return (
    <div className="paleta" role="radiogroup" aria-label={`Color de ${nombre}`}>
      {COLORES_DE_TEXTO.map((color) => (
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
  ayuda,
  estilo,
  conVertical = false,
  prueba,
  guardando,
  onCambiar,
}: {
  titulo: string;
  ayuda?: string;
  estilo: EstiloDeTexto;
  /** Solo donde hay alto que repartir. */
  conVertical?: boolean;
  prueba: string;
  guardando: boolean;
  onCambiar: (estilo: EstiloDeTexto) => void;
}) {
  const cambiar = (parcial: Partial<EstiloDeTexto>) => onCambiar({ ...estilo, ...parcial });

  const interruptor = (
    clave: 'negrita' | 'cursiva' | 'subrayado',
    etiqueta: string,
    glifo: string,
  ) => (
    <button
      type="button"
      className="estilo-texto__boton"
      aria-pressed={estilo[clave] === true}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={guardando}
      data-testid={`${prueba}-${clave}`}
      onClick={() => cambiar({ [clave]: !estilo[clave] })}
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
    <div className="estilo-texto">
      <p className="estilo-texto__rotulo">
        {titulo}
        {ayuda ? <Ayuda texto={ayuda} de={titulo} /> : null}
      </p>

      <div className="estilo-texto__fila" role="group" aria-label={`Estilo de ${titulo}`}>
        {interruptor('negrita', 'Negrita', 'B')}
        {interruptor('cursiva', 'Cursiva', 'I')}
        {interruptor('subrayado', 'Subrayado', 'U')}
      </div>

      <label className="formulario__campo">
        <span>Alineacion</span>
        <select
          value={estilo.alineacion ?? 'izquierda'}
          disabled={guardando}
          data-testid={`${prueba}-alineacion`}
          onChange={(e) => cambiar({ alineacion: e.target.value as Alineacion })}
        >
          {ALINEACIONES.map((a) => (
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
            value={estilo.alineacionVertical ?? 'arriba'}
            disabled={guardando}
            data-testid={`${prueba}-vertical`}
            onChange={(e) => cambiar({ alineacionVertical: e.target.value as AlineacionVertical })}
          >
            {ALINEACIONES_VERTICALES.map((a) => (
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
          valor={estilo.color ?? 'predeterminado'}
          nombre={titulo}
          prueba={`${prueba}-color`}
          onCambiar={(color) => cambiar({ color })}
        />
      </div>
    </div>
  );
}
