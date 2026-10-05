import { describe, expect, it } from "vitest";

import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import { writeSpectrumSnapshot } from "@common/spectrum/snapshot/writeSpectrumSnapshot";
import { mapSpectrumSnapshotToKlive } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { createBlankTrd } from "@emu/machines/disk/trd/trdImage";
import { createSp128Session } from "../../harness/sp128";
import { BUFFER, buildTestTrdosRom, callRom, ENTRY } from "./test-rom";

/*
 * The Beta 128 in snapshots and Klive state files (`.plans/BETA128_TRDOS_PLAN.md` Phase 5): the
 * `.szx` B128 / BDSK blocks (zx-state), the `.sna` TR-DOS byte, and the core's memory image.
 */

const SYS = 0x5c;

async function pentagon() {
  const s = await createSp128Session("pentagon", { trdosRom: await buildTestTrdosRom() });
  s.runFrames(150);
  s.insertDisk(0, createBlankTrd({ cylinders: 80, sides: 2 }));
  callRom(s, ENTRY.SYS, SYS);
  callRom(s, ENTRY.WAITI);
  return s;
}

const x = (s: Awaited<ReturnType<typeof pentagon>>) =>
  s.machine.wasmV2Runtime!.exports as unknown as Record<string, (...args: number[]) => number>;

describe("Beta 128 in snapshots", () => {
  it(".szx keeps the interface's registers and the head position (B128 / BDSK) and restores them", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.DATA, 12);
    callRom(s, ENTRY.WAIT, 0x10); // --- seek to 12
    callRom(s, ENTRY.SECTOR, 7);
    const capture = s.captureSnapshot();
    expect(capture.machine).toBe("pentagon");
    expect(capture.peripherals.beta128).toMatchObject({ drives: 2, paged: false, system: SYS, track: 12, sector: 7 });

    // --- Linked disks need a file name: the capture's media say which (the IDE passes them)
    capture.peripherals.beta128!.disks.push({ drive: 0, cylinder: 12, diskType: 0, writeProtected: false, fileName: "/disks/game.trd" });
    const { bytes } = writeSpectrumSnapshot(capture, "szx");
    const parsed = parseSpectrumSnapshot("x.szx", bytes);
    expect(parsed.peripherals.beta128).toEqual(capture.peripherals.beta128);
    expect(parsed.chunks!.filter((c) => c.id === "B128" || c.id === "BDSK").every((c) => c.known)).toBe(true);

    const t = await createSp128Session("pentagon", { trdosRom: await buildTestTrdosRom() });
    t.insertDisk(0, createBlankTrd({ cylinders: 80, sides: 2 }));
    t.loadSnapshot("x.szx", bytes);
    expect(t.beta128()).toMatchObject({ system: SYS, track: 12, sector: 7, paged: false });
    expect(t.beta128().cylinders[0]).toBe(12);
  }, 120_000);

  it(".sna carries whether TR-DOS was paged in, and opens on the Pentagon", async () => {
    const s = await pentagon();
    x(s).sp128BetaSetPaged(1);
    expect(s.machine.getCurrentPartitions()[0]).toBe(-3);
    const { bytes, losses } = writeSpectrumSnapshot(s.captureSnapshot(), "sna");
    expect(losses.join()).toMatch(/only whether TR-DOS was paged in/);
    const parsed = parseSpectrumSnapshot("x.sna", bytes);
    expect(parsed.peripherals.trdosPaged).toBe(true);
    expect(mapSpectrumSnapshotToKlive(parsed).modelIds[0]).toBe("pentagon");

    const t = await createSp128Session("pentagon", { trdosRom: await buildTestTrdosRom() });
    t.loadSnapshot("x.sna", bytes);
    expect(t.beta128().paged).toBe(true);
    expect(t.peek(0x3d00)).toBe(0xc3); // --- the test ROM's jump table, not the 48K ROM's font
  }, 120_000);

  it("a Klive state keeps the disk with the guest's writes, and detaches it from its file", async () => {
    const s = await pentagon();
    callRom(s, ENTRY.SECTOR, 4);
    s.poke(BUFFER, Uint8Array.from({ length: 256 }, (_, i) => i ^ 0x5a));
    expect(callRom(s, ENTRY.WRITE, 0xa0).a).toBe(0);
    s.runFrames(1);
    expect(s.takeDiskChanges(0)?.size).toBe(1);
    const state = s.machine.saveMachineState();

    const t = await pentagon();
    t.machine.loadMachineState(state);
    callRom(t, ENTRY.SECTOR, 4);
    t.poke(BUFFER, new Uint8Array(256));
    expect(callRom(t, ENTRY.READ, 0x80).a).toBe(0);
    expect(t.peek(BUFFER + 1)).toBe(1 ^ 0x5a);
    // --- A write after the restore stays in the emulated disk: the file is detached (D11)
    t.poke(BUFFER, new Uint8Array(256).fill(9));
    expect(callRom(t, ENTRY.WRITE, 0xa0).a).toBe(0);
    t.runFrames(1);
    expect(t.takeDiskChanges(0)).toBeUndefined();
    expect(t.diskUnsaved(0)).toBe(true);
  }, 120_000);
});
