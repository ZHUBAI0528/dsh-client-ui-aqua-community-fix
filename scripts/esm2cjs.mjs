/**
 * Convert the aqua client bundle from native ESM to the CJS factory format the
 * DSH client-module loader expects.
 *
 * The loader serves `exports["./client"]` verbatim — it never rewrites it. A
 * browser therefore executes the file as-is, and a native ESM `import` of a
 * bare specifier ("@deepseek-ai/dsh-client-ui-primitives") is unresolvable in
 * the browser: the import fails with "Failed to resolve module specifier".
 *
 * The deployment's own client packages emit the loader's factory form instead:
 *
 *   window.__ModuleLoader__.load({ id, factory: (require) => { ... } })
 *
 * The loader hands the factory a `require` that resolves bare specifiers
 * against the browser module table, so every bare import becomes a `require`
 * call inside the factory body.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PACKAGE_ID = '@deepseek-ai/dsh-client-ui-aqua';
const clientPath = resolve(process.cwd(), 'lib/client.js');

/** Collect the `name` part of `import { a, b as c } from "spec"`. */
function importedBindings(clause) {
  const names = [];
  for (const part of clause.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [local, imported] = trimmed.split(/\s+as\s+/).map((s) => s.trim());
    names.push({ local, imported: imported ?? local });
  }
  return names;
}

const source = readFileSync(clientPath, 'utf8');

// ESM import statements can span lines; normalize them into one marker line.
const normalized = source.replace(
  /^import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2;?$/gm,
  (full, clause, _q, spec) => {
    const bindings = [];
    const namespace = clause.match(/^\*\s+as\s+(\S+)$/);
    if (namespace) {
      bindings.push({ local: namespace[1], imported: '*' });
    } else {
      const braceMatch = clause.match(/\{([\s\S]*)\}/);
      if (braceMatch) bindings.push(...importedBindings(braceMatch[1]));
      const before = clause.split('{')[0].trim();
      if (before) bindings.push({ local: before, imported: 'default' });
    }
    const encoded = bindings.map((b) => `${b.imported}>${b.local}`).join(',');
    return `__DSH_IMPORT__:${spec}::${encoded}`;
  },
);

const requireBlocks = [];
const body = normalized.replace(/__DSH_IMPORT__:([^:]+)::([^\n]*)/g, (_full, spec, bindingList) => {
  const bindings = bindingList
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const [imported, local] = pair.split('>');
      return { imported, local };
    });
  const namespaceName = `__dsh_ns_${requireBlocks.length}`;
  const lines = [`\t\tconst ${namespaceName} = require(${JSON.stringify(spec)});`];
  for (const { imported, local } of bindings) {
    if (imported === '*') {
      lines.push(`\t\tconst ${local} = ${namespaceName};`);
    } else if (imported === 'default') {
      lines.push(`\t\tconst ${local} = ${namespaceName}.default !== undefined ? ${namespaceName}.default : ${namespaceName};`);
    } else {
      lines.push(`\t\tconst ${local} = ${namespaceName}[${JSON.stringify(imported)}];`);
    }
  }
  const block = lines.join('\n');
  requireBlocks.push(block);
  return block;
});

if (/^import\s/m.test(body)) {
  console.error('[esm2cjs] unresolved import statements remain');
  process.exit(1);
}

// The CSS banner must run inside the factory, after the loader has a DOM, and
// it must tag the style element with data-plugin so the loader can claim and
// later remove it. The previous build appended it as a bare top-level IIFE.
const cssMatch = body.match(/const __dshAquaCss = ("(?:[^"\\]|\\.)*");\n/);
let cssLiteral = null;
let code = body;
if (cssMatch) {
  cssLiteral = cssMatch[1];
  code = body.replace(cssMatch[0], '');
}

// Strip the trailing `export { ... }` statement; the factory assigns to
// `exports` instead.
const exportMatch = code.match(/^export\s*\{([^}]*)\};?\s*$/m);
const exportedNames = exportMatch
  ? exportMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];
code = code.replace(/^export\s*\{[^}]*\};?\s*$/m, '');

const exportAssignments = exportedNames
  .map((name) => `\t\texports.${name} = ${name};`)
  .join('\n');

const cssBlock = cssLiteral
  ? [
      '\t\tconst __dshAquaCss = ' + cssLiteral + ';',
      '\t\tif (typeof document !== "undefined") {',
      '\t\t\tconst tagId = ' + JSON.stringify(`${PACKAGE_ID}/aqua.css`) + ';',
      '\t\t\tif (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
      '\t\t\t\tconst tag = document.createElement("style");',
      '\t\t\t\ttag.dataset.plugin = ' + JSON.stringify(PACKAGE_ID) + ';',
      '\t\t\t\ttag.dataset.pluginCss = tagId;',
      '\t\t\t\ttag.textContent = __dshAquaCss;',
      '\t\t\t\tdocument.head.appendChild(tag);',
      '\t\t\t}',
      '\t\t}',
    ].join('\n')
  : '';

const wrapped = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(PACKAGE_ID)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${code.trim()}
${cssBlock}
${exportAssignments}
		return module.exports;
	}
});
`;

writeFileSync(clientPath, wrapped);
console.log(
  `[esm2cjs] wrote ${clientPath} (${wrapped.length} bytes, ${requireBlocks.length} requires, exports: ${exportedNames.join(', ')})`,
);
