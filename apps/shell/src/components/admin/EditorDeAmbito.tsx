'use client';

import { useEffect, useState } from 'react';
import type { AccessScope } from '@app/access-control';

/**
 * Editor de ambitos — seccion 4.10.8, y la puerta de 4.10.4.
 *
 * Dos reglas que la interfaz hace visibles:
 *  1. Las dimensiones se ELIGEN de una lista que sale del esquema real. Nunca se escriben a mano.
 *  2. Si el ambito propuesto AMPLIA, el servidor lo rechaza y la interfaz pide una justificacion
 *     de TEXTO —no una casilla— antes de reintentar.
 *
 * La comprobacion real esta en el servidor (`guardarAmbito`). Esto es la interfaz de esa regla,
 * no la regla: quitar este formulario no permitiria ampliar sin justificar.
 */
interface Dimension {
  table: string;
  field: string;
  key: string;
}

export interface DestinoDeAmbito {
  tipo: 'carpeta' | 'equipo';
  id: string;
  nombre: string;
  scope: AccessScope;
}

export function EditorDeAmbito({ destinos }: { destinos: DestinoDeAmbito[] }) {
  const [dimensiones, setDimensiones] = useState<Dimension[]>([]);
  const [destinoId, setDestinoId] = useState(destinos[0]?.id ?? '');
  const [restricciones, setRestricciones] = useState<AccessScope['restrictions']>([]);
  const [justificacion, setJustificacion] = useState('');
  const [ampliacion, setAmpliacion] = useState<string[] | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const destino = destinos.find((d) => d.id === destinoId);

  useEffect(() => {
    void fetch('/api/admin/esquema')
      .then((r) => r.json())
      .then((c: { dimensiones?: Dimension[] }) => setDimensiones(c.dimensiones ?? []));
  }, []);

  useEffect(() => {
    setRestricciones(destino ? structuredClone(destino.scope.restrictions) : []);
    setAmpliacion(null);
    setJustificacion('');
    setMensaje(null);
  }, [destinoId, destino]);

  const guardar = async () => {
    if (!destino) return;
    setMensaje(null);

    const cuerpo = {
      destino:
        destino.tipo === 'carpeta'
          ? { tipo: 'carpeta' as const, nodeId: destino.id }
          : { tipo: 'equipo' as const, teamId: destino.id },
      scope: { restrictions: restricciones },
      ...(justificacion.trim() ? { justificacion: justificacion.trim() } : {}),
    };

    const r = await fetch('/api/admin/ambitos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const respuesta = await r.json();

    if (r.status === 422 && respuesta.detail?.dimensiones) {
      // El servidor detecto una ampliacion. Se pide justificacion y se reintenta.
      setAmpliacion(respuesta.detail.dimensiones as string[]);
      return;
    }
    if (!r.ok) {
      setMensaje({ tipo: 'error', texto: respuesta.error ?? 'No se pudo guardar.' });
      return;
    }

    setAmpliacion(null);
    setJustificacion('');
    setMensaje({ tipo: 'ok', texto: 'Ambito guardado.' });
  };

  return (
    <div className="editor-ambito">
      <label className="campo">
        <span>Ambito de</span>
        <select
          value={destinoId}
          data-testid="selector-destino-ambito"
          onChange={(e) => setDestinoId(e.target.value)}
        >
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.tipo === 'carpeta' ? 'Carpeta' : 'Equipo'}: {d.nombre}
            </option>
          ))}
        </select>
      </label>

      <ul className="lista-simple" data-testid="restricciones">
        {restricciones.map((r, i) => (
          <li key={`${r.dimension.table}.${r.dimension.field}`}>
            <code>
              {r.dimension.table}.{r.dimension.field}
            </code>
            <input
              type="text"
              value={r.allowedValues.join(', ')}
              data-testid={`valores-${r.dimension.table}.${r.dimension.field}`}
              aria-label={`Valores permitidos para ${r.dimension.table}.${r.dimension.field}`}
              onChange={(e) => {
                const valores = e.target.value
                  .split(',')
                  .map((v) => v.trim())
                  .filter(Boolean);
                setRestricciones((prev) =>
                  prev.map((x, j) => (j === i ? { ...x, allowedValues: valores } : x)),
                );
              }}
            />
            <button
              type="button"
              className="boton-enlace"
              onClick={() => setRestricciones((prev) => prev.filter((_, j) => j !== i))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ul>

      <label className="campo">
        <span>Añadir restriccion sobre</span>
        {/* Solo dimensiones del esquema real: nunca texto libre sin validar (4.10.8). */}
        <select
          defaultValue=""
          data-testid="anadir-dimension"
          onChange={(e) => {
            const dim = dimensiones.find((d) => d.key === e.target.value);
            if (!dim) return;
            setRestricciones((prev) => [
              ...prev.filter((r) => `${r.dimension.table}.${r.dimension.field}` !== dim.key),
              { dimension: { table: dim.table, field: dim.field }, allowedValues: [] },
            ]);
            e.target.value = '';
          }}
        >
          <option value="">Elegir dimension…</option>
          {dimensiones.map((d) => (
            <option key={d.key} value={d.key}>
              {d.key}
            </option>
          ))}
        </select>
      </label>

      {ampliacion ? (
        <div className="aviso aviso--atencion" role="alert" data-testid="aviso-ampliacion">
          <p>
            <strong>Esto AMPLIA el acceso</strong> en: <code>{ampliacion.join(', ')}</code>
          </p>
          <p className="texto-atenuado">
            Una ampliacion exige justificacion y queda registrada aparte en el panel de auditoria.
          </p>
          <label className="campo">
            <span>Justificacion</span>
            <textarea
              value={justificacion}
              rows={2}
              data-testid="justificacion-ampliacion"
              onChange={(e) => setJustificacion(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {mensaje ? (
        <p
          className={`aviso ${mensaje.tipo === 'ok' ? 'aviso--ok' : 'aviso--error'}`}
          role="status"
          data-testid="mensaje-ambito"
        >
          {mensaje.texto}
        </p>
      ) : null}

      <button type="button" data-testid="guardar-ambito" onClick={() => void guardar()}>
        {ampliacion ? 'Guardar con justificacion' : 'Guardar ambito'}
      </button>
    </div>
  );
}
