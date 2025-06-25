import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.js'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    target: 'node14',
    platform: 'node',
});
