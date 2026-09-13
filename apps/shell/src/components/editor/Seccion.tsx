'use client';

import { createContext, useContext, useEffect, useRef } from 'react';

/** Seccion colapsable del panel. */

/** El filtro del buscador, por CONTEXTO y no por props. */
const FiltroDeSecciones = createContext('');

export function ProveedorDeFiltro({ filtro, children }: { filtro: string; children: React.ReactNode }) {
  return <FiltroDeSecciones.Provider value={filtro}>{children}</FiltroDeSecciones.Provider>;
}

/** Sin acentos y en minusculas: quien busca «grafico» tiene que encontrar «Gráfico». */
const normalizar = (content: string): string =>
  content
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export function Seccion({
  titulo,
  abierta = true,
  nivel = 1,
  prueba,
  claves,
  children,
}: {
  titulo: string;
  abierta?: boolean;
  /** 2 para una subseccion: mismo mecanismo, menos peso visual. */
  nivel?: 1 | 2;
  prueba?: string;
  /** Con que otras palabras se busca esta seccion. */
  claves?: string[];
  children: React.ReactNode;
}) {
  const filtro = normalizar(useContext(FiltroDeSecciones).trim());

  /*
   * Buscando, la seccion se abre POR EL DOM y no solo por la propiedad `open`.
   */
  const detalle = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (filtro !== '' && detalle.current) detalle.current.open = true;
  }, [filtro]);

  const coincide =
    filtro === '' ||
    normalizar(titulo).includes(filtro) ||
    (claves ?? []).some((clave) => normalizar(clave).includes(filtro));

  if (!coincide) return null;

  return (
    <details
      ref={detalle}
      className="seccion"
      data-nivel={nivel}
      // Buscando, las secciones que quedan se abren: si siguieran plegadas, encontrar una
      // obligaria a un clic mas para ver lo que se estaba buscando.
      open={filtro === '' ? abierta : true}
      {...(prueba ? { 'data-testid': prueba } : {})}
    >
      <summary className="seccion__titulo">{titulo}</summary>
      <div className="seccion__cuerpo">{children}</div>
    </details>
  );
}
