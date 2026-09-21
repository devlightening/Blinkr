const esbuild = require('esbuild');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');

/** Bundles scripts/ui-preview.tsx for the browser (react-native-web) into `out/app.js`. */
async function buildPreview(out) {
  await fs.mkdir(out, { recursive: true });
  await esbuild.build({ entryPoints: ['scripts/ui-preview.tsx'], outfile: path.join(out, 'app.js'), bundle: true, jsx: 'automatic', resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'], define: { __DEV__: 'true', 'process.env.NODE_ENV': '"development"', global: 'globalThis' }, inject: [path.resolve('scripts/ui-process-shim.js')], alias: {
    'react-native': 'react-native-web',
    // expo SDK 57 nests expo-modules-core under expo/node_modules instead of
    // hoisting it; Metro resolves that fine, plain esbuild/Node resolution does not.
    'expo-modules-core': path.resolve('node_modules/expo/node_modules/expo-modules-core'),
  }, plugins: [{ name: 'native-test-ports', setup(build) {
    build.onResolve({ filter: /^\.\/.*\.js$/ }, async args => {
      const web = path.resolve(args.resolveDir, args.path.replace(/\.js$/, '.web.js'));
      try { await fs.access(web); return { path: web }; } catch { return undefined; }
    });
    build.onResolve({ filter: /^(expo-video|expo-haptics|expo-image-picker|expo-secure-store|expo-location)$/ }, () => ({ path: path.resolve('scripts/ui-native-stub.tsx') }));
    build.onResolve({ filter: /\/api$/ }, () => ({ path: path.resolve('scripts/ui-api-stub.ts') }));
  } }] });
}

/** Serves the bundle on a random local port. Returns the server; read `.address().port`. */
async function servePreview(out) {
  const server = http.createServer(async (req, res) => {
    if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(await fs.readFile(path.join(out, 'app.js'))); }
    else { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}*{box-sizing:border-box}</style><div id="root"></div><script src="/app.js"></script></html>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}

module.exports = { buildPreview, servePreview };
