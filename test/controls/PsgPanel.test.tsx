import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { createMockStore, renderWithProviders } from "../react-test-utils";

vi.hoisted(() => {
  const doc = globalThis.document as unknown as Record<string, unknown>;
  if (doc && typeof doc.queryCommandSupported !== "function") {
    doc.queryCommandSupported = () => false;
    doc.queryCommandEnabled = () => false;
  }
});

const emuApi = vi.hoisted(() => ({ getPsgState: vi.fn() }));
vi.mock("@renderer/core/EmuApi", () => ({ useEmuApi: () => emuApi }));

const listeners: (() => Promise<void> | void)[] = [];
vi.mock("@renderer/appIde/useStateRefresh", () => ({
  useEmuStateListener: (_api: unknown, fn: () => Promise<void> | void) => {
    listeners.push(fn);
  }
}));

import { PsgPanel } from "@renderer/appIde/SideBarPanels/PsgPanel";

/**
 * Distinct values per field, so a row reading the wrong one is visible rather than plausible.
 *
 * That matters here: the bug this suite exists for was `CntC` displaying `cntB`, and with the
 * round-number sample data a panel test would normally use, the two would have been the same
 * number and the assertion would have passed against the broken panel.
 */
const psgState = {
  psgRegisterIndex: 1,
  envFreq: 2,
  envStyle: 3,
  cntEnv: 4,
  posEnv: 5,
  toneA: 10, toneAEnabled: true, noiseAEnabled: false, volA: 11, envA: false, cntA: 12, bitA: true,
  toneB: 20, toneBEnabled: false, noiseBEnabled: true, volB: 21, envB: true, cntB: 22, bitB: false,
  toneC: 30, toneCEnabled: true, noiseCEnabled: true, volC: 31, envC: false, cntC: 33, bitC: true,
  noiseFreq: 40,
  cntNoise: 41,
  bitNoise: false
};

const tick = async () => {
  for (const fn of [...listeners]) await fn();
};

const render = async () => {
  const result = renderWithProviders(<PsgPanel />, { store: createMockStore() });
  await tick();
  return result;
};

beforeEach(() => {
  listeners.length = 0;
  emuApi.getPsgState.mockReset().mockResolvedValue(psgState);
});

describe("PsgPanel", () => {
  it("says so when there is no PSG state yet", () => {
    renderWithProviders(<PsgPanel />, { store: createMockStore() });
    expect(screen.getByText("PSG state not available")).toBeTruthy();
  });

  /*
   * The shipped bug: the row labelled `CntC` read `psgState.cntB`, so channel C's counter displayed
   * channel B's value. `cntC` was populated all along (`PsgChipState`, filled from the core).
   */
  it("shows each channel's own counter", async () => {
    await render();
    await waitFor(() => expect(screen.getByText("CntA")).toBeTruthy());

    const counterFor = (name: string) =>
      screen.getByText(`Cnt${name}`).parentElement?.textContent ?? "";

    expect(counterFor("A")).toContain("12");
    expect(counterFor("B")).toContain("22");
    expect(counterFor("C")).toContain("33");
  });

  it("renders all three channels", async () => {
    await render();
    await waitFor(() => expect(screen.getByText("ToneA")).toBeTruthy());
    for (const name of ["A", "B", "C"]) {
      expect(screen.getByText(`Tone${name}`)).toBeTruthy();
      expect(screen.getByText(`Vol${name}`)).toBeTruthy();
      expect(screen.getByText(`Bit${name}`)).toBeTruthy();
    }
  });
});
