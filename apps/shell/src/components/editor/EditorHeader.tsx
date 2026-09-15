'use client';

/*
 * De CLIENTE, y no porque tenga estado: porque lo dibujan los dos lados.
 *
 * `app/editor/page.tsx` es un componente de servidor y `ModuleEditor` es de cliente, y los dos lo
 * montan. Sin declararlo, Next lo trata como de servidor cuando lo pide el primero y el hook del
 * traductor revienta en tiempo de ejecucion — no al compilar, que es lo que hizo que pasara la
 * construccion y fallara el navegador.
 */
import Link from 'next/link';
import { useTranslator } from '../Locale';

/** La cabecera del editor. */
export function EditorHeader() {
  const t = useTranslator();
  return (
    <header className="admin__header">
      <div>
        <h1>{t('editor.title')}</h1>
        <p className="muted-text">
          Objetos prediseñados enlazados a datasets certificados, nunca a una consulta escrita a
          mano
        </p>
      </div>
      <Link href="/" className="boton-contorno" data-testid="volver-a-modulos">
        {t('chrome.backToModules')}
      </Link>
    </header>
  );
}
