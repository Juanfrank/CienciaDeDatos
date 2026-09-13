import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cada carpeta con codigo declara sus reglas en un `AGENTS.md`.
 *
 * La convencion solo sirve si no se puede olvidar: un paquete nuevo sin especificacion deja a
 * quien llegue despues —persona o agente— adivinando que puede importar y que no.
 */

const raiz = process.cwd();

const CARPETAS = [
  '.',
  'apps',
  'apps/shell',
  'apps/shell/app',
  'apps/shell/e2e',
  'apps/shell/src/server',
  'apps/shell/src/components',
  'apps/shell/src/components/editor',
  'apps/cache-populator',
  'apps/modules',
  'packages',
  'packages/data-contracts',
  'tools',
  'infra',
];

describe('cada carpeta declara sus reglas', () => {
  for (const carpeta of CARPETAS) {
    it(`${carpeta}/AGENTS.md existe y dice que NO hacer`, () => {
      const path = join(raiz, carpeta, 'AGENTS.md');
      expect(existsSync(path), path).toBe(true);

      const texto = readFileSync(path, 'utf8');
      expect(texto.length, path).toBeGreaterThan(400);
      // La mitad util de una especificacion es la lista de lo prohibido: sin ella se lee como
      // una descripcion y no como un contrato.
      expect(texto, path).toMatch(/Que NO hacer/);
    });
  }

  it('todo paquete de `packages` tiene el suyo', () => {
    const paquetes = readdirSync(join(raiz, 'packages'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'data-contracts')
      .map((e) => e.name);

    const sinEspecificacion = paquetes.filter(
      (p) => !existsSync(join(raiz, 'packages', p, 'AGENTS.md')),
    );

    expect(sinEspecificacion).toEqual([]);
  });

  it('la especificacion general enumera los cuatro principios y como correr en local', () => {
    const general = readFileSync(join(raiz, 'AGENTS.md'), 'utf8');
    for (const clave of ['principio', 'npm run verify', 'npm run poblar', 'Limites de dependencia']) {
      expect(general.toLowerCase(), clave).toContain(clave.toLowerCase());
    }
  });
});
