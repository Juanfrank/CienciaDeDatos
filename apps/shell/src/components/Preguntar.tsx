'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Caja de pregunta en lenguaje natural — seccion 4.9.
 *
 * Enseña lo que ENTENDIO antes de aplicarlo, y lo que no entendio al lado. Contestar en silencio
 * a medias —aplicar el filtro que se reconocio y callar el termino que no— es como se pierde la
 * confianza en una funcion asi: quien pregunta cree que la respuesta cubre lo que pidio.
 */
export function Preguntar({ moduleSlug }: { moduleSlug: string }) {
  const router = useRouter();
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState<{
    entendido: string;
    resoluble: boolean;
    noEntendido: string[];
    url: string;
  } | null>(null);

  const preguntar = async () => {
    if (!pregunta.trim()) return;
    const r = await fetch('/api/consulta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pregunta, modulo: moduleSlug }),
    });
    if (!r.ok) {
      setRespuesta({ entendido: 'No se pudo resolver la pregunta.', resoluble: false, noEntendido: [], url: '' });
      return;
    }
    setRespuesta(await r.json());
  };

  return (
    <div className="preguntar">
      <label className="visualmente-oculto" htmlFor="pregunta">
        Pregunte por estos datos
      </label>
      <input
        id="pregunta"
        className="preguntar__campo"
        value={pregunta}
        placeholder="Pregunte: casos pendientes en Penal"
        data-testid="pregunta"
        onChange={(e) => setPregunta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void preguntar();
        }}
      />
      <button type="button" className="boton-enlace" data-testid="preguntar" onClick={() => void preguntar()}>
        Preguntar
      </button>

      {/* Region viva: la respuesta aparece sin recargar y hay que anunciarla. */}
      <div className="preguntar__respuesta" role="status" aria-live="polite">
        {respuesta ? (
          <>
            <p data-testid="pregunta-entendido">
              <strong>Entendi:</strong> {respuesta.entendido}
            </p>
            {respuesta.noEntendido.length > 0 ? (
              <p className="texto-atenuado" data-testid="pregunta-no-entendido">
                No reconoci: {respuesta.noEntendido.join(', ')}. Solo se pueden usar las medidas y
                los valores que aparecen en este modulo.
              </p>
            ) : null}
            {respuesta.resoluble ? (
              <button
                type="button"
                className="pastilla"
                data-testid="pregunta-aplicar"
                onClick={() => router.push(respuesta.url)}
              >
                Ver esta vista
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
