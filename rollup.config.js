//@ts-check
import nodeExternals from 'rollup-plugin-node-externals';
import esbuild from 'rollup-plugin-esbuild';

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
    nodeExternals(),
    esbuild({
      sourceMap: true,
      minify: process.env.NODE_ENV === 'production',
      target: 'ES2020',
    }),
  ],
};

export default config;
