import { resolve } from "node:path";
import { defineConfig } from "electron-vite";
import { type PluginOption } from "vite";
import viteXmluiPlugin from "xmlui/vite-xmlui-plugin";

const xmluiPlugin = viteXmluiPlugin() as unknown as PluginOption;

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(import.meta.dirname, "src/electron/main.ts")
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(import.meta.dirname, "src/electron/preload.ts")
      }
    }
  },
  renderer: {
    root: import.meta.dirname,
    base: "./",
    plugins: [xmluiPlugin],
    build: {
      rollupOptions: {
        input: {
          emulator: resolve(import.meta.dirname, "emulator.html"),
          ide: resolve(import.meta.dirname, "ide.html")
        }
      }
    }
  }
});
