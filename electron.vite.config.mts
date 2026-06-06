import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { type PluginOption } from "vite";
import viteXmluiPlugin from "xmlui/vite-xmlui-plugin";

const xmluiPlugin = viteXmluiPlugin() as unknown as PluginOption;
const mainPublicSourceDir = resolve(import.meta.dirname, "src/public");
const mainPublicOutputDir = resolve(import.meta.dirname, "out/public");

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
    plugins: [xmluiPlugin]
  }
};
