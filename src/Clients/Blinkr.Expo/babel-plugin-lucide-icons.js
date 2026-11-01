/**
 * Bundle size (V2 PERFORMANCE.md "JS paket < 6 MB"): Metro does not tree-shake, so `import { Heart } from
 * 'lucide-react-native'` pulled all ~1,700 icons (1.4 MB of source) into the app. This rewrites each named icon import
 * to its own module, `lucide-react-native/icons/heart`, so only the icons we use are bundled.
 *
 * Safe by construction: a name is rewritten only when the package index maps it to an icon file (old aliases such as
 * AlertTriangle included); anything else (type imports,
 * helpers, a name with no file) stays on the package entry untouched.
 */
const fs = require('fs');
const path = require('path');

// The package does not export ./package.json: step up from its main file (dist/cjs/lucide-react-native.js).
const pkgDir = path.resolve(path.dirname(require.resolve('lucide-react-native')), '..', '..');
// Every export name (icons and their old aliases, e.g. AlertTriangle -> triangle-alert) from the package's own index.
const known = new Map();
const index = fs.readFileSync(path.join(pkgDir, 'dist', 'esm', 'lucide-react-native.mjs'), 'utf8');
for (const match of index.matchAll(/export \{([^}]*)\} from '\.\/icons\/([a-z0-9-]+)\.mjs';/g)) {
  for (const part of match[1].split(',')) {
    const alias = /default as (\w+)/.exec(part.trim());
    if (alias) known.set(alias[1], match[2]);
  }
}
const fileFor = (name) => known.get(name) ?? null;

module.exports = function lucideIcons({ types: t }) {
  return {
    name: 'lucide-icons',
    visitor: {
      ImportDeclaration(p) {
        if (p.node.source.value !== 'lucide-react-native' || p.node.importKind === 'type') return;
        const keep = [];
        const direct = [];
        for (const spec of p.node.specifiers) {
          const file = t.isImportSpecifier(spec) && spec.importKind !== 'type' && t.isIdentifier(spec.imported) ? fileFor(spec.imported.name) : null;
          if (file) direct.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(spec.local.name))], t.stringLiteral(`lucide-react-native/icons/${file}`)));
          else keep.push(spec);
        }
        if (direct.length === 0) return;
        if (keep.length > 0) direct.push(t.importDeclaration(keep, t.stringLiteral('lucide-react-native')));
        p.replaceWithMultiple(direct);
      },
    },
  };
};
