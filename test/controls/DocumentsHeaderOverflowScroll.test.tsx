import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Regression coverage for the "Scroll tabs left/right" overflow controls in `DocumentsHeader`,
 * and for the active tab being forcibly kept in view.
 *
 * Two bugs compounded here, both stemming from `scheduleEnsureTabVisible` (and the effects that
 * depend on it) re-running far more often than intended:
 *
 * 1. `scheduleEnsureTabVisible` used to be created from two inline arrow functions passed straight
 *    into `useTabVisibility` on every render. `useTabVisibility` feeds its `ensureTabVisible`
 *    parameter into a `useCallback([ensureTabVisible])`, so a fresh arrow each render gave the
 *    `schedule` function it returned a fresh identity every render too - and that function was
 *    itself a dependency of the effect that re-scrolls to keep the active tab visible. Fixed by
 *    memoizing both callbacks passed into `useTabVisibility`.
 *
 * 2. Independently, `useTabVisibility`'s `ResizeObserver`-setup effect had no dependency array, so
 *    it tore the observer down and rebuilt it - a new `ResizeObserver` instance, fresh `observe()`
 *    calls - on every render regardless of (1). A `ResizeObserver` delivers an initial entry for
 *    every newly observed target, even when nothing has actually resized, so that rebuild alone
 *    re-fired `schedule()` (and so `ensureTabVisible()`) on every render, in a real browser. jsdom
 *    has no `ResizeObserver`, so this half is invisible unless the test supplies its own stub.
 *
 * Both add up to the same user-visible symptom on a strip too narrow to show the active tab at
 * every scroll position: any re-render - not just an actual resize - snaps the active tab straight
 * back into view, so a manual scroll (via the chevrons, or by dragging) never sticks.
 */
afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

// jsdom does not run layout, so offsetLeft/offsetWidth are always 0. Stub them at the prototype
// level, driven by data attributes set per element - a standard jsdom trick for geometry-dependent
// components.
Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
  configurable: true,
  get() {
    return Number(this.getAttribute("data-left") ?? 0);
  }
});
Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    return Number(this.getAttribute("data-width") ?? 0);
  }
});

function createDocument(fullPath: string, name: string) {
  return {
    id: fullPath,
    name,
    path: fullPath,
    node: { fullPath, projectPath: fullPath, name },
    editVersionCount: 0,
    savedVersionCount: 0
  } as any;
}

/** Mocks shared by every test here: a store good enough for `DocumentsHeader` to mount, plus a
 * trivial `Icon` stand-in so the (real) `SmallIconButton` chevrons don't need theme context. */
function mockSharedDependencies() {
  const store = {
    dispatch: vi.fn(),
    getState: vi.fn(() => ({
      project: { folderPath: "/project", buildRoots: [], workspaceLoaded: true },
      emulatorState: { isProjectDebugging: false },
      ideView: { editorVersion: 1 }
    }))
  };

  vi.doMock("@renderer/core/RendererProvider", () => ({
    useDispatch: () => vi.fn(),
    useRendererContext: () => ({ store }),
    useSelector: (selector: (state: unknown) => unknown) => selector(store.getState())
  }));
  vi.doMock("@renderer/core/MainApi", () => ({
    useMainApi: () => ({ saveProject: vi.fn(() => Promise.resolve()) })
  }));
  vi.doMock("@appIde/services/AppServicesProvider", () => ({
    useAppServices: () => ({
      projectService: { projectClosed: { on: vi.fn(), off: vi.fn() } },
      outputPaneService: { getOutputPaneBuffer: vi.fn() },
      ideCommandsService: { executeCommand: vi.fn() }
    })
  }));
  vi.doMock("@renderer/appIde/project/project-node", () => ({
    getFileTypeEntry: () => undefined
  }));
  vi.doMock("@renderer/controls/Icon", () => ({
    Icon: ({ iconName }: { iconName: string }) => <span data-testid={`icon-${iconName}`} />
  }));
  vi.doMock("@controls/TabButton", () => ({
    TabButton: () => null,
    TabButtonSeparator: () => null,
    TabButtonSpace: () => null
  }));

  return { store };
}

