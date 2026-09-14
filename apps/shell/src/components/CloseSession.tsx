'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './icons/Icon';
import { useTranslator } from './Locale';

/** Quien esta dentro y como se sale (4.7). */

/**
 * Las iniciales del avatar.
 *
 * La primera del nombre y la primera del ULTIMO apellido: «Juan F. Medina C.» da JC, que es como
 * esa persona firma. Tomar las dos primeras palabras daria JF, que no identifica a nadie.
 */
export function initialsOf(nombre: string): string {
  const palabras = nombre
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean);
  const primera = palabras[0] ?? '';
  const ultima = palabras.length > 1 ? (palabras[palabras.length - 1] as string) : '';
  return `${primera.slice(0, 1)}${ultima.slice(0, 1)}`.toUpperCase() || '?';
}

export function CloseSession({
  user,
  displayName,
  mail,
}: {
  user: string;
  displayName?: string;
  mail?: string;
}) {
  const t = useTranslator();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  // Sin nombre en el directorio se muestra el identificador, que es lo que se mostraba antes.
  const nombre = displayName ?? user;

  const salir = async () => {
    setSaliendo(true);
    await fetch('/api/acceso', { method: 'DELETE' });
    // replace y no push: volver atras no debe devolver a una pagina de dentro.
    router.replace('/acceso');
    router.refresh();
  };

  return (
    <div className="account" data-testid="account">
      <span className="account__identity">
        <span className="account__name" data-testid="account-name">
          {nombre}
        </span>
        {mail ? (
          <span className="account__mail" data-testid="account-mail">
            {mail}
          </span>
        ) : null}
      </span>

      {/*
       * El avatar es decorativo: lo que dice ya esta escrito al lado, con mas detalle. Anunciarlo
       * haria que un lector de pantalla leyera «JC» antes del nombre completo.
       */}
      <span className="account__avatar" aria-hidden="true" data-testid="account-avatar">
        {initialsOf(nombre)}
      </span>

      <button
        type="button"
        className="account__exit"
        data-testid="close-session"
        disabled={saliendo}
        onClick={() => void salir()}
      >
        <Icon nombre="close" tamano={16} />
        {t('accion.salir')}
      </button>
    </div>
  );
}
