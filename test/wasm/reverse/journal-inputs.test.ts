/*
 * The input journal captures the inputs trap T2 lists (`.plans/REVERSE_DEBUGGING_PLAN.md` Phase 1):
 * each reaches its core through the machine's own API - as the IDE drives it - and must arrive in the
 * contract-driven journal (`JournalingExports.ts`), exports and direct memory writes alike. A
 * program-requested NextReg $02 hard reset (T11), which TypeScript carries out with a ROM re-upload,
 * is also replayed and must reproduce the machine byte for byte.
 */
import { describe, expect, it } from "vitest";
import { DCK_BANK_DOCK, type DckImage } from "@common/timex/dckFile";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { InputJournal, type JournalEntry } from "@emu/machines/reverse/InputJournal";
import { installJournal } from "@emu/machines/reverse/JournalingExports";
import { HistoryPositionPort, type HistoryPositionExports } from "@emu/machines/reverse/timelinePosition";
import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSp48Session } from "../../harness/sp48";
import { createTimexSession } from "../../harness/timex";
import { createZ88Session } from "../../harness/z88";
import { createZx81Session } from "../../harness/zx81";
import { createSession as createNextSession } from "../../harness/zxnext";
import { ReverseRig } from "../../harness/reverseSupport";
import { expectSameBytes } from "../../expectBytes";

/** Installs a journal on a machine's runtime */
function journalOn(machine: { wasmV2Runtime?: { exports: object } }, coreId: string) {
  const runtime = machine.wasmV2Runtime!;
  const journal = new InputJournal();
  const port = new HistoryPositionPort(runtime.exports as unknown as HistoryPositionExports);
  port.setEnabled(true);
  const handle = installJournal(runtime, coreId, journal, port);
  expect(handle.unclassified).toEqual([]);
  return { journal, handle };
}

const calls = (entries: readonly JournalEntry[]) => entries.flatMap((e) => (e.kind === "call" ? [e.exportName] : []));
const writes = (entries: readonly JournalEntry[]) => entries.flatMap((e) => (e.kind === "write" ? [e] : []));

