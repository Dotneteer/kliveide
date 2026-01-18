import { vi } from "vitest";

// Mock window object for browser-specific code that runs in Node.js environment
if (typeof window === "undefined") {
  const mockElement = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    append: vi.fn(),
    remove: vi.fn(),
    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    style: {},
    className: "",
    innerHTML: "",
    textContent: "",
    id: "",
    offsetWidth: 0,
    offsetHeight: 0
  };

  const mockDocument = {
    body: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      appendChild: vi.fn(),
      removeChild: vi.fn(),
      append: vi.fn(),
      remove: vi.fn(),
      style: {},
      className: "",
      innerHTML: "",
      offsetWidth: 0,
      offsetHeight: 0
    },
    documentElement: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      style: {},
      className: "",
      offsetWidth: 0,
      offsetHeight: 0
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => ({ ...mockElement })),
    createTextNode: vi.fn(() => ({})),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    getElementById: vi.fn(() => null),
    getElementsByClassName: vi.fn(() => []),
    getElementsByTagName: vi.fn(() => [])
  };

  (global as any).window = {
    navigator: { userAgent: "" },
    document: mockDocument,
    location: { href: "" },
    matchMedia: () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn()
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: (callback: any) => callback(),
    cancelAnimationFrame: vi.fn(),
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout
  };

  (global as any).document = mockDocument;
}

