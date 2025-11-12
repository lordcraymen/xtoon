import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts'
  },
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: {
    entry: {
      index: 'src/index.ts'
    }
  },
  target: 'node18'
});
