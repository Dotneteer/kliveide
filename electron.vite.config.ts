import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
// @ts-ignore - xmlui plugin may not have TypeScript definitions
import viteXmluiModule from "xmlui/vite-xmlui-plugin";
const viteXmlUiPlugin = viteXmluiModule?.default;

const alias = {
  "@styles": resolve("src/renderer/assets/styles"),
  "@common": resolve("src/common"),
  "@abstractions": resolve("src/common/abstractions"),
  "@messaging": resolve("src/common/messaging"),
  "@state": resolve("src/common/state"),
  "@utils": resolve("src/common/utils"),
  "@renderer": resolve("src/renderer"),
  "@emu": resolve("src/emu"),
  "@appIde": resolve("src/renderer/appIde"),
  "@main": resolve("src/main"),
  "@controls": resolve("src/renderer/controls")
};

export default defineConfig({
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: 'esbuild',
      sourcemap: false,
      reportCompressedSize: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
          compilerWorker: resolve(__dirname, "src/main/compiler-integration/compilerWorker.ts") // Updated to match actual filename
        },
        // Created separate entry-specific externals
        external: (id, parentId) => {
          // Only externalize execa for the compiler worker
          if (id === 'execa') {
            return parentId ? parentId.includes('compilerWorker') : false;
          }
          
          // Default electron-vite externalization behavior
          const electron = ['electron', 'electron/main', 'electron/common', 'electron/renderer'];
          if (electron.includes(id)) return true;
          
          // Add any other default externals here
          const patterns = [
            /^node:.*/,  // Node.js built-ins
          ];
          return patterns.some(pattern => pattern.test(id));
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      minify: 'esbuild',
      sourcemap: false,
      reportCompressedSize: false
    }
  },
  renderer: {
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        input: resolve("src/renderer/index.html")
      }
    },
    resolve: { alias },
    //assetsInclude: ["**/*.xmlui"],
    plugins: [react(), viteXmlUiPlugin()]
  }
});
