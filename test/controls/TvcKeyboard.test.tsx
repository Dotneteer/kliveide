/**
 * The Videoton TVC virtual keyboard (`.plans/VIDEOTON_TVC_PLAN.md` §8), drawn from a photo of a
 * TVC 64K: every matrix key is on it once (SHIFT twice), the legends are the machine's, and each
 * zone sends what it shows - the face holds the key (SHIFT too on the right button), the printed
 * shifted legend holds SHIFT with it, the joystick's directions and knob are the row-8 keys.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { TvcKeyboard, TVC_KEY_ROWS, TVC_JOYSTICK } from "@renderer/appEmu/Keyboard/TvcKeyboard";
import { TvcKeyCode as K } from "@emu/machines/tvc/TvcKeyCode";
import { tvcKeyMappings } from "@emu/machines/tvc/TvcKeyMappings";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn()
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "Videoton TVC" }, model: undefined })
    },
    uiService: { dragging: false },
    outputPaneService: { getBuffer: () => null }
  })
}));

(globalThis as any).ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

async function render() {
  let result: ReturnType<typeof renderWithProviders>;
  await act(async () => {
    result = renderWithProviders(<TvcKeyboard width={1400} height={400} />);
  });
  return result!.container;
}

/** A key's zone; `index` picks the second of the two SHIFT keys */
function zoneOf(container: HTMLElement, name: string, zone: "main" | "shift", index = 0): Element {
  const key = container.querySelectorAll(`[data-tvc-key="${name}"]`)[index];
  const pick = key?.matches(`[data-zone="${zone}"]`) ? key : key?.querySelector(`[data-zone="${zone}"]`);
  if (!pick) throw new Error(`key ${name} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("Videoton TVC virtual keyboard", () => {
  it("draws every key of the matrix once, both SHIFTs, and the joystick", async () => {
    const container = await render();
    const names = [...container.querySelectorAll("[data-tvc-key]")].map((g) => g.getAttribute("data-tvc-key")!);
    // --- 65 matrix keys on the keyboard (64 of rows 0-7, and INS), the second SHIFT, 4 directions and FIRE
    expect(names).toHaveLength(71);
    expect(names.filter((n) => n === "Shift")).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(Object.keys(K)));
    expect(TVC_KEY_ROWS.map((r) => r.keys.length)).toEqual([18, 17, 15, 13, 3]);
    expect(TVC_JOYSTICK.map((j) => j.name)).toEqual(["Up", "Right", "Down", "Left"]);
  });

  it("steps the rows to the right towards the back, as on the machine", () => {
    const ends = TVC_KEY_ROWS.map((r) => r.keys.reduce((x, key) => (key.x ?? x) + (key.w ?? 1), r.x));
    // --- ESC, DEL, RETURN, SHIFT and ALT each end further left than the row behind
    expect(ends).toEqual([18, 17.5, 16.5, 15.25, 14.25]);
  });

  it("prints the machine's legends", async () => {
    const text = (await render()).textContent ?? "";
    for (const legend of ["INS", "ESC", "DEL", "RETURN", "SHIFT", "LOCK", "CTRL", "ALT"]) {
      expect(text, legend).toContain(legend);
    }
    for (const c of "ÍÖÜÓŐÚÉÁŰQWERTZYX&'\"+!%/=()#~`$[]{}<>|\\?:_") expect(text, c).toContain(c);
  });

  it("the face holds the key; the right button adds SHIFT", async () => {
    const container = await render();
    const face = zoneOf(container, "Z", "main");
    fireEvent.mouseDown(face, { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Z, true]]);
    fireEvent.mouseUp(face, { button: 0 });
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(face, { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.Z, true],
      [K.Shift, true]
    ]);
  });

  it("the printed shifted legend holds SHIFT with the key", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "N0", "shift"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.N0, true],
      [K.Shift, true]
    ]);
  });

  it("both SHIFT keys press the one SHIFT contact, without a second one on the right button", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "Shift", "main", 1), { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Shift, true]]);
  });

  it("the joystick's directions are the cursor keys and its knob is FIRE (Tab)", async () => {
    const container = await render();
    for (const name of ["Up", "Right", "Down", "Left", "Tab"]) {
      machine.setKeyStatus.mockClear();
      fireEvent.mouseDown(zoneOf(container, name, "main"), { button: 0 });
      expect(machine.setKeyStatus.mock.calls, name).toEqual([[K[name], true]]);
    }
  });

  it("does nothing while the IDE is typing into the machine", async () => {
    machine.getKeyQueueLength.mockReturnValue(3);
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "A", "main"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });

  it("the host's Insert key is INS", () => {
    expect(tvcKeyMappings.Insert).toBe("Ins");
  });
});
