import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    // Test files location
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // Environment for Node.js testing
    environment: 'node',
    
    // Global test APIs
    globals: true,
    
    // Watch mode for Test Explorer
    watch: false,
    
    // Reporter configuration for Test Explorer compatibility
    reporters: ['verbose', 'json'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        'out/',
        '**/*.d.ts',
        'electron.vite.config.ts',
        'vitest.config.ts'
      ]
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Pool options for better Test Explorer integration
    pool: 'threads'
  },
  
  // Path aliases to match your project structure
  resolve: {
    alias: {
      '@state': path.resolve(__dirname, 'src/common/state'),
      '@common': path.resolve(__dirname, 'src/common'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@emu': path.resolve(__dirname, 'src/emu'),
      '@renderer': path.resolve(__dirname, 'src/renderer')
    }
  }
})