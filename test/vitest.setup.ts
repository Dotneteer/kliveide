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

/**
 * `ResizeObserver` is a browser API jsdom does not implement.
 *
 * Any component that measures itself - `useResizeObserver`'s callers: the sprite editor's
 * pane-fitted canvas, `SplitPanel`, `AttachedShadow`, the keyboard and memory panels - throws on
 * mount without it. The stub observes nothing and fires nothing, which is the right default: a test
 * that needs a size change should drive it explicitly rather than inherit one from a layout jsdom
 * is not performing anyway.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

/**
 * jsdom has no 2D/WebGL canvas without the native `canvas` package, and says so on stderr
 * every time a component asks for a context. Returning `null` is what that call returns
 * anyway - and what a browser returns for an unsupported context - so components already
 * handle it; this stub only drops the "Not implemented" line. A test that needs a context
 * still installs its own with `vi.spyOn(HTMLCanvasElement.prototype, "getContext")`.
 */
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"];
}


/*
 * The unit tier must not run a WASM machine core.
 *
 * Tests that do are the end-to-end tiers (`build/e2e-tests.ts`), which `npm test` runs only when
 * their inputs changed. A core test left in the unit tier would slow every run down and, worse,
 * escape that bookkeeping - so it fails here, naming the fix. A core is recognised by its exports
 * (`sp48*`, `sp128*`, `spp3e*`, `timex*`, `zxnext*`, `z88*`, `zx8081*`, `z80*`, and `cond*` for the condition evaluator
 * built alone); other WebAssembly (Node's own HTTP parser, for one) is left alone.
 */
if (process.env.KLIVE_TEST_TIER === "unit") {
  // --- `cond*`: the breakpoint condition evaluator's test build, which runs the cores' C code
  const CORE_EXPORT = /^(sp48|sp128|spp3e|timex|zxnext|z88|zx8081|z80|cond)[A-Z]/;
  const refuseCore = (instance: WebAssembly.Instance | undefined): void => {
    const core = Object.keys(instance?.exports ?? {}).find((name) => CORE_EXPORT.test(name));
    if (core) {
      throw new Error(
        `This test runs a WASM machine core (it instantiated a module exporting '${core}'). ` +
          "Add it to an end-to-end tier in build/e2e-tests.ts; the unit tier runs without the cores."
      );
    }
  };
  const wasm = WebAssembly as unknown as {
    instantiate: (...args: unknown[]) => Promise<unknown>;
    Instance: unknown;
  };
  const instantiate = wasm.instantiate.bind(WebAssembly);
  wasm.instantiate = async (...args: unknown[]) => {
    const result = (await instantiate(...args)) as
      | WebAssembly.Instance
      | WebAssembly.WebAssemblyInstantiatedSource;
    refuseCore("instance" in result ? result.instance : result);
    return result;
  };
  const Instance = WebAssembly.Instance;
  const GuardedInstance = function (module: WebAssembly.Module, imports?: WebAssembly.Imports) {
    const instance = new Instance(module, imports);
    refuseCore(instance);
    return instance;
  } as unknown as typeof WebAssembly.Instance;
  GuardedInstance.prototype = Instance.prototype;
  wasm.Instance = GuardedInstance;
}
