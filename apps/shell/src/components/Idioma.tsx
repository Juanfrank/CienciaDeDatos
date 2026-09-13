'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, createTranslator, type Locale, type Translator } from '@app/i18n';

/**
 * El traductor para los componentes de cliente.
 *
 * El idioma lo decide el servidor y baja como propiedad al proveedor, no se vuelve a negociar
 * aqui: si el cliente lo resolviera por su cuenta, la primera pintura llegaria en un idioma y la
 * hidratacion en otro.
 */
const Contexto = createContext<Locale>(DEFAULT_LOCALE);

export function ProveedorDeIdioma({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <Contexto.Provider value={locale}>{children}</Contexto.Provider>;
}

export function useTraductor(): Translator {
  const locale = useContext(Contexto);
  return useMemo(() => createTranslator(locale), [locale]);
}
