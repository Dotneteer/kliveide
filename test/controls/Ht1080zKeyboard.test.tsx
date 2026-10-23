/**
 * The HT-1080Z virtual keyboard (`.plans/HT1080Z_PLAN.md` §7, the approved mockup
 * `.plans/ht1080z/ht1080z-keyboard-mockup.html`): every key of the drawing is rendered, and each zone
 * sends what the mockup says - the face holds the key (SHIFT too on the right button), the printed
 * shifted legend holds SHIFT with it, a Hungarian hint types its character through the machine's
 * typer, PAGE and F1 latch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, act } from "../react-test-utils";
import { Ht1080zKeyboard, HT1080Z_HINTS, HT1080Z_KEY_ROWS } from "@renderer/appEmu/Keyboard/Ht1080zKeyboard";
import { Ht1080zKeyCode as K } from "@emu/machines/ht1080z/Ht1080zKeyCode";
import { ht1080zStrokesForCharacter } from "@emu/machines/ht1080z/Ht1080zTyper";
import type { Ht1080zRomSetId } from "@emu/machines/ht1080z/Ht1080zRoms";

const machine = {
  getKeyQueueLength: vi.fn(() => 0),
  setKeyStatus: vi.fn(),
  typeText: vi.fn(),
  getMachineProperty: vi.fn(() => false)
};

vi.mock("@appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    machineService: {
      getMachineController: () => ({ machine }),
      getMachineInfo: () => ({ machine: { displayName: "HT-1080Z" }, model: undefined })
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

async function render(romSet: Ht1080zRomSetId = "s2") {
  let result: ReturnType<typeof renderWithProviders>;
  await act(async () => {
    result = renderWithProviders(<Ht1080zKeyboard width={1400} height={560} romSet={romSet} />);
  });
  return result!.container;
}

/** A key's zone; `index` picks the second of the two SHIFT keys */
function zoneOf(container: HTMLElement, name: string, zone: "main" | "shift" | "hint", index = 0): Element {
  const key = container.querySelectorAll(`[data-ht1080z-key="${name}"]`)[index];
  const pick = key?.querySelector(`[data-zone="${zone}"]`);
  if (!pick) throw new Error(`key ${name} has no ${zone} zone`);
  return pick;
}

beforeEach(() => {
  machine.setKeyStatus.mockClear();
  machine.typeText.mockClear();
  machine.getKeyQueueLength.mockReturnValue(0);
  machine.getMachineProperty.mockReturnValue(false);
});

describe("HT-1080Z virtual keyboard", () => {
  it("renders every matrix key of the drawing once, both SHIFTs, PAGE and F1", async () => {
    const container = await render();
    const names = [...container.querySelectorAll("[data-ht1080z-key]")].map((g) => g.getAttribute("data-ht1080z-key")!);
    // --- The 52 matrix keys, the second SHIFT, PAGE and F1
    expect(names).toHaveLength(55);
    expect(names.filter((n) => n === "Shift")).toHaveLength(2);
    expect(new Set(names)).toEqual(new Set(Object.keys(K)));
    expect(HT1080Z_KEY_ROWS.map((r) => r.keys.length)).toEqual([14, 14, 12, 12, 1, 2]);
  });

  it("prints the drawing's legends", async () => {
    const container = await render();
    const text = container.textContent ?? "";
    for (const legend of ["BREAK", "CLEAR", "NEW", "LINE", "SHIFT", "PAGE", "F1", "↑", "↓", "←", "→", "@", "\\", "!", "?"]) {
      expect(text, legend).toContain(legend);
    }
  });

  it("the face holds the key; the right button adds SHIFT", async () => {
    const container = await render();
    const face = zoneOf(container, "Q", "main");
    fireEvent.mouseDown(face, { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Q, true]]);
    fireEvent.mouseUp(face, { button: 0 });
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(face, { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.Q, true],
      [K.Shift, true]
    ]);
  });

  it("the printed shifted legend holds SHIFT with the key", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "N2", "shift"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.N2, true],
      [K.Shift, true]
    ]);
  });

  it("both SHIFT keys press the one SHIFT contact", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "Shift", "main", 1), { button: 2 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.Shift, true]]);
  });

  it("a Series II hint types its accent through the typer: left the capital, right the small letter", async () => {
    const container = await render("s2");
    fireEvent.mouseDown(zoneOf(container, "E", "hint"), { button: 0 });
    fireEvent.mouseDown(zoneOf(container, "E", "hint"), { button: 2 });
    expect(machine.typeText.mock.calls).toEqual([["É"], ["é"]]);
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
  });

  it("shows each model's hints, and every hint is a character its typer can type", async () => {
    expect((await render("s1")).querySelectorAll('[data-zone="hint"]')).toHaveLength(0);
    expect((await render("s2")).querySelectorAll('[data-zone="hint"]')).toHaveLength(4);
    expect((await render("s64")).querySelectorAll('[data-zone="hint"]')).toHaveLength(16);
    for (const romSet of ["s2", "s64"] as const) {
      for (const pair of Object.values(HT1080Z_HINTS[romSet])) {
        for (const ch of pair) expect(ht1080zStrokesForCharacter(ch, romSet), `${romSet} ${ch}`).toBeDefined();
      }
    }
  });

  it("PAGE and F1 go to the machine, which latches them", async () => {
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "Page", "main"), { button: 0 });
    fireEvent.mouseUp(zoneOf(container, "Page", "main"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([
      [K.Page, true],
      [K.Page, false]
    ]);
    machine.setKeyStatus.mockClear();
    fireEvent.mouseDown(zoneOf(container, "F1", "main"), { button: 0 });
    expect(machine.setKeyStatus.mock.calls).toEqual([[K.F1, true]]);
  });

  it("ignores clicks while the machine is still typing", async () => {
    machine.getKeyQueueLength.mockReturnValue(3);
    const container = await render();
    fireEvent.mouseDown(zoneOf(container, "A", "main"), { button: 0 });
    fireEvent.mouseDown(zoneOf(container, "A", "hint"), { button: 0 });
    expect(machine.setKeyStatus).not.toHaveBeenCalled();
    expect(machine.typeText).not.toHaveBeenCalled();
  });
});
