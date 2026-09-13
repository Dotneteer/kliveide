import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MC_Z88_INTRAM, MC_Z88_SLOT0 } from "@common/machines/constants";
import { CardIds } from "@emu/machines/z88/memory/CardIds";
import { Z88ChangeRamDialog } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamDialog";
import { Z88InsertCardDialog } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardDialog";
import { Z88RemoveCardDialog } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardDialog";
import { setMachineConfigAction, setMachineStateAction } from "@common/state/actions";

import {
  createMockStore,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor
} from "../../react-test-utils";

/**
 * Container-level tests for the three Z88 card dialogs.
 *
 * They assert wiring only — that the renderer services reach the ports, that
 * the Redux slice reaches the model, and that the modal frame is what the old
 * components put on screen. Every rule about what these dialogs *decide* is
 * covered headlessly in the model, view-model and controller suites.
 */

const machineMock = vi.hoisted(() => ({
  setMachineType: vi.fn(),
  signalFlapClosed: vi.fn(),
  configure: vi.fn(),
  getMachineController: vi.fn()
}));

const mainApiMock = vi.hoisted(() => ({
  showOpenFileDialog: vi.fn(),
  checkZ88Card: vi.fn(),
  displayMessageBox: vi.fn()
}));

const ideApiMock = vi.hoisted(() => ({
  displayOutput: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      setMachineType: machineMock.setMachineType,
      getMachineController: machineMock.getMachineController
    }
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

vi.mock("@renderer/core/IdeApi", () => ({
  useIdeApi: () => ideApiMock
}));

beforeEach(() => {
  machineMock.setMachineType.mockResolvedValue(true);
  machineMock.configure.mockResolvedValue(undefined);
  machineMock.getMachineController.mockReturnValue({
    machine: {
      signalFlapClosed: machineMock.signalFlapClosed,
      configure: machineMock.configure,
      dynamicConfig: undefined
    }
  });
  mainApiMock.showOpenFileDialog.mockResolvedValue("");
  mainApiMock.checkZ88Card.mockResolvedValue({ content: new Uint8Array(128 * 1024) });
  mainApiMock.displayMessageBox.mockResolvedValue(undefined);
  ideApiMock.displayOutput.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- The dialogs read the emulator slice, so a test that cares about the
// --- machine has to put it in the store the provider tree hands them.
function storeWith(config: Record<string, unknown>, running = false) {
  const store = createMockStore();
  store.dispatch(setMachineConfigAction(config as never), "emu");
  if (running) {
    store.dispatch(setMachineStateAction(MachineControllerState.Running), "emu");
  }
  return store;
}

const okButton = () => screen.getByRole("button", { name: "Ok" });

describe("Z88ChangeRamDialog — wiring", () => {
  it("opens showing the size the store says the machine is fitted with", () => {
    renderWithProviders(<Z88ChangeRamDialog onClose={vi.fn()} />, {
      store: storeWith({ [MC_Z88_INTRAM]: 0x01 })
    });

    expect(screen.getByText("32K")).toBeInTheDocument();
  });

  it("opens quiet on a running machine, because nothing has changed yet", () => {
    // --- The dialog opens on the size the machine already has, so there is
    // --- nothing to warn about until the user picks a different one. When the
    // --- warning *is* earned is a model rule, covered headlessly.
    renderWithProviders(<Z88ChangeRamDialog onClose={vi.fn()} />, {
      store: storeWith({ [MC_Z88_INTRAM]: 0x01 }, true)
    });

    expect(screen.queryByTestId("z88-ram-warning")).not.toBeInTheDocument();
  });

  it("settles a no-op selection without rebuilding the machine", async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<Z88ChangeRamDialog onChange={onChange} onClose={onClose} />, {
      store: storeWith({ [MC_Z88_INTRAM]: 0x07 })
    });

    fireEvent.click(okButton());

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    // --- 128K selected on a 128K machine is a no-op: no rebuild, but still an
    // --- answer for the caller.
    expect(onChange).toHaveBeenCalledWith({
      selectedSize: "128",
      ramMask: 0x07,
      changed: false
    });
    expect(machineMock.setMachineType).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels through the caller's onClose", async () => {
    const onClose = vi.fn();
    renderWithProviders(<Z88ChangeRamDialog onClose={onClose} />, {
      store: storeWith({})
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // --- The modal's cancel path awaits an optional hook before closing, so
    // --- the callback lands a microtask later than the click.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe("Z88RemoveCardDialog — wiring", () => {
  it("names the slot it was opened for", () => {
    renderWithProviders(<Z88RemoveCardDialog slot={2} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    expect(screen.getByTestId("z88-remove-card-question")).toHaveTextContent("Slot 2");
  });

  it("hot-unplugs a card slot and shuts the flap", async () => {
    const onRemove = vi.fn();
    renderWithProviders(<Z88RemoveCardDialog slot={2} onRemove={onRemove} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    fireEvent.click(okButton());

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith({ slot: 2 }));
    // --- A card slot is hot-pluggable, so the machine is reconfigured in place
    // --- rather than rebuilt.
    expect(machineMock.configure).toHaveBeenCalled();
    expect(machineMock.setMachineType).not.toHaveBeenCalled();
    expect(machineMock.signalFlapClosed).toHaveBeenCalled();
  });

  it("rebuilds the machine when the internal ROM socket is emptied", async () => {
    const onRemove = vi.fn();
    renderWithProviders(<Z88RemoveCardDialog slot={0} onRemove={onRemove} onClose={vi.fn()} />, {
      store: storeWith({ [MC_Z88_SLOT0]: { cardType: CardIds.EPROMUV128 } })
    });

    fireEvent.click(okButton());

    await waitFor(() => expect(machineMock.setMachineType).toHaveBeenCalled());
    expect(onRemove).toHaveBeenCalledWith({ slot: 0 });
  });

  it("shuts the flap when dismissed without removing anything", async () => {
    renderWithProviders(<Z88RemoveCardDialog slot={1} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(machineMock.signalFlapClosed).toHaveBeenCalledTimes(1));
    expect(machineMock.configure).not.toHaveBeenCalled();
  });
});

describe("Z88InsertCardDialog — wiring", () => {
  it("titles itself for the slot", () => {
    renderWithProviders(<Z88InsertCardDialog slot={0} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    expect(screen.getByText("Replace Z88 Card - Slot 0")).toBeInTheDocument();
  });

  it("refuses to insert until a card type is chosen", () => {
    renderWithProviders(<Z88InsertCardDialog slot={1} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    expect(okButton()).toBeDisabled();
  });

  it("shuts the flap when dismissed", async () => {
    renderWithProviders(<Z88InsertCardDialog slot={1} onClose={vi.fn()} />, {
      store: storeWith({})
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(machineMock.signalFlapClosed).toHaveBeenCalledTimes(1));
  });
});

describe("Z88 dialogs under StrictMode", () => {
  it("stay usable after the effect teardown/setup cycle", async () => {
    // --- StrictMode tears every effect down and re-runs it once. A controller
    // --- that could only be disposed would leave the dialog frozen here.
    const onRemove = vi.fn();
    renderWithProviders(
      <StrictMode>
        <Z88RemoveCardDialog slot={1} onRemove={onRemove} onClose={vi.fn()} />
      </StrictMode>,
      { store: storeWith({}) }
    );

    fireEvent.click(okButton());

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith({ slot: 1 }));
  });
});
