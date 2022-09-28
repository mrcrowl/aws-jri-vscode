//@ts-check
import nodeExternals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';

const isProduction = process.env.NODE_ENV === 'production';

/**@type {import('rollup').RollupOptions}*/
const config = {
  input: './src/main.ts', // the entry point of this main
  output: {
    file: 'dist/main.js',
    format: 'cjs', // 'esm' is still experimental, but you just need to change this and tsconfig to export esmodules
    sourcemap: !isProduction, // don't generate sourcemaps in production builds
  },
  external: ['vscode'],

  plugins: [
    nodeExternals(),
    esbuild({
      sourcemap: false, // Use rollup sourcemap
      minify: process.env.NODE_ENV === 'production',
      target: 'ES2020',
    }),
  ], // rollup doesn't transpile typescript by default, we need to use this plugin
};

export default config;
