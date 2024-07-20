import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

import react from "@vitejs/plugin-react";

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
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    build: {
      rollupOptions: {
        input: resolve("src/renderer/index.html")
      }
    },
    resolve: { alias },
    plugins: [react()]
  }
});
