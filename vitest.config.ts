import { resolve } from "path";
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const config = defineConfig({
  plugins: [react()],
  test: {
    /**
     * By default, vitest search test files in all packages.
     * For e2e tests have sense search only is project root tests folder
     */
    include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],

    /**
     * A default timeout of 5000ms is sometimes not enough for playwright.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
    typecheck: {
      enabled: true
    },
    
    // Setup environment for React component tests
    environmentMatchGlobs: [
      ['**/test/components/**/*.test.tsx', 'jsdom'],
      ['**/*.test.ts', 'node']
    ],
    
    // Use environment detection based on file extensions
    fileParallelism: false,
    sequence: {
      hooks: "list",
      setupFiles: "list"
    },
    setupFiles: ["./test/setup.ts"],
    alias: {
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
    }
  }
});

export default config;