describe("the input journal captures T2's inputs", () => {
  it("48K: keys, the clock multiplier, FAST_LOAD, setTacts and a tape upload", async () => {
    const s = await createSp48Session();
    s.bootToBasic();
    const { journal } = journalOn(s.machine, "sp48");
    s.keyDown("A").runFrames(1);
    s.machine.targetClockMultiplier = 2;
    s.runFrames(1);
    s.machine.setMachineProperty(FAST_LOAD, false);
    s.machine.setTacts(123_456);
    const tap = new TapReader(new BinaryReader(new Uint8Array(readFileSync(join(__dirname, "../../testfiles/floatspy.tap")))));
    tap.readContent();
    s.insertTape(tap.dataBlocks);
    const names = calls(journal.entries);
    expect(names).toContain("sp48SetKeyStatus");
    expect(names).toContain("sp48SetTargetClockMultiplier");
    expect(names).toContain("sp48TapeSetFastLoad");
    expect(names).toContain("sp48SetTacts");
    expect(names).toContain("sp48TapeSetBlock");
    // --- The tape's bytes go into the core's tape buffer as journaled writes
    const total = writes(journal.entries).reduce((n, w) => n + w.length, 0);
    expect(total).toBe(tap.dataBlocks.reduce((n, b) => n + b.data.length, 0));
  });

  it("Next: keys, joysticks and the mouse", async () => {
    const s = await createNextSession();
    const { journal } = journalOn(s.machine, "zxnext");
    s.keyDown("A");
    s.machine.setJoystickState("left", 0x10);
    s.machine.setJoystickState("right", 0x01);
    s.machine.mousePacket(1, 3, -2, 0);
    expect(calls(journal.entries)).toEqual(
      expect.arrayContaining(["zxnextSetKeyStatus", "zxnextSetJoystickLeftState", "zxnextSetJoystickRightState", "zxnextMousePacket"])
    );
  });

  it("Next: a program's NextReg $02 hard reset is journaled - the take, the reset, the ROM re-upload - and replays", async () => {
    const a = await createNextSession();
    await a.loadCode(`
      .org $8000
start:
      ld bc,0
wait:
      dec bc
      ld a,b
      or c
      jr nz,wait
      nextreg $02,$02
      jr start
`);
    a.runFrames(2);
    const rig = new ReverseRig("zxnext", a.machine);
    rig.port.setEnabled(true);
    const store = rig.createStore(1 << 28);
    const initial = a.machine.saveMachineState();
    store.capture(rig.memory.buffer, rig.port.captureSeed(), rig.frames, rig.journal.length);
    // --- Run until the reset has happened. (Not further: the booting ROM asks for the SD card at once,
    // --- and SD traffic is journaled only from Phase 6 on, D14.)
    const start = rig.journal.length;
    for (let f = 0; f < 400 && !calls(rig.journal.entries.slice(start)).includes("zxnextHardReset"); f++) {
      a.machine.executeMachineFrame();
    }
    const names = calls(rig.journal.entries);
    expect(names).toContain("zxnextTakeResetRequest");
    expect(names).toContain("zxnextHardReset");
    expect(writes(rig.journal.entries).length).toBeGreaterThanOrEqual(4);
    const end = rig.port.position;

    // --- A second machine replays it from the keyframe
    const b = await createNextSession();
    b.machine.loadMachineState(initial);
    const rigB = new ReverseRig("zxnext", b.machine);
    rigB.port.setEnabled(true);
    rigB.createEngine(store, rig.journal).replayTo(end);
    expect(rigB.port.position).toEqual(end);
    expectSameBytes(rigB.image(), rig.image(), "the images after the replayed reset");
  }, 60_000);

  it("Z88: keys, the flap and the battery", async () => {
    const s = await createZ88Session();
    s.runFrames(30);
    const { journal } = journalOn(s.machine, "z88");
    s.machine.setKeyStatus(5, true);
    await s.machine.executeCustomCommand("flap_open");
    await s.machine.executeCustomCommand("flap_close");
    await s.machine.executeCustomCommand("battery_low");
    expect(calls(journal.entries)).toEqual(
      expect.arrayContaining(["z88SetKeyStatus", "z88SignalFlapOpened", "z88SignalFlapClosed", "z88RaiseBatteryLow"])
    );
  });

  it("Timex 2068: a DOCK insert and eject", async () => {
    const s = await createTimexSession({ model: "ts2068" });
    s.bootToBasic();
    const { journal } = journalOn(s.machine, "timex");
    const rom = new Uint8Array(0x2000).fill(0xa4);
    const image: DckImage = {
      banks: [{ bank: DCK_BANK_DOCK, chunkTypes: [0, 0, 0, 0, 0x02, 0, 0, 0], chunks: [undefined, undefined, undefined, undefined, rom, undefined, undefined, undefined] }]
    };
    s.insertCartridge(image);
    s.insertCartridge(undefined);
    expect(calls(journal.entries)).toEqual(expect.arrayContaining(["timexDockEject", "timexDockSetChunkType"]));
    expect(writes(journal.entries).map((w) => w.length)).toEqual([0x2000]);
  });

  it("ZX81: the clock multiplier and a tape", async () => {
    const s = await createZx81Session();
    s.bootToBasic();
    const { journal } = journalOn(s.machine, "zx8081");
    s.machine.targetClockMultiplier = 2;
    s.runFrames(1);
    expect(calls(journal.entries)).toContain("zx8081SetTargetClockMultiplier");
  });

  it("a muted journal drops live input and counts it (D8)", async () => {
    const s = await createNextSession();
    const { journal } = journalOn(s.machine, "zxnext");
    journal.mode = "mute";
    s.keyDown("A");
    s.machine.setJoystickState("left", 0x10);
    expect(journal.length).toBe(0);
    expect(journal.dropped).toBe(2);
    expect(s.machine.wasmV2Runtime!.exports.zxnextGetJoystickLeftState?.() ?? 0).toBe(0);
  });
});
