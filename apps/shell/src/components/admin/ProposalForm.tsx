'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { pedir, motivoDeFallo } from '../pedir';

/** Proponer que una version de un objeto se certifique — seccion 4.5. */
export function ProposalForm({
  objetos,
  preseleccion,
  etiquetas,
}: {
  objetos: { id: string; name: string }[];
  preseleccion: string;
  etiquetas: { titulo: string; objeto: string; version: string; resumen: string; enviar: string };
}) {
  const router = useRouter();
  const ids = { objeto: useId(), version: useId(), resumen: useId() };
  const [objeto, setObjeto] = useState(preseleccion || (objetos[0]?.id ?? ''));
  const [version, setVersion] = useState('');
  const [resumen, setResumen] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function proponer() {
    setEnCurso(true);
    setError(null);
    const respuesta = await pedir('/api/admin/resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accion: 'proponer', objectId: objeto, version, summary: resumen }),
    });
    setEnCurso(false);
    if (!respuesta?.ok) {
      setError(await motivoDeFallo(respuesta, 'No se pudo proponer.'));
      return;
    }
    setVersion('');
    setResumen('');
    router.refresh();
  }

  return (
    <details className="form__field" data-testid="proposal-form">
      <summary>{etiquetas.titulo}</summary>

      <p className="form__field">
        <label htmlFor={ids.objeto}>{etiquetas.objeto}</label>
        <select
          id={ids.objeto}
          value={objeto}
          data-testid="proposal-object"
          onChange={(e) => setObjeto(e.target.value)}
        >
          {objetos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </p>

      <p className="form__field">
        <label htmlFor={ids.version}>{etiquetas.version}</label>
        <input
          id={ids.version}
          value={version}
          placeholder="2.0.0"
          data-testid="proposal-version"
          onChange={(e) => setVersion(e.target.value)}
        />
      </p>

      <p className="form__field">
        {/* El changelog es obligatorio por version (4.5): una propuesta sin el no se revisa. */}
        <label htmlFor={ids.resumen}>{etiquetas.resumen}</label>
        <textarea
          id={ids.resumen}
          rows={3}
          value={resumen}
          data-testid="proposal-summary"
          onChange={(e) => setResumen(e.target.value)}
        />
      </p>

      <p>
        <button
          type="button"
          className="pastilla"
          disabled={enCurso || version.trim() === '' || resumen.trim() === ''}
          data-testid="proposal-submit"
          onClick={() => void proponer()}
        >
          {etiquetas.enviar}
        </button>
      </p>

      {error ? (
        <p className="aviso notice-error" role="alert" data-testid="proposal-error">
          {error}
        </p>
      ) : null}
    </details>
  );
}
