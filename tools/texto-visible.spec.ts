import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error -- herramienta en JavaScript, sin tipos.
import { segmentarJsx } from './rename/segmentos.mjs';

/**
 * La aplicacion habla espanol. Ninguna palabra inglesa se cuela en lo que se lee en pantalla.
 *
 * El renombrado al ingles toca identificadores, y el texto de un JSX no lo es: para el escaner,
 * `<h1>Editor de modulos</h1>` esta en zona de codigo, asi que `modulos` paso a `modules` y la
 * cabecera del editor quedo escrita medio en ingles. No rompe la compilacion ni ninguna otra
 * prueba —la aplicacion funciona igual—, y por eso llego a cincuenta y cuatro sitios antes de
 * que alguien lo viera.
 *
 * Se compara contra el glosario: si una palabra del texto visible es la TRADUCCION de una palabra
 * espanola, y no es a la vez espanola ni un prestamo que el producto ya usa, es que el renombrado
 * llego donde no debia.
 */

const raiz = execSync('git rev-parse --show-toplevel').toString().trim();
const GLOSARIO = JSON.parse(readFileSync(`${raiz}/tools/rename/glosario.json`, 'utf8'));

/** Palabras inglesas que el producto usa en espanol y no son un error. */
const PRESTAMOS = new Set([
  'total', 'color', 'panel', 'grid', 'slug', 'email', 'web', 'tooltip', 'online', 'chart', 'test',
  'general', 'normal', 'local', 'final', 'error', 'material', 'digital', 'regional', 'base',
  'area', 'banner', 'simple', 'plural', 'html', 'css', 'login', 'hover', 'scroll', 'drill',
]);

const espanolas = new Set(Object.keys(GLOSARIO).filter((k) => !k.startsWith('_')));
const traducciones = new Set(
  Object.entries(GLOSARIO)
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string')
    .map(([, v]) => (v as string).toLowerCase())
    .filter((v) => v.length >= 3 && !espanolas.has(v) && !PRESTAMOS.has(v)),
);

const tsx = execSync(`git -C ${raiz} ls-files '*.tsx'`).toString().trim().split('\n').filter(Boolean);

describe('texto visible', () => {
  it('hay archivos que revisar', () => {
    expect(tsx.length).toBeGreaterThan(20);
  });

  it('ninguna palabra del texto de un JSX es una traduccion del glosario', () => {
    const intrusas: string[] = [];
    for (const ruta of tsx) {
      const fuente = readFileSync(`${raiz}/${ruta}`, 'utf8');
      for (const s of segmentarJsx(fuente) as { tipo: string; texto: string }[]) {
        if (s.tipo !== 'prosa') continue;
        for (const palabra of s.texto.match(/[A-Za-zÀ-ÿ]{3,}/g) ?? []) {
          if (traducciones.has(palabra.toLowerCase())) intrusas.push(`${ruta}: ${palabra}`);
        }
      }
    }
    expect([...new Set(intrusas)].sort()).toEqual([]);
  });
});
