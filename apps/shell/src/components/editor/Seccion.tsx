'use client';

import { createContext, useContext } from 'react';

/**
 * Seccion colapsable del panel.
 *
 * Es un `<details>` y no un div con estado por el mismo motivo de siempre: el navegador ya trae
 * el gesto, el manejo de teclado y el anuncio de plegado a un lector de pantalla. Reimplementarlo
 * son treinta lineas que se rompen en el primer caso raro.
 *
 * `abierta` decide el estado INICIAL, no lo controla. Una seccion controlada se cerraria sola en
 * cada guardado —el panel se redibuja entero— y quien estuviera trabajando en ella la veria
 * plegarse bajo el cursor.
 */

/**
 * El filtro del buscador, por CONTEXTO y no por props.
 *
 * El panel tiene dieciocho secciones repartidas en mil quinientas lineas de JSX, muchas anidadas
 * dentro de condicionales. Pasar el filtro por props obligaria a atravesar cada una de esas
 * ramas, y la primera que alguien anada sin acordarse se quedaria fuera del buscador sin fallar:
 * simplemente no aparece nunca al buscar. Con contexto, una seccion nueva entra sola.
 */
const FiltroDeSecciones = createContext('');

export function ProveedorDeFiltro({ filtro, children }: { filtro: string; children: React.ReactNode }) {
  return <FiltroDeSecciones.Provider value={filtro}>{children}</FiltroDeSecciones.Provider>;
}

/** Sin acentos y en minusculas: quien busca «grafico» tiene que encontrar «Gráfico». */
const normalizar = (texto: string): string =>
  texto
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
  /**
   * Con que otras palabras se busca esta seccion.
   *
   * Nadie busca «Lineas de referencia»: busca «meta» o «umbral», que es como se llama eso en su
   * cabeza. Un buscador que solo mira el titulo obliga a saber ya como se llama lo que se busca,
   * que es justo el problema que viene a resolver.
   */
  claves?: string[];
  children: React.ReactNode;
}) {
  const filtro = normalizar(useContext(FiltroDeSecciones).trim());
  const coincide =
    filtro === '' ||
    normalizar(titulo).includes(filtro) ||
    (claves ?? []).some((clave) => normalizar(clave).includes(filtro));

  if (!coincide) return null;

  return (
    <details
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
