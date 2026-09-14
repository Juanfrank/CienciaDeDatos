'use client';

import { useEffect, useState } from 'react';
import type { AccessScope } from '@app/access-control';

/** Editor de ambitos — seccion 4.10.8, y la puerta de 4.10.4. */
interface Dimension {
  table: string;
  field: string;
  key: string;
}

export interface ScopeTarget {
  tipo: 'carpeta' | 'equipo';
  id: string;
  nombre: string;
  scope: AccessScope;
}

export function ScopeEditor({ targets }: { targets: ScopeTarget[] }) {
  const [dimensiones, setDimensiones] = useState<Dimension[]>([]);
  const [destinoId, setDestinoId] = useState(targets[0]?.id ?? '');
  const [restricciones, setRestricciones] = useState<AccessScope['restrictions']>([]);
  const [justificacion, setJustificacion] = useState('');
  const [ampliacion, setAmpliacion] = useState<string[] | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; content: string } | null>(null);

  const destino = targets.find((d) => d.id === destinoId);

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

    const body = {
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
      body: JSON.stringify(body),
    });
    const respuesta = await r.json();

    if (r.status === 422 && respuesta.detail?.dimensiones) {
      // El servidor detecto una ampliacion. Se pide justificacion y se reintenta.
      setAmpliacion(respuesta.detail.dimensiones as string[]);
      return;
    }
    if (!r.ok) {
      setMensaje({ tipo: 'error', content: respuesta.error ?? 'No se pudo guardar.' });
      return;
    }

    setAmpliacion(null);
    setJustificacion('');
    setMensaje({ tipo: 'ok', content: 'Ambito guardado.' });
  };

  return (
    <div className="scope-editor">
      <label className="campo">
        <span>Ambito de</span>
        <select
          value={destinoId}
          data-testid="picker-target-scope"
          onChange={(e) => setDestinoId(e.target.value)}
        >
          {targets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.tipo === 'carpeta' ? 'Carpeta' : 'Equipo'}: {d.nombre}
            </option>
          ))}
        </select>
      </label>

      <ul className="simple-list" data-testid="restricciones">
        {restricciones.map((r, i) => (
          <li key={`${r.dimension.table}.${r.dimension.field}`}>
            <code>
              {r.dimension.table}.{r.dimension.field}
            </code>
            <input
              type="text"
              value={r.allowedValues.join(', ')}
              data-testid={`values-${r.dimension.table}.${r.dimension.field}`}
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
              className="button-link"
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
          data-testid="add-dispersion"
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
        <div className="aviso notice-atencion" role="alert" data-testid="notice-ampliacion">
          <p>
            <strong>Esto AMPLIA el acceso</strong> en: <code>{ampliacion.join(', ')}</code>
          </p>
          <p className="muted-text">
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
          className={`aviso ${mensaje.tipo === 'ok' ? 'notice-ok' : 'notice-error'}`}
          role="status"
          data-testid="scope-message"
        >
          {mensaje.content}
        </p>
      ) : null}

      <button type="button" data-testid="save-scope" onClick={() => void guardar()}>
        {ampliacion ? 'Guardar con justificacion' : 'Guardar ambito'}
      </button>
    </div>
  );
}
