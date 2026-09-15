'use client';

import { useSyncExternalStore } from 'react';

/**
 * Mensajes emergentes: lo que acaba de pasar, dicho arriba y por un rato.
 *
 * Existe porque la alternativa era escribir el resultado DENTRO de la fila que lo produjo —«v1.0.0
 * → v1.4.0, lo que ya estaba configurado se conserva…»— y eso ensancha la celda, descuadra la
 * tabla entera y deja el texto ahi para siempre, como si fuera un dato mas de la fila y no el
 * resultado de un gesto de hace un segundo.
 *
 * Vive FUERA de React, igual que el estado del panel lateral, por dos motivos: cualquiera puede
 * avisar sin que haya que bajarle una funcion por diez niveles de propiedades, y la caducidad se
 * puede probar con un reloj falso en vez de mirando la pantalla.
 */

export type ClaseDeMensaje = 'exito' | 'fallo';

export interface Emergente {
  id: string;
  texto: string;
  clase: ClaseDeMensaje;
}

/** Cuanto se queda en pantalla. Bastante para leer dos lineas, poco para no estorbar. */
export const MS_EN_PANTALLA = 6000;

interface Dependencias {
  /** Inyectables para poder probar la caducidad sin esperar seis segundos. */
  programar?: (fn: () => void, ms: number) => unknown;
  cancelar?: (id: unknown) => void;
  ahora?: () => number;
}

let cola: Emergente[] = [];
let oyentes: (() => void)[] = [];
let secuencia = 0;

/*
 * El temporizador de cada mensaje, para poder cancelarlo si alguien lo descarta antes.
 *
 * Sin cancelarlo, descartar a mano y que luego venza el temporizador borraria un mensaje POSTERIOR
 * que hubiera ocupado su sitio: el que se va no es el que se creia.
 */
const relojes = new Map<string, unknown>();

let deps: Required<Dependencias> = {
  programar: (fn, ms) => setTimeout(fn, ms),
  cancelar: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  ahora: () => Date.now(),
};

/** Solo para las pruebas: reloj y temporizadores falsos. */
export function emergentesCon(nuevas: Dependencias): void {
  deps = { ...deps, ...nuevas };
}

const avisarOyentes = () => {
  for (const oyente of [...oyentes]) oyente();
};

export const emergentesRead = (): Emergente[] => cola;

export function emergentesSubscribe(oyente: () => void): () => void {
  oyentes = [...oyentes, oyente];
  return () => {
    oyentes = oyentes.filter((o) => o !== oyente);
  };
}

/** Pone un mensaje y devuelve su identificador, por si quien lo puso quiere quitarlo antes. */
export function emergente(texto: string, clase: ClaseDeMensaje = 'exito'): string {
  const id = `e-${++secuencia}-${deps.ahora()}`;
  cola = [...cola, { id, texto, clase }];
  relojes.set(id, deps.programar(() => descartarEmergente(id), MS_EN_PANTALLA));
  avisarOyentes();
  return id;
}

export function descartarEmergente(id: string): void {
  const reloj = relojes.get(id);
  if (reloj !== undefined) {
    deps.cancelar(reloj);
    relojes.delete(id);
  }
  const quedan = cola.filter((m) => m.id !== id);
  // Sin esta guarda, descartar dos veces el mismo mensaje avisaria a los oyentes de un cambio que
  // no hubo, y cada aviso es un render de la aplicacion entera.
  if (quedan.length === cola.length) return;
  cola = quedan;
  avisarOyentes();
}

/** Solo para las pruebas: deja la cola como al principio. */
export function emergentesLimpiar(): void {
  for (const reloj of relojes.values()) deps.cancelar(reloj);
  relojes.clear();
  cola = [];
  avisarOyentes();
}

/** En el servidor no hay cola: el primer pintado no lleva mensajes de nadie. */
const enElServidor = (): Emergente[] => VACIA;
const VACIA: Emergente[] = [];

export function useEmergentes(): Emergente[] {
  return useSyncExternalStore(emergentesSubscribe, emergentesRead, enElServidor);
}
