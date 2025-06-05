import '@testing-library/jest-dom'

// --- Mock ResizeObserver for SplitPanel component
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}))

// --- Mock Electron APIs for testing
Object.defineProperty(window, 'electron', {
  value: {
    ipcRenderer: {
      invoke: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    },
  },
  writable: true,
})

// --- Mock window.api for preload scripts
Object.defineProperty(window, 'api', {
  value: {
    // --- Add any API methods you expose from preload here
  },
  writable: true,
})
