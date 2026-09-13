import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { applyBreakpointEdit } from "@renderer/appIde/utils/breakpoint-actions";

/**
 * A fake standing in for the emulator's breakpoint API.
 *
 * `applyBreakpointEdit` is entirely about *which* calls it makes and in what shape, so the test
 * asserts on the calls rather than on an emulator's resulting state.
 */
function createFakeEmuApi(existing: BreakpointInfo[] = []) {
  return {
    listBreakpoints: vi.fn().mockResolvedValue({ breakpoints: existing }),
    setBreakpoint: vi.fn().mockResolvedValue(true),
    removeBreakpoint: vi.fn().mockResolvedValue(true),
    enableBreakpoint: vi.fn().mockResolvedValue(true),
    restoreBreakpoints: vi.fn().mockResolvedValue(undefined),
    eraseAllBreakpoints: vi.fn().mockResolvedValue(undefined)
  } as any;
}

const execAt = (address: number, over: Partial<BreakpointInfo> = {}): BreakpointInfo => ({
  address,
  exec: true,
  memoryRead: false,
  memoryWrite: false,
  ioRead: false,
  ioWrite: false,
  ...over
});

describe("applyBreakpointEdit - adding", () => {
  let emuApi: any;

  beforeEach(() => {
    emuApi = createFakeEmuApi();
  });

  it("sets the breakpoint", async () => {
    const breakpoint = execAt(0x8000);

    await applyBreakpointEdit(emuApi, { breakpoint });

    expect(emuApi.setBreakpoint).toHaveBeenCalledWith(breakpoint);
    expect(emuApi.restoreBreakpoints).not.toHaveBeenCalled();
  });

  it("leaves an enabled breakpoint alone", async () => {
    await applyBreakpointEdit(emuApi, { breakpoint: execAt(0x8000, { disabled: false }) });

    expect(emuApi.enableBreakpoint).not.toHaveBeenCalled();
  });

  it("disables a breakpoint added as disabled", async () => {
    // --- `setBreakpoint` alone gets the emulator's *flags* right but leaves the stored definition
    // --- reporting the breakpoint as armed, so the panel would show it enabled. This call is what
    // --- writes the definition.
    const breakpoint = execAt(0x8000, { disabled: true });

    await applyBreakpointEdit(emuApi, { breakpoint });

    expect(emuApi.enableBreakpoint).toHaveBeenCalledWith(breakpoint, false);
  });
});

describe("applyBreakpointEdit - editing in place", () => {
  it("uses setBreakpoint when the key did not move", async () => {
    const emuApi = createFakeEmuApi([execAt(0x8000)]);
    const replaces = execAt(0x8000);
    const breakpoint = execAt(0x8000, { disabled: true });

    await applyBreakpointEdit(emuApi, { breakpoint, replaces });

    expect(emuApi.setBreakpoint).toHaveBeenCalledWith(breakpoint);
    expect(emuApi.enableBreakpoint).toHaveBeenCalledWith(breakpoint, false);
    expect(emuApi.restoreBreakpoints).not.toHaveBeenCalled();
  });

  it("re-arms a breakpoint the user just enabled", async () => {
    const emuApi = createFakeEmuApi([execAt(0x8000, { disabled: true })]);

    await applyBreakpointEdit(emuApi, {
      breakpoint: execAt(0x8000, { disabled: false }),
      replaces: execAt(0x8000, { disabled: true })
    });

    expect(emuApi.setBreakpoint).toHaveBeenCalled();
    expect(emuApi.enableBreakpoint).not.toHaveBeenCalled();
  });
});

describe("applyBreakpointEdit - editing when the key moves", () => {
  it("replaces the whole set in one call rather than removing and re-adding", async () => {
    // --- A breakpoint's identity is its key, so moving the address is a delete plus an insert.
    // --- Doing that as two calls leaves a window in which a concurrent gutter toggle is lost;
    // --- `restoreBreakpoints` performs the swap inside one synchronous handler.
    const emuApi = createFakeEmuApi([execAt(0x8000), execAt(0x9000)]);
    const breakpoint = execAt(0xa000);

    await applyBreakpointEdit(emuApi, { breakpoint, replaces: execAt(0x8000) });

    expect(emuApi.restoreBreakpoints).toHaveBeenCalledTimes(1);
    expect(emuApi.setBreakpoint).not.toHaveBeenCalled();
    expect(emuApi.removeBreakpoint).not.toHaveBeenCalled();

    const installed = emuApi.restoreBreakpoints.mock.calls[0][0] as BreakpointInfo[];
    expect(installed.map((bp) => bp.address)).toEqual([0x9000, 0xa000]);
  });

  it("keeps every breakpoint it was not asked to touch", async () => {
    const emuApi = createFakeEmuApi([
      execAt(0x8000),
      { address: 0x9000, memoryRead: true },
      { resource: "code/code.kz80.asm", line: 12 }
    ]);

    await applyBreakpointEdit(emuApi, {
      breakpoint: execAt(0xa000),
      replaces: execAt(0x8000)
    });

    const installed = emuApi.restoreBreakpoints.mock.calls[0][0] as BreakpointInfo[];
    expect(installed).toHaveLength(3);
    // --- A source-bound breakpoint is not editable here, but it must survive an edit to a
    // --- neighbouring binary one.
    expect(installed).toContainEqual({ resource: "code/code.kz80.asm", line: 12 });
    expect(installed).toContainEqual({ address: 0x9000, memoryRead: true });
  });

  it("does not duplicate a breakpoint when the edit lands on an existing key", async () => {
    const emuApi = createFakeEmuApi([execAt(0x8000), execAt(0x9000)]);

    await applyBreakpointEdit(emuApi, {
      breakpoint: execAt(0x9000, { disabled: true }),
      replaces: execAt(0x8000)
    });

    const installed = emuApi.restoreBreakpoints.mock.calls[0][0] as BreakpointInfo[];
    expect(installed).toHaveLength(1);
    expect(installed[0]).toMatchObject({ address: 0x9000, disabled: true });
  });

  it("treats a type change as a move, since the key carries the type", async () => {
    const emuApi = createFakeEmuApi([execAt(0x8000)]);

    await applyBreakpointEdit(emuApi, {
      breakpoint: { address: 0x8000, memoryRead: true },
      replaces: execAt(0x8000)
    });

    expect(emuApi.restoreBreakpoints).toHaveBeenCalledTimes(1);
    const installed = emuApi.restoreBreakpoints.mock.calls[0][0] as BreakpointInfo[];
    expect(installed).toEqual([{ address: 0x8000, memoryRead: true }]);
  });

  it("does not need a follow-up enable call, because restoreBreakpoints re-applies disabled", async () => {
    const emuApi = createFakeEmuApi([execAt(0x8000)]);

    await applyBreakpointEdit(emuApi, {
      breakpoint: execAt(0xa000, { disabled: true }),
      replaces: execAt(0x8000)
    });

    expect(emuApi.enableBreakpoint).not.toHaveBeenCalled();
  });

  it("survives an emulator that reports no breakpoints", async () => {
    const emuApi = createFakeEmuApi();
    emuApi.listBreakpoints.mockResolvedValue({ breakpoints: undefined });

    await applyBreakpointEdit(emuApi, {
      breakpoint: execAt(0xa000),
      replaces: execAt(0x8000)
    });

    expect(emuApi.restoreBreakpoints).toHaveBeenCalledWith([execAt(0xa000)]);
  });
});
