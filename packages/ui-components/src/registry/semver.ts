/** Versionado semantico del repositorio de objetos — seccion 4.5. */

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export type VersionBump = 'mayor' | 'menor' | 'parche' | 'ninguno' | 'invalido';

const PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(version: string): Semver | null {
  const m = PATTERN.exec(version.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function isValidVersion(version: string): boolean {
  return parseVersion(version) !== null;
}

export function formatVersion(v: Semver): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** Negativo si a < b, cero si iguales, positivo si a > b. */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) throw new Error(`Version no valida al comparar: '${a}' vs '${b}'.`);
  return va.major - vb.major || va.minor - vb.minor || va.patch - vb.patch;
}

/** Clasifica el salto entre dos versiones. */
export function classifyBump(from: string, to: string): VersionBump {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (!a || !b) return 'invalido';
  if (b.major > a.major) return 'mayor';
  if (b.major < a.major) return 'invalido';
  if (b.minor > a.minor) return 'menor';
  if (b.minor < a.minor) return 'invalido';
  if (b.patch > a.patch) return 'parche';
  return 'ninguno';
}

export function maxVersion(versions: string[]): string | null {
  const validas = versions.filter(isValidVersion);
  if (validas.length === 0) return null;
  return validas.reduce((mayor, v) => (compareVersions(v, mayor) > 0 ? v : mayor));
}
