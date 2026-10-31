import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";
import { buildEpDaveDebugState, buildEpNickDebugState } from "@emu/machines/enterprise/EpDebugState";

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({ getEpNickState: vi.fn(), getEpDaveState: vi.fn() }));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const listeners: (() => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: () => Promise<void> | void) => {
    listeners.push(fn);
  }
}));

import { EpNickPanel } from "@renderer/appIde/SideBarPanels/EpNickPanel";
import { EpDavePanel } from "@renderer/appIde/SideBarPanels/EpDavePanel";

const tick = async () => {
  for (const fn of [...listeners]) await fn();
};

/** Three blocks at 3000h: CH128, PIXEL (the current one) and a RELOAD VSYNC block */
const vram = new Uint8Array(0x10000);
vram.set([0xe8, 4 << 1, 10, 52, 0x00, 0x40, 0x34, 0x12, 0x11, 0x22, 0, 0, 0, 0, 0, 0], 0x3000);
vram.set([0xc0, (1 << 1) | 0x80, 10, 52, 0x00, 0x48, 0, 0, 0x33, 0, 0, 0, 0, 0, 0, 0], 0x3010);
vram.set([0xfc, 0x01, 6, 63, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0x3020);

const nickState = buildEpNickDebugState(
  {
    ports: [0x15, 0x2a, 0x00, 0xc3],
    lptBase: 0x3000,
    lptAddress: 0x3010,
    lpb: Array.from(vram.subarray(0x3010, 0x3020)),
    ld1: 0x4812,
    ld2: 0x0007,
    linesLeft: 33,
    slot: 21,
    line: 123,
    displayOn: true,
    vsyncOn: false,
    mode: 1,
    dataBus: 0x5a
  },
  (a) => vram[a],
  (c) => 0xff000000 | c
);

const registers = new Array(16).fill(0);
registers[0] = 99;
registers[7] = 0x20 | 0x08;
registers[8] = 0x3f;
const daveState = buildEpDaveDebugState(
  { b4: 0x10, enable: 0x11, latch: 0x02, bf: 0x04, registers },
  [0x00, 0xf8, 0xf9, 0xff],
  ["00", "F8", "SYS", "FF"]
);

beforeEach(() => {
  listeners.length = 0;
  emuApi.getEpNickState.mockReset().mockResolvedValue(nickState);
  emuApi.getEpDaveState.mockReset().mockResolvedValue(daveState);
});

describe("EpNickPanel", () => {
  it("says so when there is no state yet", () => {
    renderWithProviders(<EpNickPanel />, { store: createMockStore() });
    expect(screen.getByText("NICK state not available")).toBeTruthy();
  });

  it("shows the ports, the beam and the current LPB", async () => {
    renderWithProviders(<EpNickPanel />, { store: createMockStore() });
    await tick();
    await waitFor(() => expect(screen.getByText("Current LPB at $3010")).toBeTruthy());
    expect(screen.getByText("P80").parentElement?.textContent).toContain("15");
    expect(screen.getByText("LINE").parentElement?.textContent).toContain("123");
    expect(screen.getByText("LINES").parentElement?.textContent).toContain("64");
    expect(screen.getByText("LPT: 3 blocks")).toBeTruthy();
  });

  it("lists the LPT with the current block marked and its swatches coloured", async () => {
    const { container } = renderWithProviders(<EpNickPanel />, { store: createMockStore() });
    await tick();
    await waitFor(() => expect(screen.getByText("3020")).toBeTruthy());
    const marked = screen.getByText("▶").parentElement?.textContent ?? "";
    expect(marked).toContain("3010");
    expect(marked).toContain("PIXEL");
    expect(marked).toContain("-I-");
    expect(screen.getByText("3020").parentElement?.textContent).toContain("--R");
    const swatch = container.querySelector('[title="Colour byte $33"]') as HTMLElement;
    expect(swatch?.style.backgroundColor).toBe("rgb(51, 0, 0)");
  });
});

describe("EpDavePanel", () => {
  it("says so when there is no state yet", () => {
    renderWithProviders(<EpDavePanel />, { store: createMockStore() });
    expect(screen.getByText("DAVE state not available")).toBeTruthy();
  });

  it("shows the pages with their labels, BFh and the tone channels decoded", async () => {
    renderWithProviders(<EpDavePanel />, { store: createMockStore() });
    await tick();
    await waitFor(() => expect(screen.getByText("Tone channel 0")).toBeTruthy());
    expect(screen.getByText("B2").parentElement?.textContent).toContain("F9");
    expect(screen.getByText("SYS")).toBeTruthy();
    expect(screen.getByText("WAIT").parentElement?.textContent).toContain("M1 only");
    expect(screen.getAllByText("FREQ")[0].parentElement?.textContent).toContain("1250 Hz");
    expect(screen.getByText("SRC").parentElement?.textContent).toContain("50 Hz");
    expect(screen.getByText("TICK").parentElement?.textContent).toContain("250000 Hz");
  });
});
