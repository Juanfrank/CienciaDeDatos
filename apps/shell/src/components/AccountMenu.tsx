'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon, type IconName } from './icons/Icon';
import { useTranslator } from './Locale';

/** Quien esta dentro, a donde puede ir y como se sale (4.7 y 4.9). */

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

export interface AccountEntry {
  href: string;
  label: string;
  icono: IconName;
  prueba: string;
  /**
   * Esta entrada lleva el contador de avisos sin leer.
   *
   * Lo sondea el propio menu: es lo unico de aqui que cambia sin que nadie navegue.
   */
  cuentaAvisos?: boolean;
}

/** Cada cuanto se pregunta por los avisos sin leer. */
const MS_INTERVAL = 5_000;

export function AccountMenu({
  user,
  displayName,
  mail,
  entries,
}: {
  user: string;
  displayName?: string;
  mail?: string;
  entries: AccountEntry[];
}) {
  const t = useTranslator();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [withoutRead, setSinLeer] = useState(0);

  const hayAvisos = entries.some((e) => e.cuentaAvisos);

  /*
   * El contador se sondea aunque el menu este cerrado.
   *
   * Un aviso nuevo tiene que VERSE sin abrir nada: por eso el punto del avatar. Meter la campana
   * en el desplegable y nada mas seria esconder la unica senal que avisa de algo que no ha pasado
   * todavia cuando la persona mira la pantalla.
   */
  const consultar = useCallback(async () => {
    if (!hayAvisos) return;
    try {
      const r = await fetch('/api/notificaciones');
      if (!r.ok) return;
      const { withoutRead: n } = (await r.json()) as { withoutRead: number };
      setSinLeer(n);
    } catch {
      // Un sondeo fallido no es un error de la aplicacion: se reintenta en la vuelta siguiente.
    }
  }, [hayAvisos]);

  useEffect(() => {
    void consultar();
    const t = setInterval(() => void consultar(), MS_INTERVAL);
    return () => clearInterval(t);
  }, [consultar]);

  // Sin nombre en el directorio se muestra el identificador, que es lo que se mostraba antes.
  const nombre = displayName ?? user;

  /*
   * Se abre al posar el puntero Y al pulsar o enfocar.
   *
   * Solo con el puntero el menu no existe para quien navega con teclado ni para un lector de
   * pantalla, y 4.9 dice que la accesibilidad no se pospone. Son el mismo estado, no dos caminos:
   * el boton es el que manda, y el puntero solo lo enciende.
   */
  useEffect(() => {
    if (!abierto) return;

    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      // El foco vuelve al disparador: si se queda dentro de lo que acaba de desaparecer, el
      // siguiente tabulador empieza desde el principio del documento.
      disparador.current?.focus();
    };

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  const salir = async () => {
    setSaliendo(true);
    await fetch('/api/acceso', { method: 'DELETE' });
    // replace y no push: volver atras no debe devolver a una pagina de dentro.
    router.replace('/acceso');
    router.refresh();
  };

  return (
    <div
      className="account"
      ref={caja}
      data-testid="account"
      onMouseEnter={() => setAbierto(true)}
      onMouseLeave={() => setAbierto(false)}
    >
      <button
        type="button"
        ref={disparador}
        className="account__trigger"
        /*
         * El nombre tambien va en el `aria-label` porque en movil el CSS esconde el bloque que lo
         * escribe, y lo unico que queda dentro del boton es el avatar, que es decorativo: sin
         * esto el boton se queda sin nombre accesible justo en la pantalla mas pequena.
         */
        aria-label={nombre}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-controls={id}
        data-testid="account-trigger"
        onClick={(e) => {
          /*
           * Con raton el menu ya lo abrio el puntero al llegar hasta aqui, asi que alternar lo
           * CERRARIA justo al pulsarlo: se posa el cursor, se despliega, se pulsa y desaparece.
           * `detail === 0` es la activacion por teclado, donde no hubo puntero y alternar es lo
           * correcto. Con puntero solo abre; se cierra al salir, con Escape o pulsando fuera.
           */
          if (e.detail === 0) setAbierto((v) => !v);
          else setAbierto(true);
        }}
      >
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
          El avatar es decorativo: lo que dice ya esta escrito al lado, con mas detalle.
          Anunciarlo haria que un lector de pantalla leyera «JC» antes del nombre completo.
        */}
        <span className="account__avatar" aria-hidden="true" data-testid="account-avatar">
          {initialsOf(nombre)}
        </span>
        {withoutRead > 0 ? (
          <>
            <span className="account__dot" aria-hidden="true" data-testid="account-dot" />
            {/* El punto es visual; esto es lo que oye quien no lo ve. */}
            <span className="visually-hidden">{withoutRead} avisos sin leer</span>
          </>
        ) : null}
      </button>

      <div
        className="account__menu"
        id={id}
        role="menu"
        aria-label={`Opciones de ${nombre}`}
        hidden={!abierto}
        data-testid="account-menu"
      >
        {entries.map((entrada) => (
          <Link
            key={entrada.href}
            href={entrada.href}
            role="menuitem"
            className="account__item"
            data-testid={entrada.prueba}
            onClick={() => setAbierto(false)}
          >
            <Icon nombre={entrada.icono} tamano={16} />
            <span className="account__item-label">{entrada.label}</span>
            {entrada.cuentaAvisos && withoutRead > 0 ? (
              <span className="account__count" data-testid={`${entrada.prueba}-contador`}>
                {withoutRead}
              </span>
            ) : null}
          </Link>
        ))}

        <button
          type="button"
          role="menuitem"
          className="account__item account__item--exit"
          data-testid="close-session"
          disabled={saliendo}
          onClick={() => void salir()}
        >
          <Icon nombre="close" tamano={16} />
          <span className="account__item-label">{t('accion.salir')}</span>
        </button>
      </div>
    </div>
  );
}
