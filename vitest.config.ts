import { defineConfig } from 'vitest/config';
// import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  root: 'src',
  // plugins: [tsconfigPaths()],
  test: {
    // setupFiles: ['./sls/test/testUtils/setup-test-environment.ts'],
  },
});
