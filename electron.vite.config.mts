import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { type PluginOption } from "vite";
import viteXmluiPlugin from "xmlui/vite-xmlui-plugin";
import { buildWasm } from "./build/wasm/build-wasm.mjs";

const xmluiPlugin = viteXmluiPlugin() as unknown as PluginOption;
const mainPublicSourceDir = resolve(import.meta.dirname, "src/public");
const mainPublicOutputDir = resolve(import.meta.dirname, "out/public");
const wasmSourceDirs = [
  resolve(import.meta.dirname, "src/wasm"),
  resolve(import.meta.dirname, "src/emu")
];
const wasmSourcePattern = /\.(c|h)$/i;

function copyMainPublicResourcesPlugin(): PluginOption {
  return {
    name: "copy-main-public-resources",
    apply: "build",
    closeBundle() {
      rmSync(mainPublicOutputDir, { recursive: true, force: true });
      if (existsSync(mainPublicSourceDir)) {
        cpSync(mainPublicSourceDir, mainPublicOutputDir, { recursive: true });
      }
    }
  };
}

function watchWasmResourcesPlugin(): PluginOption {
  let buildPromise: Promise<void> | undefined;
  let pending = false;
  let timer: NodeJS.Timeout | undefined;

  const runBuild = async (reason: string, reload?: () => void) => {
    if (buildPromise) {
      pending = true;
      return;
    }

    console.log(`[wasm] ${reason}`);
    buildPromise = buildWasm({ silent: true })
      .then(() => {
        reload?.();
      })
      .finally(() => {
        buildPromise = undefined;
        if (pending) {
          pending = false;
          void runBuild("Rebuilding queued Wasm changes", reload);
        }
      });

    await buildPromise;
  };

  const queueBuild = (reason: string, reload?: () => void) => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      void runBuild(reason, reload);
    }, 50);
  };

  return {
    name: "watch-wasm-resources",
    apply: "serve",
    async configureServer(server) {
      server.watcher.add(wasmSourceDirs);
      await runBuild("Building Wasm resources");

      server.watcher.on("all", (_event, filePath) => {
        if (
          !wasmSourceDirs.some((sourceDir) => filePath.startsWith(sourceDir)) ||
          !wasmSourcePattern.test(filePath)
        ) {
          return;
        }

        queueBuild("Rebuilding Wasm resources", () => {
          server.ws.send({ type: "full-reload" });
        });
      });
    }
  };
}

export default {
  main: {
    plugins: [copyMainPublicResourcesPlugin()],
    build: {
      lib: {
        entry: resolve(import.meta.dirname, "src/main/main.ts"),
        formats: ["cjs"]
      }
    }
  },
  preload: {
    build: {
      lib: {
        entry: resolve(import.meta.dirname, "src/preload/preload.ts"),
        formats: ["cjs"]
      }
    }
  },
  renderer: {
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern"
        },
        sass: {
          api: "modern"
        }
      }
    },
    publicDir: resolve(import.meta.dirname, "public"),
    plugins: [watchWasmResourcesPlugin(), xmluiPlugin]
  }
};
