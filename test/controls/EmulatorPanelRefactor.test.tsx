import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MutableRefObject } from "react";
import { MachineControllerState } from "@abstractions/MachineControllerState";

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("useMachineController", () => {
  it("keeps controller event subscriptions stable while calling the latest callbacks", async () => {
    let initializeMachine: () => void;
    const controller = createController();
    const machineService = {
      getMachineController: vi.fn(() => controller),
      newMachineTypeInitialized: vi.fn((handler: () => void) => {
        initializeMachine = handler;
        return vi.fn();
      })
    };
    const outputPane = {};
    const outputPaneService = {
      getOutputPaneBuffer: vi.fn(() => outputPane)
    };

    vi.doMock("@appIde/services/AppServicesProvider", () => ({
      useAppServices: () => ({ machineService, outputPaneService })
    }));

    const { useMachineController } = await import("@renderer/core/useMachineController");
    const controllerChanged = vi.fn();
    const firstStateChanged = vi.fn();
    const secondStateChanged = vi.fn();
    const firstFrameCompleted = vi.fn();
    const secondFrameCompleted = vi.fn();

    const { rerender } = renderHook(
      ({ frameCompleted, stateChanged }) =>
        useMachineController(controllerChanged, stateChanged, frameCompleted),
      {
        initialProps: {
          frameCompleted: firstFrameCompleted,
          stateChanged: firstStateChanged
        }
      }
    );

    await act(async () => {
      initializeMachine();
    });

    expect(controller.stateChanged.on).toHaveBeenCalledTimes(1);
    expect(controller.frameCompleted.on).toHaveBeenCalledTimes(1);
    expect(controller.output).toBe(outputPane);

    rerender({
      frameCompleted: secondFrameCompleted,
      stateChanged: secondStateChanged
    });

    const stateHandler = controller.stateChanged.on.mock.calls[0][0];
    const frameHandler = controller.frameCompleted.on.mock.calls[0][0];
    stateHandler({
      oldState: MachineControllerState.Stopped,
      newState: MachineControllerState.Running
    });
    frameHandler({ fullFrame: true });

    expect(firstStateChanged).not.toHaveBeenCalled();
    expect(secondStateChanged).toHaveBeenCalledTimes(1);
    expect(firstFrameCompleted).not.toHaveBeenCalled();
    expect(secondFrameCompleted).toHaveBeenCalledTimes(1);
  });
});

