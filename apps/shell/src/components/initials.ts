/**
 * Las iniciales del avatar de una persona.
 *
 * Vive en su propio modulo, sin `'use client'`, y no es una separacion por gusto: estaba dentro de
 * `AccountMenu`, que SI es de cliente, y la vista incrustada —que se dibuja en el servidor— la
 * necesita para pintar el mismo chip. Llamar a una funcion de un modulo de cliente desde el
 * servidor no es que funcione peor: React lo rechaza y tumba la pagina entera.
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
