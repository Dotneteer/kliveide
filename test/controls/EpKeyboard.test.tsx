/**
 * The Enterprise 64/128 virtual keyboard (`.plans/ENTERPRISE_PLAN.md` §9.1), drawn from a photo of an
 * Enterprise 128: every matrix key is on it once, each cap prints what the photographed (German-layout)
 * machine prints there, every key but ENTER is one unit high, and each zone sends its matrix key - the face holds the key (SHIFT too on the right button), the printed
 * shifted legend holds SHIFT with it, the joystick's directions are the cursor keys and its knob SPACE.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { EpKeyboard, EP_KEYS, EP_JOYSTICK, EP_STRIP_LABELS } from "@renderer/appEmu/Keyboard/EpKeyboard";
import { EpKeyCode as K } from "@emu/machines/enterprise/EpKeyCode";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn()
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "Enterprise" }, model: undefined })
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
    result = renderWithProviders(<EpKeyboard width={1400} height={500} />);
  });
  return result!.container;
}

/** A key's zone; `index` picks the second of two groups with the same key (SPACE: the bar, then the knob) */
function zoneOf(container: HTMLElement, name: string, zone: "main" | "shift", index = 0): Element {
  const key = container.querySelectorAll(`[data-ep-key="${name}"]`)[index];
  const pick = key?.matches(`[data-zone="${zone}"]`) ? key : key?.querySelector(`[data-zone="${zone}"]`);
  if (!pick) throw new Error(`key ${name} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
});

describe("Enterprise virtual keyboard", () => {
  it("draws every key of the matrix once, and the joystick", async () => {
    const container = await render();
    const names = [...container.querySelectorAll("[data-ep-key]")].map((g) => g.getAttribute("data-ep-key")!);
    // --- 72 keys on the keyboard (the cursor keys are only on the joystick), 4 directions, and the knob (SPACE again)
    expect(new Set(names)).toEqual(new Set(Object.keys(K)));
    expect(EP_KEYS).toHaveLength(Object.keys(K).length - 4);
    expect(names.filter((n) => n === "Space")).toHaveLength(2);
    expect(EP_JOYSTICK.map((j) => j.name)).toEqual(["Up", "Right", "Down", "Left"]);
  });

  it("puts no two keys on top of each other", () => {
    const boxes = EP_KEYS.map((k) => ({ name: k.name, x0: k.x, y0: k.y, x1: k.x + (k.w ?? 1), y1: k.y + (k.h ?? 1) }));
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b) continue;
        const overlap = a.x0 < b.x1 - 0.01 && b.x0 < a.x1 - 0.01 && a.y0 < b.y1 - 0.01 && b.y0 < a.y1 - 0.01;
        // --- ENTER's box covers the notch the key after ] sits in
        if (overlap && !(a.name === "Enter" && b.name === "RBracket") && !(b.name === "Enter" && a.name === "RBracket")) {
          throw new Error(`${a.name} overlaps ${b.name}`);
        }
      }
    }
  });

  it("prints the photo's legends on each key", async () => {
    const text = (await render()).textContent ?? "";
    for (const legend of ["ESC", "TAB", "CTRL", "LOCK", "SHIFT", "ERASE", "ENTER", "ALT", "DEL", "INS", "STOP", "PAUSE", "F1", "F8"]) {
      expect(text, legend).toContain(legend);
    }
    // --- The caps are the photo's, at the matrix key that sits there
    const printed = Object.fromEntries(EP_KEYS.map((k) => [k.name, [k.main, k.shifted ?? ""].join("|")]));
    expect(printed).toMatchObject({
      N3: "3|§",
      N7: "7|/",
      N0: "Ø|=",
      Minus: "ß|?",
      Caret: "´|`",
      Y: "Z|",
      Z: "Y|",
      At: "Ü|",
      LBracket: "+|*",
      Semicolon: "Ö|",
      Colon: "Ä|",
      RBracket: "#|^",
      Backslash: ">|<",
      Comma: ",|;",
      Period: ".|:",
      Slash: "-|_"
    });
    expect(EP_STRIP_LABELS[0]).toEqual(["REFORM", "JUSTIFY"]);
  });

  it("makes every key one unit high but ENTER, and puts PAUSE and STOP on the function row, DEL and INS after ERASE", () => {
    for (const k of EP_KEYS) expect(k.h ?? 1, k.name).toBe(k.name === "Enter" ? 2 : 1);
    const at = (name: string) => EP_KEYS.find((k) => k.name === name)!;
    expect([at("Hold").y, at("Stop").y]).toEqual([at("F1").y, at("F1").y]);
    expect(at("Hold").x).toBeGreaterThan(at("F8").x + at("F8").w!);
    expect(at("Del").x).toBeCloseTo(at("Erase").x + at("Erase").w!);
    expect(at("Ins").x).toBeCloseTo(at("Del").x + at("Del").w!);
    expect([at("Erase").y, at("Del").y, at("Ins").y]).toEqual([at("Esc").y, at("Esc").y, at("Esc").y]);
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
      [K.LShift, true]
    ]);
  });

  it("the printed shifted legend holds SHIFT with the key", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "N2", "shift"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.N2, true],
      [K.LShift, true]
    ]);
  });

  it("a SHIFT key on the right button presses only itself", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "RShift", "main"), { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.RShift, true]]);
  });

  it("the joystick's directions are the cursor keys and its knob is SPACE", async () => {
    const container = await render();
    for (const [name, index] of [["Up", 0], ["Right", 0], ["Down", 0], ["Left", 0], ["Space", 1]] as const) {
      machine.setKeyStatus.mockClear();
      fireEvent.mouseDown(zoneOf(container, name, "main", index), { button: 0 });
      expect(machine.setKeyStatus.mock.calls, name).toEqual([[K[name], true]]);
    }
  });

  it("ignores clicks while the typer is typing", async () => {
    const container = await render();
    machine.getKeyQueueLength.mockReturnValue(3);
    fireEvent.mouseDown(zoneOf(container, "A", "main"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });
});
