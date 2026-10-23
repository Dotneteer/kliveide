import { describe, expect, it } from "vitest";

import { readKliveStateFile, writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { HT_VIDEO_PAGE } from "@emu/machines/machine-props";
import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";

/**
 * The debugger and state files on the HT-1080Z (`.plans/HT1080Z_PLAN.md` Phase 8), driven as the IDE
 * drives them: breakpoints in the ROM and in RAM, step into/over/out, and a state saved to a `.kls`
 * file and restored into another machine of the same model.
 */

/*
 *   6000h  DI
 *   6001h  LD SP,7F00h
 *   6004h  CALL 6010h
 *   6007h  LD A,1          <- after
 *   6009h  JR 6009h        <- done
 *   6010h  LD IX,1234h     <- routine (a prefixed instruction)
 *   6014h  CALL 6020h
 *   6017h  LD (6100h),A
 *   601Ah  OUT (1Fh),A
 *   601Ch  RET
 *   6020h  NOP             <- leaf
 *   6021h  RET
 */
const CODE: [number, number[]][] = [
  [0x6000, [0xf3, 0x31, 0x00, 0x7f, 0xcd, 0x10, 0x60, 0x3e, 0x01, 0x18, 0xfe]],
  [0x6010, [0xdd, 0x21, 0x34, 0x12, 0xcd, 0x20, 0x60, 0x32, 0x00, 0x61, 0xd3, 0x1f, 0xc9]],
  [0x6020, [0x00, 0xc9]]
];

async function withProgram(): Promise<Ht1080zTestSession> {
  const s = (await createHtSession()).bootToPrompt();
  for (const [address, bytes] of CODE) s.poke(address, bytes);
  s.attachDebugSupport();
  s.machine.pc = 0x6000;
  return s;
}

describe("HT-1080Z debugger", () => {
  it("stops at a breakpoint in the ROM: the wait-for-key loop", async () => {
    const s = (await createHtSession()).bootToPrompt();
    s.breakpoint(0x004e);
    expect(s.debug("continue")).toBe(0x004e);
    expect(s.debug("continue")).toBe(0x004e);
  });

  it("steps into, over and out", async () => {
    const s = await withProgram();
    expect(s.debug("stepInto")).toBe(0x6001);
    expect(s.debug("stepInto")).toBe(0x6004);
    expect(s.debug("stepInto")).toBe(0x6010);
    // --- A prefixed instruction is one step
    expect(s.debug("stepInto")).toBe(0x6014);
    expect(s.machine.ix).toBe(0x1234);
    // --- Over the CALL to leaf
    expect(s.debug("stepOver")).toBe(0x6017);
    // --- Out of routine, to after the CALL
    expect(s.debug("stepOut")).toBe(0x6007);
  });

  it("stops at a breakpoint in RAM with the registers there", async () => {
    const s = await withProgram();
    s.breakpoint(0x6020);
    expect(s.debug("continue")).toBe(0x6020);
    expect(s.machine.ix).toBe(0x1234);
    expect(s.machine.sp).toBe(0x7f00 - 4);
  });
});

describe("HT-1080Z state files", () => {
  it("restores a saved /64 into another /64: program, screen, AY, video switches and CPU", async () => {
    const a = (await createHtSession({ model: "ht1080z-64" })).bootToPrompt();
    a.typeKeys('10 PRINT "STATE"\nRUN\nOUT 31,8:OUT 30,13\n', { settle: 20 });
    a.machine.setMachineProperty(HT_VIDEO_PAGE, true);
    a.runFrames(2);
    const parts = a.machine.saveMachineState();
    const bytes = writeKliveStateFile({
      header: {
        machineId: a.machine.machineId,
        modelId: "ht1080z-64",
        kliveVersion: "0.0.0",
        coreId: parts.coreId,
        fingerprint: parts.fingerprint,
        memorySize: parts.memorySize,
        savedAt: new Date(0).toISOString(),
        pc: a.machine.pc,
        machineName: "HT-1080Z/64"
      },
      image: parts.image,
      host: parts.host,
      media: []
    });
    const file = readKliveStateFile(bytes);

    const b = await createHtSession({ model: "ht1080z-64" });
    b.runFrames(3);
    b.machine.loadMachineState({ ...parts, image: file.image, host: file.host });
    expect(b.machine.pc).toBe(a.machine.pc);
    expect(b.screenText()).toEqual(a.screenText());
    expect(b.peekWord(0x40a4)).toBe(a.peekWord(0x40a4));
    expect(b.machine.wasmV2Runtime!.exports.ht1080zReadPsgRegisterValue(8)).toBe(13);
    // --- The video switches are the core's: the properties follow the restored state
    expect(b.machine.getMachineProperty(HT_VIDEO_PAGE)).toBe(true);
    // --- And both run on the same
    a.runFrames(5);
    b.runFrames(5);
    expect(b.screenPixels()).toEqual(a.screenPixels());
    expect(b.machine.tacts).toBe(a.machine.tacts);
  });
});