describe("DocumentsHeader — overflow scroll controls", () => {
  it("keeps a manual scroll in place instead of snapping back to the active tab", async () => {
    // 8 tabs, 150px each, laid out left to right from 0 - wider than the 300px strip below, so
    // the header overflows and the scroll chevrons appear. The active tab (index 0) is fully
    // visible at scrollLeft 0, but not once the user scrolls right past it - exactly the case
    // `ensureTabVisible` used to "correct" on every re-render.
    const TAB_WIDTH = 150;
    const documents = Array.from({ length: 8 }, (_, i) =>
      createDocument(`/project/src/f${i}.asm`, `f${i}.asm`)
    );

    const documentHubService = {
      closeAllExplorerDocuments: vi.fn(),
      getActiveDocumentIndex: vi.fn(() => 0),
      getDocumentViewState: vi.fn(() => ({})),
      getOpenDocuments: vi.fn(() => documents),
      getOpenProjectFileDocument: vi.fn(() => Promise.resolve(undefined)),
      moveDocument: vi.fn(),
      setActiveDocument: vi.fn(() => Promise.resolve()),
      setDocumentViewState: vi.fn(),
      setPermanent: vi.fn()
    };

    mockSharedDependencies();
    vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
      useDocumentHubService: () => documentHubService,
      useDocumentHubServiceVersion: () => 1
    }));

    // A ScrollViewer stand-in whose `apiLoaded` fires exactly once, from an effect on mount -
    // matching the real ScrollViewer, which publishes its api from a `useEffect`, not from the
    // render body. `onScrolled` is invoked asynchronously after each programmatic scroll, mirroring
    // the native "scroll" event the real component reacts to.
    let scrollLeft = 0;
    const CLIENT_WIDTH = 300; // Narrower than the 1200px of tab content, but wider than one tab.
    const scrollToHorizontalSpy = vi.fn();
    const onScrolledRef = { current: undefined as ((pos: number) => void) | undefined };

    vi.doMock("@renderer/controls/ScrollViewer", () => ({
      default: ({
        apiLoaded,
        onScrolled,
        children
      }: {
        apiLoaded?: (api: unknown) => void;
        onScrolled?: (pos: number) => void;
        children?: ReactNode;
      }) => {
        onScrolledRef.current = onScrolled;
        const loaded = useRef(false);
        useEffect(() => {
          if (loaded.current) return;
          loaded.current = true;
          apiLoaded?.({
            getScrollLeft: () => scrollLeft,
            getClientWidth: () => CLIENT_WIDTH,
            scrollToHorizontal: (pos: number) => {
              scrollLeft = Math.max(
                0,
                Math.min(pos, TAB_WIDTH * documents.length - CLIENT_WIDTH)
              );
              scrollToHorizontalSpy(pos);
              queueMicrotask(() => onScrolledRef.current?.(0));
            }
          });
        }, []);
        return <div>{children}</div>;
      }
    }));

    vi.doMock("@renderer/features/documents/DocumentTab", () => ({
      CloseMode: { All: 0, Others: 1, This: 2 },
      DocumentTab: ({
        name,
        tabDisplayed
      }: {
        name: string;
        tabDisplayed?: (el: HTMLDivElement) => void;
      }) => {
        const idx = documents.findIndex((d) => d.name === name);
        return (
          <div
            data-testid={`tab-${name}`}
            data-left={idx * TAB_WIDTH}
            data-width={TAB_WIDTH}
            ref={(el) => {
              if (el) tabDisplayed?.(el as HTMLDivElement);
            }}
          >
            {name}
          </div>
        );
      }
    }));

    const { DocumentsHeader } = await import("@renderer/features/documents/DocumentsHeader");
    render(<DocumentsHeader />);

    // Flush the rAF-scheduled measureOverflow/ensureTabVisible that settle after mount (each of
    // the 8 tabs registering reschedules the same frame, so give it a few ticks).
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((r) => requestAnimationFrame(r));
      });
    }

    const rightBtn = screen.getByRole("button", { name: "Scroll tabs right" });
    expect(rightBtn).not.toBeDisabled();

    fireEvent.click(rightBtn);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    // The click must actually move the strip and stay there - not get silently reverted by a
    // stray `ensureTabVisible()` re-run once the active tab (now off-screen) triggers it again.
    expect(scrollLeft).toBeGreaterThan(0);
    expect(scrollToHorizontalSpy).toHaveBeenCalledTimes(1);

    const leftBtn = screen.getByRole("button", { name: "Scroll tabs left" });
    expect(leftBtn).not.toBeDisabled();

    const before = scrollLeft;
    fireEvent.click(leftBtn);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(scrollLeft).toBeLessThan(before);
  });

  it("builds its ResizeObserver once, observes every tab plus the strip, and does not rebuild it on unrelated re-renders", async () => {
    /*
     * jsdom has no ResizeObserver, so the previous test cannot see this half of the bug: even
     * after `scheduleEnsureTabVisible` was made stable, `useTabVisibility`'s ResizeObserver-setup
     * effect had no dependency array, so it tore the observer down and rebuilt it - new
     * `ResizeObserver` instance, fresh `observe()` calls - on every render regardless. A
     * `ResizeObserver` delivers an initial entry for every newly observed target, even when
     * nothing actually resized, so that rebuild alone re-fired `schedule()` (and so
     * `ensureTabVisible()`) on every unrelated re-render, in a real browser. On a strip too narrow
     * to show the active tab at every scroll position, that meant the active tab could never be
     * scrolled out of view: any re-render, not just an actual resize, snapped it straight back.
     *
     * This test supplies its own ResizeObserver stub to make that constructor/observe traffic
     * visible, and asserts it happens exactly once across several re-renders - proving the
     * observer is now long-lived rather than rebuilt, and that the tabs which report themselves
     * before the observer exists (a child's layout effect runs before this hook's own effect, on
     * the very first commit) still end up observed.
     */
    const constructed: Array<() => void> = [];
    const observeSpy = vi.fn();
    const disconnectSpy = vi.fn();
    class FakeResizeObserver {
      constructor(callback: () => void) {
        constructed.push(callback);
      }
      observe(target: Element) {
        observeSpy(target);
      }
      unobserve() {}
      disconnect() {
        disconnectSpy();
      }
    }
    const previousResizeObserver = (globalThis as any).ResizeObserver;
    (globalThis as any).ResizeObserver = FakeResizeObserver;

    try {
      const documents = [
        createDocument("/project/src/a.asm", "a.asm"),
        createDocument("/project/src/b.asm", "b.asm")
      ];
      const documentHubService = {
        closeAllExplorerDocuments: vi.fn(),
        getActiveDocumentIndex: vi.fn(() => 0),
        getDocumentViewState: vi.fn(() => ({})),
        getOpenDocuments: vi.fn(() => documents),
        getOpenProjectFileDocument: vi.fn(() => Promise.resolve(undefined)),
        moveDocument: vi.fn(),
        setActiveDocument: vi.fn(() => Promise.resolve()),
        setDocumentViewState: vi.fn(),
        setPermanent: vi.fn()
      };

      mockSharedDependencies();
      vi.doMock("@renderer/appIde/services/DocumentServiceProvider", () => ({
        useDocumentHubService: () => documentHubService,
        useDocumentHubServiceVersion: () => 1
      }));
      vi.doMock("@renderer/controls/ScrollViewer", () => ({
        default: ({
          apiLoaded,
          children
        }: {
          apiLoaded?: (api: unknown) => void;
          children?: ReactNode;
        }) => {
          const loaded = useRef(false);
          useEffect(() => {
            if (loaded.current) return;
            loaded.current = true;
            apiLoaded?.({
              getScrollLeft: () => 0,
              getClientWidth: () => 300,
              scrollToHorizontal: () => {}
            });
          }, []);
          return <div>{children}</div>;
        }
      }));
      vi.doMock("@renderer/features/documents/DocumentTab", () => ({
        CloseMode: { All: 0, Others: 1, This: 2 },
        DocumentTab: ({
          name,
          tabDisplayed
        }: {
          name: string;
          tabDisplayed?: (el: HTMLDivElement) => void;
        }) => (
          <div
            data-testid={`tab-${name}`}
            ref={(el) => {
              if (el) tabDisplayed?.(el as HTMLDivElement);
            }}
          >
            {name}
          </div>
        )
      }));

      const { DocumentsHeader } = await import("@renderer/features/documents/DocumentsHeader");
      const { rerender } = render(<DocumentsHeader />);

      await act(async () => {
        await new Promise((r) => requestAnimationFrame(r));
      });

      expect(constructed).toHaveLength(1);
      // Both tabs plus the strip itself - including the tabs that registered before the observer
      // existed, via the pending-elements queue.
      expect(observeSpy).toHaveBeenCalledTimes(3);

      // Re-render several times with no actual change - the pressure that used to rebuild the
      // observer (and so re-fire `ensureTabVisible`) on every commit.
      for (let i = 0; i < 5; i++) {
        rerender(<DocumentsHeader />);
        await act(async () => {
          await new Promise((r) => requestAnimationFrame(r));
        });
      }

      expect(constructed).toHaveLength(1);
      expect(disconnectSpy).not.toHaveBeenCalled();
      expect(observeSpy).toHaveBeenCalledTimes(3);
    } finally {
      (globalThis as any).ResizeObserver = previousResizeObserver;
    }
  });
});
