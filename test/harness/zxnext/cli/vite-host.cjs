/**
 * The one Vite instance the visual tests run on.
 *
 * - Node side: `ssrLoadModule` loads the harness TypeScript (and the emulator/assembler sources it
 *   imports) with the app's path aliases - Tier 1 and the browser-tier server both run this way.
 * - Browser side: its middlewares serve the test page (test/harness/zxnext/browser) as ES modules,
 *   compiling the same emulator sources for Chrome.
 */
const { resolve } = require("node:path");

const root = resolve(__dirname, "..", "..", "..", "..");
const alias = (p) => resolve(root, p);

async function createViteHost() {
  const { createServer } = await import("vite");
  return createServer({
    configFile: false,
    root,
    logLevel: "warn",
    optimizeDeps: { entries: ["test/harness/zxnext/browser/page.ts"] },
    resolve: {
      alias: [
        { find: /^lodash$/, replacement: resolve(__dirname, "lodash-shim.ts") },
        ...Object.entries({
        "@styles": alias("src/renderer/assets/styles"),
        "@common": alias("src/common"),
        "@abstractions": alias("src/common/abstractions"),
        "@messaging": alias("src/common/messaging"),
        "@state": alias("src/common/state"),
        "@utils": alias("src/common/utils"),
        "@renderer": alias("src/renderer"),
        "@emu": alias("src/emu"),
        "@appIde": alias("src/renderer/appIde"),
        "@main": alias("src/main"),
        "@controls": alias("src/renderer/controls"),
        "@mvc": alias("src/renderer/mvc")
        }).map(([find, replacement]) => ({ find, replacement }))
      ]
    },
    server: { hmr: false, ws: false, middlewareMode: true },
    appType: "custom"
  });
}

module.exports = { createViteHost, root };
