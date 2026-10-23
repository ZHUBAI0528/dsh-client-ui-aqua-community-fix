import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    client: 'src/client/index.ts',
    invariant: 'src/invariant.ts',
  },
  format: 'esm',
  dts: true,
  platform: 'browser',
  deps: {
    neverBundle: [
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-store',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-theme',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-invariants',
      'react',
      'react-dom',
    ],
  },
  outDir: 'lib',
  clean: true,
  sourcemap: true,
  minify: false,
})
