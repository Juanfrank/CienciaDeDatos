'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type Bookmark, bookmarkToUrl } from '@app/module-model';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { IconButton } from './icons/IconButton';

/** Marcadores — seccion 4.4. */
export function Bookmarks({
  moduleSlug,
  pageSlug,
}: {
  moduleSlug: string;
  pageSlug?: string;
}) {
  const router = useRouter();
  const { searchParams } = useUrlFilters();
  const [bookmarks, setMarcadores] = useState<Bookmark[]>([]);
  const [nombre, setNombre] = useState('');
  const [abierto, setAbierto] = useState(false);

  const recargar = async () => {
    const r = await fetch('/api/marcadores');
    const { bookmarks: lista } = (await r.json()) as { bookmarks: Bookmark[] };
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

  const moduleEste = bookmarks.filter((m) => m.moduleSlug === moduleSlug);

  return (
    <div className="marcadores">
      <IconButton
        icono="marcador"
        etiqueta="Marcadores"
        contador={moduleEste.length}
        presionado={abierto}
        data-testid="open-bookmarks"
        onClick={() => setAbierto((v) => !v)}
      />

      {abierto ? (
        <div className="bookmarks__panel" data-testid="bookmarks-panel">
          <div className="bookmarks__save">
            <input
              type="text"
              value={nombre}
              placeholder="Nombre del marcador"
              data-testid="bookmark-name"
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void guardar();
              }}
            />
            <button type="button" data-testid="save-bookmark" onClick={() => void guardar()}>
              Guardar vista actual
            </button>
          </div>

          {moduleEste.length === 0 ? (
            <p className="muted-text">Sin marcadores en este modulo.</p>
          ) : (
            <ul className="bookmarks__list">
              {moduleEste.map((m) => (
                <li key={m.id}>
                  <Link href={bookmarkToUrl(m)} data-testid={`bookmark-${m.name}`}>
                    {m.name}
                  </Link>
                  {m.ownerUserId ? <span className="muted-text"> · {m.ownerUserId}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
