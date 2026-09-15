/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Los paquetes del monorepo se publican como TypeScript de origen (main apunta a src/index.ts),
  // asi que Next los compila en vez de esperar JavaScript ya construido. Es lo que permite que
  // `nx affected` y el typecheck vean un solo grafo, sin un paso de build intermedio por paquete.
  transpilePackages: [
    '@app/access-control',
    '@app/alerts',
    '@app/auth',
    '@app/caching',
    '@app/config',
    '@app/data-contracts',
    '@app/design-tokens',
    '@app/export',
    '@app/identity-db',
    '@app/module-model',
    '@app/nl-query',
    '@app/observability',
    '@app/ui-components',
  ],
  typescript: { ignoreBuildErrors: true },
  /*
   * `next dev` NO escribe en `apps/shell/AGENTS.md`.
   *
   * Next 16 le anade por su cuenta un bloque de instrucciones para agentes cada vez que arranca
   * en desarrollo. Ese archivo es la especificacion local de esta carpeta, esta versionado, y lo
   * escribe quien trabaja aqui: una herramienta que lo reescribe al arrancar mete en el
   * repositorio un texto que nadie reviso y rompe la comprobacion que exige que toda ruta citada
   * en un `.md` exista, porque las suyas apuntan a `node_modules`.
   */
  agentRules: false,
};

export default nextConfig;
