import { rmSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

rmSync(path.join(__dirname, "dist-electron"), { recursive: true, force: true });

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync("dist-electron", { recursive: true, force: true });

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    build: {
      target: "esnext"
    },
    resolve: {
      alias: {
        "@styles": path.join(__dirname, "src/renderer/assets/styles"),
        "@common": path.join(__dirname, "src/common"),
        "@abstractions": path.join(__dirname, "src/common/abstractions"),
        "@messaging": path.join(__dirname, "src/common/messaging"),
        "@state": path.join(__dirname, "src/common/state"),
        "@utils": path.join(__dirname, "src/common/utils"),
        "@renderer": path.join(__dirname, "src/renderer"),
        "@emu": path.join(__dirname, "src/emu"),
        "@appIde": path.join(__dirname, "src/renderer/appIde"),
        "@main": path.join(__dirname, "src/main"),
        "@controls": path.join(__dirname, "src/renderer/controls"),
      }
    },
    plugins: [
      react(),
      monacoEditorPlugin({}),
      electron([
        {
          // Main-Process entry file of the Electron App.
          entry: 'src/main/index.ts',
          onstart(options) {
            if (process.env.VSCODE_DEBUG) {
              console.log(/* For `.vscode/.debug.script.mjs` */'[startup] Electron App')
            } else {
              options.startup()
            }
          },
          vite: {
            build: {
              
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
            publicDir: "src/public"
          },
        },
        {
          entry: 'src/preload/index.ts',
          onstart(options) {
            // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete, 
            // instead of restarting the entire Electron App.
            options.reload()
          },
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
          },
        }
      ]),
      renderer()
    ],
    server: process.env.VSCODE_DEBUG
      ? (() => {
          const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
          return {
            host: url.hostname,
            port: +url.port
          };
        })()
      : undefined,
    clearScreen: false
  };
});
