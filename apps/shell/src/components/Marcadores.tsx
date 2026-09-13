'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type Bookmark, bookmarkToUrl } from '@app/module-model';
import { useFiltrosDeUrl } from '../hooks/useFiltrosDeUrl';
import { BotonDeIcono } from './iconos/BotonDeIcono';

/** Marcadores — seccion 4.4. */
export function Marcadores({
  moduleSlug,
  pageSlug,
}: {
  moduleSlug: string;
  pageSlug?: string;
}) {
  const router = useRouter();
  const { searchParams } = useFiltrosDeUrl();
  const [marcadores, setMarcadores] = useState<Bookmark[]>([]);
  const [nombre, setNombre] = useState('');
  const [abierto, setAbierto] = useState(false);

  const recargar = async () => {
    const r = await fetch('/api/marcadores');
    const { marcadores: lista } = (await r.json()) as { marcadores: Bookmark[] };
    setMarcadores(lista);
  };

  useEffect(() => {
    void recargar();
  }, []);

  const guardar = async () => {
    if (!nombre.trim()) return;
    await fetch('/api/marcadores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: nombre,
        moduleSlug,
        pageSlug,
        query: searchParams.toString(),
        compartir: true,
      }),
    });
    setNombre('');
    await recargar();
    router.refresh();
  };

  const deEsteModulo = marcadores.filter((m) => m.moduleSlug === moduleSlug);

  return (
    <div className="marcadores">
      <BotonDeIcono
        icono="marcador"
        etiqueta="Marcadores"
        contador={deEsteModulo.length}
        presionado={abierto}
        data-testid="abrir-marcadores"
        onClick={() => setAbierto((v) => !v)}
      />

      {abierto ? (
        <div className="marcadores__panel" data-testid="panel-marcadores">
          <div className="marcadores__guardar">
            <input
              type="text"
              value={nombre}
              placeholder="Nombre del marcador"
              data-testid="nombre-marcador"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void guardar();
              }}
            />
            <button type="button" data-testid="guardar-marcador" onClick={() => void guardar()}>
              Guardar vista actual
            </button>
          </div>

          {deEsteModulo.length === 0 ? (
            <p className="texto-atenuado">Sin marcadores en este modulo.</p>
          ) : (
            <ul className="marcadores__lista">
              {deEsteModulo.map((m) => (
                <li key={m.id}>
                  <Link href={bookmarkToUrl(m)} data-testid={`marcador-${m.name}`}>
                    {m.name}
                  </Link>
                  {m.ownerUserId ? <span className="texto-atenuado"> · {m.ownerUserId}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
