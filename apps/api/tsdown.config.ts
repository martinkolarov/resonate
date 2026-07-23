import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
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
