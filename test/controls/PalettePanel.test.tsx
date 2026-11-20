import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";

/**
 * `getCpuStateChunk` is what `EmuStateListener` polls; it fires the panel's refresh whenever the
 * chunk changed, and immediately (rather than on its 750ms throttle) while the machine is paused.
 * Returning a fresh `tacts` on every call is therefore how a test makes the panel re-poll.
 */
const emuApi = vi.hoisted(() => {
  let tacts = 0;
  return {
    getPalettedDeviceInfo: vi.fn(),
    getPaletteVersion: vi.fn(),
    getCpuStateChunk: vi.fn(async () => ({ state: 3, pcValue: 0, tacts: tacts++ })),
    listBreakpoints: vi.fn(async () => ({ breakpoints: [] as any[] }))
  };
});
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));
const executeCommand = vi.hoisted(() => vi.fn());
vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({ ideCommandsService: { executeCommand } })
}));

import { PalettePanel, PalettePanelActions } from "@renderer/appIde/SideBarPanels/PalettePanel";

/** The ULA power-on palette as `PaletteDevice` stores it — device layout, repeating every 16. */
const DEF_ULA = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d, 0x000, 0x007, 0x1c0, 0x1c7, 0x038, 0x03f,
  0x1f8, 0x1ff
];
const ULA = Array.from({ length: 256 }, (_, i) => DEF_ULA[i % 16]);
/** What Layer 2 / sprites / tilemap reset to: `(i << 1) | (i & 2 ? 1 : 0)`. */
const RAMP = Array.from({ length: 256 }, (_, i) => (i << 1) | (i & 2 ? 1 : 0));

const info = (over: any = {}) => ({
  ulaFirst: ULA,
  ulaSecond: ULA,
  layer2First: RAMP,
  layer2Second: RAMP,
  spriteFirst: RAMP,
  spriteSecond: RAMP,
  tilemapFirst: RAMP,
  tilemapSecond: RAMP,
  storedPaletteValue: 0,
  spriteTransparencyIndex: 0xe3,
  tilemapTransparencyIndex: 0x0f,
  reg43Value: 0,
  reg6bValue: 0,
  ulaNextFormat: 0,
  ...over
});

const bankButtons = (container: HTMLElement, device: string) => [
  ...(container
    .querySelector(`[aria-label="${device} palette bank"]`)
    ?.querySelectorAll("button") ?? [])
];

/**
 * The Next Palettes sidebar panel.
 *
 * Two things are actually under test: that the panel presents four devices with two banks each
 * rather than eight peer entries, and that the live-bank marker follows the registers that decide
 * it. The third — the colour conversion — is the regression that motivated the rewrite.
 */
