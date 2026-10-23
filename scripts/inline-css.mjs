/**
 * Fold the extracted stylesheet into the client bundle as a module-level
 * constant. The constant is later placed inside the loader factory by
 * `esm2cjs.mjs`, which also emits the `<style>` element tagged with
 * `data-plugin` so the client-module loader can claim and remove it.
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const lib = resolve(process.cwd(), 'lib');
const cssPath = resolve(lib, 'style.css');
const clientPath = resolve(lib, 'client.js');

if (!existsSync(cssPath)) {
  console.log('[inline-css] lib/style.css not found, nothing to inline');
  process.exit(0);
}
if (!existsSync(clientPath)) {
  console.error('[inline-css] lib/client.js missing - aborting');
  process.exit(1);
}

const css = readFileSync(cssPath, 'utf8');
const client = readFileSync(clientPath, 'utf8');

const banner = `const __dshAquaCss = ${JSON.stringify(css)};\n`;

writeFileSync(clientPath, banner + client);
rmSync(cssPath);
console.log('[inline-css] inlined ' + css.length + ' bytes into lib/client.js');
