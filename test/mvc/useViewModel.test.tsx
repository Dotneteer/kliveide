import { describe, expect, it, vi } from "vitest";
import { StrictMode, useEffect } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach } from "vitest";

import { useController } from "@mvc/react/useController";
import { useViewModel } from "@mvc/react/useViewModel";

import { deferred } from "./deferred";
import { TestController, type TestPorts } from "./testController";

afterEach(() => cleanup());

type ProbeProps = { controller: TestController };

// --- A stand-in for a real view: it reads the view model and nothing else.
const Probe = ({ controller }: ProbeProps) => {
  const vm = useViewModel(controller);
  return <span data-testid="label">{vm.label}</span>;
};

describe("useViewModel", () => {
  it("renders the current view model on the first paint", () => {
    const controller = new TestController({ load: async () => "x" });

    render(<Probe controller={controller} />);

    expect(screen.getByTestId("label")).toHaveTextContent("Idle");
  });

  it("re-renders when the controller changes state", async () => {
    const gate = deferred<string>();
    const controller = new TestController({ load: () => gate.promise });

    render(<Probe controller={controller} />);

    const running = act(async () => {
      void controller.dispatch({ type: "loadRequested", key: "a" });
    });
    await running;
    expect(screen.getByTestId("label")).toHaveTextContent("Loading...");

    await act(async () => {
      gate.resolve("loaded");
      await controller.settle();
    });
    expect(screen.getByTestId("label")).toHaveTextContent("loaded");
  });

  it("does not re-render when a dispatch leaves the state unchanged", async () => {
    const controller = new TestController({ load: async () => "x" });
    const renders = vi.fn();
    const CountingProbe = () => {
      renders();
      return <Probe controller={controller} />;
    };

    render(<CountingProbe />);
    const before = renders.mock.calls.length;

    await act(async () => {
      // --- The reducer returns the same state object for a redundant clear
      await controller.dispatch({ type: "cleared" });
    });

    expect(renders.mock.calls.length).toBe(before);
  });

  it("stops listening after unmount", async () => {
    const controller = new TestController({ load: async () => "x" });
    const renders = vi.fn();
    const CountingProbe = () => {
      renders();
      return <Probe controller={controller} />;
    };
    const { unmount } = render(<CountingProbe />);
    const before = renders.mock.calls.length;

    unmount();
    await act(async () => {
      await controller.dispatch({ type: "loadRequested", key: "a" });
    });

    // --- The controller is still alive and working; only the subscription is
    // --- gone, so an unmounted tree is never updated.
    expect(controller.state.value).toBe("x");
    expect(renders.mock.calls.length).toBe(before);
  });
});

describe("useController", () => {
  it("creates the controller once and keeps it across re-renders", () => {
    const factory = vi.fn(() => new TestController({ load: async () => "x" }));
    const Host = ({ tick }: { tick: number }) => {
      const controller = useController(factory);
      return (
        <span data-testid="host">
          {tick}:{controller.viewModel.label}
        </span>
      );
    };

    const { rerender } = render(<Host tick={1} />);
    rerender(<Host tick={2} />);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("host")).toHaveTextContent("2:Idle");
  });

  it("disposes the controller on unmount", () => {
    let created: TestController | undefined;
    const Host = () => {
      const controller = useController(() => {
        created = new TestController({ load: async () => "x" });
        return created;
      });
      return <span>{controller.viewModel.label}</span>;
    };

    const { unmount } = render(<Host />);
    expect(created?.isDisposed).toBe(false);

    unmount();
    // --- Disposal is what stops a late port result from touching a dead tree
    expect(created?.isDisposed).toBe(true);
  });

  it("has a view model to paint on the very first render", () => {
    const ports: TestPorts = { load: async () => "x" };
    const Host = () => {
      const controller = useController(() => new TestController(ports));
      // --- No "undefined until an effect runs" state to guard against
      return <span data-testid="first">{useViewModel(controller).label}</span>;
    };

    render(<Host />);
    expect(screen.getByTestId("first")).toHaveTextContent("Idle");
  });
});

describe("StrictMode", () => {
  it("survives the mount / unmount / remount cycle React runs in development", async () => {
    // --- React.StrictMode invokes every effect twice: setup, cleanup, setup.
    // --- A controller disposed by that cleanup must still be usable, or the
    // --- whole dialog is dead on arrival in a development build.
    let created: TestController | undefined;
    const Host = () => {
      const controller = useController(() => {
        created = new TestController({ load: async () => "loaded" });
        return created;
      });
      useEffect(() => {
        void controller.dispatch({ type: "loadRequested", key: "a" });
      }, [controller]);
      return <span data-testid="label">{useViewModel(controller).label}</span>;
    };

    render(
      <StrictMode>
        <Host />
      </StrictMode>
    );
    await act(async () => {
      await created!.settle();
    });

    expect(screen.getByTestId("label")).toHaveTextContent("loaded");
  });
});
