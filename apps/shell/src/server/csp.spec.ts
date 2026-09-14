import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, nuevoNonce } from './csp';
import { WITHOUT_FRAMED } from './embedding';

/** La politica de contenido — principio 1 y seccion 4.9. */

const politica = (path: string, origenes: string[] = [], desarrollo = false) =>
  contentSecurityPolicy(path, origenes, 'NONCE', desarrollo);

const directiva = (csp: string, nombre: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${nombre} `) || d === nombre);

describe('politica de contenido', () => {
  it('es UNA sola cabecera con el enmarcado dentro', () => {
    // Dos cabeceras `Content-Security-Policy` no se suman: cada una se aplica por separado y la
    // pagina queda gobernada por la interseccion, que nadie escribio ni revisa.
    const csp = politica('/m/casos-pendientes');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(WITHOUT_FRAMED);
  });

  it('una ruta incrustable conserva SU politica de enmarcado', () => {
    const csp = politica('/embed/m/casos-pendientes', ['https://portal.gob.do']);
    expect(directiva(csp, 'frame-ancestors')).toBe('frame-ancestors https://portal.gob.do');
    expect(csp).toContain("default-src 'self'");
  });

  it('el navegador solo habla con esta aplicacion', () => {
    const csp = politica('/');
    expect(directiva(csp, 'connect-src')).toBe("connect-src 'self'");
    expect(directiva(csp, 'font-src')).toBe("font-src 'self'");
    expect(directiva(csp, 'default-src')).toBe("default-src 'self'");
  });

  it('los scripts van firmados, nunca con comodin', () => {
    const csp = politica('/');
    expect(directiva(csp, 'script-src')).toBe("script-src 'self' 'nonce-NONCE'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  it('`unsafe-eval` SOLO en desarrollo, que es donde Next compila en el navegador', () => {
    expect(politica('/', [], true)).toContain("'unsafe-eval'");
    expect(politica('/', [], false)).not.toContain("'unsafe-eval'");
  });

  it('lo que no puede sacar datos del origen se permite; lo que si, no', () => {
    const csp = politica('/');
    // Un estilo en linea pinta; no habla con nadie. React escribe uno por cada objeto que
    // dimensiona, asi que prohibirlo seria romper el lienzo para no ganar nada.
    expect(directiva(csp, 'style-src')).toBe("style-src 'self' 'unsafe-inline'");
    expect(directiva(csp, 'object-src')).toBe("object-src 'none'");
    expect(directiva(csp, 'base-uri')).toBe("base-uri 'self'");
    expect(directiva(csp, 'form-action')).toBe("form-action 'self'");
  });

  it('cada peticion lleva un nonce distinto', () => {
    // Reutilizarlo lo vuelve adivinable: quien inyecte un script copiaria el de la pagina
    // anterior y la firma dejaria de significar nada.
    const nonces = new Set(Array.from({ length: 50 }, () => nuevoNonce()));
    expect(nonces.size).toBe(50);
    expect([...nonces][0]).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
