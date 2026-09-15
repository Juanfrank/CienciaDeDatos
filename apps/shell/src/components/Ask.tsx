'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslator } from './Locale';

/** Caja de pregunta en lenguaje natural — seccion 4.9. */
export function Ask({ moduleSlug }: { moduleSlug: string }) {
  const t = useTranslator();
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
    const r = await fetch('/api/query', {
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
        {t('ask.label')}
      </label>
      <input
        id="pregunta"
        className="ask__field"
        value={pregunta}
        placeholder={t('ask.placeholder')}
        data-testid="pregunta"
        onChange={(e) => setPregunta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void preguntar();
        }}
      />
      <button type="button" className="button-link" data-testid="preguntar" onClick={() => void preguntar()}>
        {t('ask.submit')}
      </button>

      {/* Region viva: la respuesta aparece sin recargar y hay que anunciarla. */}
      <div className="ask__response" role="status" aria-live="polite">
        {respuesta ? (
          <>
            <p data-testid="pregunta-entendido">
              <strong>{t('ask.understood')}</strong> {respuesta.entendido}
            </p>
            {respuesta.noEntendido.length > 0 ? (
              <p className="muted-text" data-testid="pregunta-no-entendido">
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
                {t('ask.apply')}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
