import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@app/data-contracts-server': r('./packages/data-contracts/server/src/index.ts'),
      '@app/data-contracts': r('./packages/data-contracts/types/src/index.ts'),
      '@app/access-control': r('./packages/access-control/src/index.ts'),
      '@app/identity-db': r('./packages/identity-db/src/index.ts'),
      '@app/observability': r('./packages/observability/src/index.ts'),
      '@app/ui-components': r('./packages/ui-components/src/index.ts'),
      '@app/auth': r('./packages/auth/src/index.ts'),
      '@app/caching': r('./packages/caching/src/index.ts'),
      '@app/design-tokens': r('./packages/design-tokens/src/index.ts'),
      '@app/testing-utils': r('./packages/testing-utils/src/index.ts'),
    },
  },
  test: {
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__boundary-fixture__/**'],
  },
});
