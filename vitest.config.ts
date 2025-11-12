import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 10000,
    include: [
      'tests/**/*.test.{ts,js}',
      'tests/**/*.spec.{ts,js}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        'dist/**',
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.test.{ts,js}',
        '**/*.spec.{ts,js}'
      ]
    },
    // Use forks instead of threads to support process.chdir
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  esbuild: {
    target: 'node18'
  }
});