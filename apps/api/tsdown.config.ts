import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    sentry: 'src/infrastructure/observability/sentry.ts',
    server: 'src/server.ts',
    worker: 'src/worker.ts',
  },
  platform: 'node',
  format: 'esm',
  sourcemap: true,
  dts: false,
  clean: true,
  deps: {
    alwaysBundle: ['@resonate/contracts'],
  },
});
