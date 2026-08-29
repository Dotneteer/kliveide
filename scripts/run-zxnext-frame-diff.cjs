(async () => {
  const { existsSync, readdirSync, statSync } = require("node:fs");
  const { resolve } = require("node:path");
  const {
    buildZxNextWasm,
    productionOutput,
    waitForZxNextWasmBuildLock
  } = require("./build-zxnext-wasm.cjs");
  const root = resolve(__dirname, "..");

  waitForZxNextWasmBuildLock();
  if (isZxNextWasmSourceNewerThanArtifact()) {
    buildZxNextWasm();
  }

  const { createServer } = await import("vite");
  const server = await createServer({
    configFile: false,
    root,
    logLevel: "silent",
    optimizeDeps: {
      entries: [],
      noDiscovery: true
    },
    resolve: {
      alias: {
        "@styles": resolve(root, "src/renderer/assets/styles"),
        "@common": resolve(root, "src/common"),
        "@abstractions": resolve(root, "src/common/abstractions"),
        "@messaging": resolve(root, "src/common/messaging"),
        "@state": resolve(root, "src/common/state"),
        "@utils": resolve(root, "src/common/utils"),
        "@renderer": resolve(root, "src/renderer"),
        "@emu": resolve(root, "src/emu"),
        "@appIde": resolve(root, "src/renderer/appIde"),
        "@main": resolve(root, "src/main"),
        "@controls": resolve(root, "src/renderer/controls")
      }
    },
    server: {
      hmr: false,
      middlewareMode: true
    },
    appType: "custom"
  });

  try {
    const runner = await server.ssrLoadModule("/scripts/run-zxnext-frame-diff.ts");
    await runner.runZxNextFrameDiffCli(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    await server.close();
  }

  function isZxNextWasmSourceNewerThanArtifact() {
    if (!existsSync(productionOutput)) return true;
    const artifactTime = statSync(productionOutput).mtimeMs;
    const sourceRoot = resolve(root, "src/emu/machines/zxNext/wasm/zxnext");
    return readdirSync(sourceRoot).some(entry => {
      if (!entry.endsWith(".c") && !entry.endsWith(".h")) return false;
      return statSync(resolve(sourceRoot, entry)).mtimeMs > artifactTime;
    });
  }
})();
