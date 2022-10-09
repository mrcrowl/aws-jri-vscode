//@ts-check
import jsonPlugin from '@rollup/plugin-json';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import nodeExternals from 'rollup-plugin-node-externals';

const isProduction = process.env.NODE_ENV === 'production';

/**@type {import('rollup').RollupOptions}*/
const config = {
  input: './src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'cjs', // 'esm' is still experimental, but you just need to change this and tsconfig to export esmodules
    sourcemap: !isProduction,
  },
  external: ['vscode'],

  plugins: [
    esbuild({
      sourceMap: true,
      minify: process.env.NODE_ENV === 'production',
      target: 'ES2022',
    }),
    ...(isProduction ? [nodeResolve(), jsonPlugin()] : [nodeExternals({})]),
  ],
};

export default config;
