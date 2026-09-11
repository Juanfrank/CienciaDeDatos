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
};

export default nextConfig;
