import { beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import fs from "fs";
import os from "os";
import path from "path";

const testHomeRoot = process.env.KLIVE_TEST_HOME ?? path.join(os.tmpdir(), "kliveide-vitest-home");
const testRunId = `pid-${process.pid}`;
const testWorkerId = `worker-${process.env.VITEST_WORKER_ID ?? process.env.VITEST_POOL_ID ?? "0"}`;

setTestHome("setup");

beforeEach((context) => {
  const testFile = context.task.file.filepath ?? context.task.file.name ?? "unknown";
  setTestHome(sanitizePathSegment(testFile));
});

function setTestHome(scope: string): void {
  const testHome = path.join(testHomeRoot, testRunId, testWorkerId, scope);
  fs.mkdirSync(testHome, { recursive: true });
  process.env.HOME = testHome;
  process.env.USERPROFILE = testHome;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-160);
}

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
    getElementsByTagName: vi.fn(() => []),
    queryCommandSupported: vi.fn(() => false),
    queryCommandEnabled: vi.fn(() => false)
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

  // Mock Event classes for Monaco editor
  if (typeof (global as any).UIEvent === "undefined") {
    (global as any).UIEvent = class UIEvent extends (global as any).Event {
      constructor(type: string) {
        super(type);
      }
    };
  }

  if (typeof (global as any).KeyboardEvent === "undefined") {
    (global as any).KeyboardEvent = class KeyboardEvent extends (global as any).Event {
      constructor(type: string) {
        super(type);
      }
    };
  }

  if (typeof (global as any).MouseEvent === "undefined") {
    (global as any).MouseEvent = class MouseEvent extends (global as any).Event {
      constructor(type: string) {
        super(type);
      }
    };
  }

  // Mock self for Monaco editor workers
  if (typeof (global as any).self === "undefined") {
    (global as any).self = global;
  }
}