describe("PalettePanel", () => {
  beforeEach(() => {
    emuApi.getPalettedDeviceInfo.mockReset();
    emuApi.getPalettedDeviceInfo.mockResolvedValue(info());
    emuApi.getPaletteVersion.mockReset();
    emuApi.getPaletteVersion.mockRejectedValue(new Error("no version"));
  });

  const render = async () => {
    const r = renderWithProviders(<PalettePanel />);
    await waitFor(() => expect(emuApi.getPalettedDeviceInfo).toHaveBeenCalled());
    await screen.findByText("ULA");
    return r;
  };

  it("shows the four devices, not eight palettes", async () => {
    await render();
    for (const name of ["ULA", "Layer 2", "Sprites", "Tilemap"]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.queryByText("ULA first")).toBeNull();
    expect(screen.queryByText("ULA second")).toBeNull();
  });

  it("says something before anything is expanded", async () => {
    // The panel two versions ago opened on eight collapsed switches and no colour at all. Each
    // device carries a thumbnail of its whole palette, so the closed panel still reports the
    // machine's colour state — sixteen 16-stop gradient rows per device, not 256 elements.
    const { container } = await render();
    const rows = [...container.querySelectorAll("i")].filter((d) =>
      d.style.background.startsWith("linear-gradient")
    );
    expect(rows.length).toBe(4 * 16);
  });

  it("previews the whole palette rather than a strip of it", async () => {
    // The preview this replaced was a 2x128 gradient: ~1.7px per entry, which cannot show an
    // individual colour, and on the ULA it showed the palette's 16-entry repeat period rather than
    // its colours. The thumbnail is a miniature of the real grid — every row of it, in order.
    const { container } = await render();
    const ula = container.querySelector("[aria-hidden='true']") as HTMLElement;
    const rows = [...ula.querySelectorAll("i")];
    expect(rows.length).toBe(16);
    // Row 0 of the ULA palette is the sixteen Spectrum colours, in order. (jsdom normalises the
    // hex the component writes to `rgb()`.)
    const row0 = rows[0].style.background;
    expect(row0.indexOf("rgb(0, 0, 0)")).toBeLessThan(row0.indexOf("rgb(0, 0, 182)")); // black, blue
    expect(row0).toContain("rgb(182, 182, 182)"); // dim white
    expect(row0).toContain("rgb(255, 255, 255)"); // bright white, the last entry
  });

  it("converts device values before drawing them", async () => {
    // The regression: the panel used to hand `PaletteDevice`'s straight 9-bit values to a viewer
    // that speaks the register layout, so ULA blue ($005) drew as #002449, a dark teal.
    const { container } = await render();
    fireEvent.click(screen.getByText("ULA"));
    const blue = await screen.findByLabelText("$01");
    expect(blue.style.backgroundColor).toBe("rgb(0, 0, 182)"); // #0000B6
    expect(container.querySelectorAll('[role="gridcell"]').length).toBe(256);
  });

  it("opens and closes a device's full grid", async () => {
    const { container } = await render();
    expect(container.querySelectorAll('[role="grid"]').length).toBe(0);
    fireEvent.click(screen.getByText("Sprites"));
    expect(container.querySelectorAll('[role="grid"]').length).toBe(1);
    fireEvent.click(screen.getByText("Sprites"));
    expect(container.querySelectorAll('[role="grid"]').length).toBe(0);
  });

  it("marks the sprite palette's transparency index, and only where there is one", async () => {
    // ULA and Layer 2 have no transparency *index* — Reg $14 is a global transparency colour — so
    // marking an entry for them would be an invention.
    const { container } = await render();
    fireEvent.click(screen.getByText("Sprites"));
    const marked = [...container.querySelectorAll('[role="gridcell"]')].filter(
      (c) => c.childElementCount > 0
    );
    expect(marked.map((c) => c.getAttribute("aria-label"))).toEqual(["$E3"]);

    fireEvent.click(screen.getByText("Sprites"));
    fireEvent.click(screen.getByText("ULA"));
    expect(
      [...container.querySelectorAll('[role="gridcell"]')].filter((c) => c.childElementCount > 0)
        .length
    ).toBe(0);
  });

  describe("the live bank", () => {
    it("defaults to showing whichever bank the hardware is drawing from", async () => {
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ reg43Value: 0x04 })); // Layer 2 second
      const { container } = await render();
      const [first, second] = bankButtons(container, "Layer 2");
      expect(first.getAttribute("aria-pressed")).toBe("false");
      expect(second.getAttribute("aria-pressed")).toBe("true");
    });

    it("reads each device from its own register bit", async () => {
      // $43 bit 1 = ULA, bit 2 = Layer 2, bit 3 = sprites; the tilemap lives in $6B bit 4.
      emuApi.getPalettedDeviceInfo.mockResolvedValue(
        info({ reg43Value: 0x02 | 0x08, reg6bValue: 0x10 })
      );
      const { container } = await render();
      const live = (device: string) =>
        bankButtons(container, device).findIndex((b) =>
          (b.getAttribute("aria-label") ?? "").includes("(live)")
        );
      expect(live("ULA")).toBe(1);
      expect(live("Layer 2")).toBe(0);
      expect(live("Sprites")).toBe(1);
      expect(live("Tilemap")).toBe(1);
    });

    it("marks the live bank on the control itself, with no separate marker element", async () => {
      // The live indication is a class on the segment (an inset accent ring), not a child node. It
      // used to be a 3px dot, which on the filled segment had to be drawn in `--text-on-accent` —
      // near-black in dark — and so read as a speck of dirt in the common state where shown and
      // live coincide. Nothing inside these buttons but the bank number.
      const { container } = await render();
      for (const device of ["ULA", "Layer 2", "Sprites", "Tilemap"]) {
        for (const b of bankButtons(container, device)) {
          expect(b.childElementCount).toBe(0);
        }
      }
      const [first, second] = bankButtons(container, "ULA");
      expect(first.getAttribute("aria-label")).toBe("First palette (live)");
      expect(second.getAttribute("aria-label")).toBe("Second palette");
      expect(first.className).not.toBe(second.className);
    });

    it("follows the register while nothing has been pinned", async () => {
      const { container } = await render();
      expect(bankButtons(container, "ULA")[0].getAttribute("aria-pressed")).toBe("true");

      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ reg43Value: 0x02 }));
      await waitFor(
        () => expect(bankButtons(container, "ULA")[1].getAttribute("aria-pressed")).toBe("true"),
        { timeout: 3000 }
      );
    });

    it("keeps a bank the user picked when the machine switches banks under it", async () => {
      // Now that the view follows the register by default, an explicit pick has to survive the next
      // poll — otherwise a program flipping $43 yanks the palette out from under anyone comparing
      // the two banks, and comparing them is the only reason to pick one by hand.
      const red = Array.from({ length: 256 }, () => 0x1c0);
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ ulaSecond: red }));
      const { container } = await render();

      fireEvent.click(screen.getByText("ULA"));
      const [first, second] = bankButtons(container, "ULA");
      fireEvent.click(first);
      expect(first.getAttribute("aria-pressed")).toBe("true");

      // The machine switches the ULA to its second bank.
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ reg43Value: 0x02, ulaSecond: red }));
      await waitFor(
        () => expect(second.getAttribute("aria-label")).toBe("Second palette (live)"),
        { timeout: 3000 }
      );

      // The pin holds: still showing the first bank, whose entry $01 is blue, not the second's red.
      expect(first.getAttribute("aria-pressed")).toBe("true");
      expect(second.getAttribute("aria-pressed")).toBe("false");
      expect(screen.getByLabelText("$01").style.backgroundColor).toBe("rgb(0, 0, 182)");
    });
  });

  describe("palette changes (NEXT_PALETTE_DEBUGGING_PLAN §5)", () => {
    /** Written marks: `slot` (the $43 order) with `count` entries from index 0 */
    const writtenMarks = (slot: number, count: number) => {
      const bytes = new Array(256).fill(0);
      for (let i = 0; i < count; i++) bytes[slot * 32 + (i >> 3)] |= 1 << (i & 7);
      return bytes;
    };

    it("puts a changed-state dot after a device written since the last stop, with counts per bank", async () => {
      // --- Sprites: slot 2 is its first bank, slot 6 its second
      const written = writtenMarks(2, 3).map((b, i) => b | writtenMarks(6, 1)[i]);
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ written }));
      await render();
      const marks = screen.getAllByRole("img");
      expect(marks).toHaveLength(1);
      expect(marks[0].getAttribute("aria-label")).toBe(
        "Bank 1: 3 entries written since the last stop\nBank 2: 1 entry written since the last stop"
      );
      expect(screen.getByText("Sprites").contains(marks[0])).toBe(true);
    });

    it("shows no dot when nothing was written", async () => {
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ written: new Array(256).fill(0) }));
      await render();
      expect(screen.queryAllByRole("img")).toHaveLength(0);
    });

    it("does not read the palettes again while their version is unchanged", async () => {
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ version: 7 }));
      emuApi.getPaletteVersion.mockResolvedValue(7);
      await render();
      await waitFor(() => expect(emuApi.getPaletteVersion).toHaveBeenCalled(), { timeout: 3000 });
      expect(emuApi.getPalettedDeviceInfo).toHaveBeenCalledTimes(1);

      // --- A new version: the panel reads again and shows the new state
      emuApi.getPalettedDeviceInfo.mockResolvedValue(info({ version: 8, written: writtenMarks(0, 1) }));
      emuApi.getPaletteVersion.mockResolvedValue(8);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1), { timeout: 3000 });
      expect(emuApi.getPalettedDeviceInfo).toHaveBeenCalledTimes(2);
    });
  });

  it("reports an empty state until the emulator has answered", () => {
    emuApi.getPalettedDeviceInfo.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<PalettePanel />);
    expect(screen.getByText("No palette information")).toBeTruthy();
  });

  // --- NEXT_PALETTE_DEBUGGING_PLAN §4 (mockup 1): the breakpoint dot and the pop-out button
  describe("palette breakpoints and the Palette document", () => {
    it("marks a device an enabled pal: breakpoint watches, and no other", async () => {
      emuApi.listBreakpoints.mockResolvedValue({
        breakpoints: [{ paletteStop: "spr1:$03" }, { paletteStop: "tm:live", disabled: true }]
      });
      await render();
      const mark = await screen.findByRole("img", { name: "A palette breakpoint watches Sprites" });
      expect(screen.getByText("Sprites").contains(mark)).toBe(true);
      expect(screen.queryByRole("img", { name: "A palette breakpoint watches Tilemap" })).toBeNull();
      emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });
    });

    it("pops out into the Palette document", () => {
      renderWithProviders(<PalettePanelActions panelId="nextPalettePanel" expanded={true} />);
      fireEvent.click(screen.getByRole("button"));
      expect(executeCommand).toHaveBeenCalledWith("show-palettes");
    });
  });
});