describe("useEmulatorKeyboard", () => {
  it("uses the latest key mapping and unregisters window listeners", async () => {
    const state = {
      dimMenu: false,
      keyMappings: undefined as any
    };
    vi.doMock("@renderer/core/RendererProvider", () => ({
      useSelector: (selector: (state: unknown) => unknown) => selector(state)
    }));

    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const setKeyStatus = vi.fn();
    const keyStatusSet = vi.fn();
    const controllerRef = {
      current: {
        machine: { setKeyStatus },
        state: MachineControllerState.Running
      }
    };

    const { useEmulatorKeyboard } = await import(
      "@renderer/features/emulator/useEmulatorKeyboard"
    );
    const { result, rerender, unmount } = renderHook(() =>
      useEmulatorKeyboard(controllerRef as any, keyStatusSet)
    );

    act(() => {
      result.current.setKeyData({ A: 10, B: 20 } as any, { KeyA: "A" } as any);
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyA" }));
    expect(setKeyStatus).toHaveBeenCalledWith(10, true);
    expect(keyStatusSet).toHaveBeenCalledWith(10, true);

    state.keyMappings = {
      mapping: { KeyB: "B" },
      merge: false
    };
    rerender();
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB" }));

    expect(setKeyStatus).toHaveBeenCalledWith(20, true);

    unmount();
    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(addEventListener).toHaveBeenCalledWith("keyup", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("keyup", expect.any(Function));
  });
});

describe("EmulatorPanel", () => {
  it("routes running and paused machine states through latest audio, recording, and screen hooks", async () => {
    const controller = createController();
    controller.isDebugging = true;
    controller.machine = {
      baseClockFrequency: 3_500_000,
      frameTactMultiplier: 1,
      frames: 1,
      getAspectRatio: vi.fn(() => [2, 1]),
      getDefaultKeyMapping: vi.fn(() => ({ KeyA: "A" })),
      getKeyCodeSet: vi.fn(() => ({ A: 10 })),
      getPixelBuffer: vi.fn(() => new Uint32Array(4)),
      machineId: "test-machine",
      pc: 0x1234,
      renderInstantScreen: vi.fn(() => new Uint32Array([1, 2, 3, 4])),
      screenHeightInPixels: 192,
      screenWidthInPixels: 256,
      setMachineProperty: vi.fn(),
      tactsInFrame: 70_000,
      uiFrameFrequency: 2
    };

    const captured = {
      controllerChanged: undefined as (controller: unknown) => Promise<void>,
      stateChanged: undefined as (state: unknown) => Promise<void>
    };
    const displayScreenData = vi.fn();
    const updateScreenDimensions = vi.fn();
    const initAudio = vi.fn(() => Promise.resolve());
    const setKeyData = vi.fn();
    const beeperRenderer = {
      current: {
        play: vi.fn(() => Promise.resolve()),
        suspend: vi.fn(() => Promise.resolve())
      }
    };
    const recordingManager = {
      current: {
        onMachinePaused: vi.fn(),
        onMachineRunning: vi.fn(() => Promise.resolve())
      }
    };
    const store = {
      dispatch: vi.fn(),
      getState: vi.fn(() => ({
        emulatorState: {
          audioSampleRate: 44_100,
          emuViewVersion: 1,
          machineState: MachineControllerState.Paused,
          soundLevel: 0.25
        },
        globalSettings: {
          showInstantScreen: true
        }
      }))
    };

    vi.doMock("@renderer/core/useMachineController", () => ({
      useMachineController: (
        controllerChanged: typeof captured.controllerChanged,
        stateChanged: typeof captured.stateChanged
      ) => {
        captured.controllerChanged = controllerChanged;
        captured.stateChanged = stateChanged;
        return controller;
      }
    }));
    vi.doMock("@renderer/core/RendererProvider", () => ({
      getGlobalSetting: () => true,
      useGlobalSetting: () => true,
      useSelector: (selector: (state: unknown) => unknown) => selector(store.getState()),
      useStore: () => store
    }));
    vi.doMock("@renderer/core/MainApi", () => ({
      useMainApi: () => ({ saveBinaryFile: vi.fn(), saveDiskChanges: vi.fn() })
    }));
    vi.doMock("@renderer/appEmu/recording/RecordingContext", () => ({
      useRecordingManager: () => recordingManager
    }));
    vi.doMock("@renderer/features/emulator/useEmulatorScreen", () => ({
      useEmulatorScreen: () => ({
        canvasHeight: 192,
        canvasWidth: 256,
        displayScreenData,
        imageBuffer8: { current: new Uint8Array([1]) },
        screenElement: { current: null } as MutableRefObject<HTMLCanvasElement>,
        updateScreenDimensions,
        xRatio: { current: 2 },
        yRatio: { current: 3 }
      })
    }));
    vi.doMock("@renderer/features/emulator/useEmulatorAudio", () => ({
      useEmulatorAudio: () => ({ beeperRenderer, initAudio })
    }));
    vi.doMock("@renderer/features/emulator/useEmulatorKeyboard", () => ({
      useEmulatorKeyboard: () => ({ setKeyData })
    }));
    vi.doMock("@renderer/features/emulator/EmulatorOverlay", () => ({
      EmulatorOverlay: ({ overlay, showOverlay }: { overlay?: string; showOverlay: boolean }) =>
        showOverlay ? <div>{overlay}</div> : null
    }));
    vi.doMock("@renderer/appEmu/tool-registry", () => ({
      machineEmuToolRegistry: []
    }));

    const { EmulatorPanel } = await import("@renderer/features/emulator/EmulatorPanel");

    render(<EmulatorPanel />);

    await act(async () => {
      await captured.controllerChanged(controller);
    });

    expect(initAudio).toHaveBeenCalledWith(70_000, 3_500_000, 44_100);
    expect(updateScreenDimensions).toHaveBeenCalled();
    expect(setKeyData).toHaveBeenCalledWith({ A: 10 }, { KeyA: "A" });

    await act(async () => {
      await captured.stateChanged({
        oldState: MachineControllerState.Stopped,
        newState: MachineControllerState.Running
      });
    });

    expect(beeperRenderer.current.play).toHaveBeenCalled();
    expect(recordingManager.current.onMachineRunning).toHaveBeenCalledWith(
      256,
      192,
      25,
      2,
      3,
      44_100
    );
    expect(screen.getByText("Debug mode")).toBeInTheDocument();

    await act(async () => {
      await captured.stateChanged({
        oldState: MachineControllerState.Running,
        newState: MachineControllerState.Paused
      });
    });

    expect(beeperRenderer.current.suspend).toHaveBeenCalled();
    expect(recordingManager.current.onMachinePaused).toHaveBeenCalled();
    expect(controller.machine.renderInstantScreen).toHaveBeenCalled();
    expect(displayScreenData).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("Paused (PC: $1234) - Instant screen")).toBeInTheDocument()
    );
  });
});

function createController() {
  return {
    dispose: vi.fn(),
    frameCompleted: {
      off: vi.fn(),
      on: vi.fn()
    },
    isDebugging: false,
    machine: {},
    output: undefined,
    state: MachineControllerState.Stopped,
    stateChanged: {
      off: vi.fn(),
      on: vi.fn()
    }
  };
}
