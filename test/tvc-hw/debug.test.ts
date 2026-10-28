import { describe, expect, it } from "vitest";

import { readKliveStateFile, writeKliveStateFile } from "@common/machineState/kliveStateFile";
import { createTvcSession, type TvcTestSession } from "../harness/tvc";

/**
 * The debugger and state files on the TVC (`.plans/VIDEOTON_TVC_PLAN.md` Phase 6), driven as the IDE
 * drives them: breakpoints in the ROM and in RAM, step into/over/out across `RST 30h` and video RAM,
 * and a state saved to a `.kls` file and restored into another machine of the same model.
 */

/*
 *   6000h  DI
 *   6001h  LD SP,7F00h
 *   6004h  CALL 6010h
 *   6007h  LD A,1          <- after
 *   6009h  JR 6009h        <- done
 *   6010h  LD IX,1234h     <- routine (a prefixed instruction)
 *   6014h  CALL 6020h
 *   6017h  LD (8000h),A    ; video RAM: a stretched write
 *   601Ah  OUT (00h),A     ; the border
 *   601Ch  RET
 *   6020h  NOP             <- leaf
 *   6021h  RET
 */
const CODE: [number, number[]][] = [
  [0x6000, [0xf3, 0x31, 0x00, 0x7f, 0xcd, 0x10, 0x60, 0x3e, 0x01, 0x18, 0xfe]],
  [0x6010, [0xdd, 0x21, 0x34, 0x12, 0xcd, 0x20, 0x60, 0x32, 0x00, 0x80, 0xd3, 0x00, 0xc9]],
  [0x6020, [0x00, 0xc9]]
];

/** Inside BASIC 1.2's keyboard read (D618h-D62Ch): the loop it waits for a key in */
const KEY_WAIT_LOOP = 0xd61b;

async function withProgram(model = "tvc64"): Promise<TvcTestSession> {
  const s = (await createTvcSession({ model })).bootToBasic();
  for (const [address, bytes] of CODE) s.poke(address, bytes);
  s.attachDebugSupport();
  s.machine.pc = 0x6000;
  return s;
}

describe("TVC debugger", () => {
  it("stops at a breakpoint in the ROM: the loop BASIC 1.2 waits for a key in", async () => {
    const s = (await createTvcSession()).bootToBasic();
    s.breakpoint(KEY_WAIT_LOOP);
    expect(s.debug("continue")).toBe(KEY_WAIT_LOOP);
    expect(s.debug("continue")).toBe(KEY_WAIT_LOOP);
  });

  it.each(["tvc64", "tvc64p"])("steps into, over and out on the %s", async (model) => {
    const s = await withProgram(model);
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

  it("steps over a system call: RST 30h and its function byte", async () => {
    const s = (await createTvcSession()).bootToBasic();
    // --- LD SP,7F00h / LD C,"A" / RST 30h / .defb 21h (character out) / NOP / JR $
    s.poke(0x6000, [0x31, 0x00, 0x7f, 0x0e, 0x41, 0xf7, 0x21, 0x00, 0x18, 0xfe]);
    s.attachDebugSupport();
    s.machine.pc = 0x6000;
    expect(s.debug("stepInto")).toBe(0x6003);
    expect(s.debug("stepInto")).toBe(0x6005);
    // --- The step over lands after the function byte, where the handler returns
    expect(s.debug("stepOver")).toBe(0x6007);
  });
});

describe("TVC state files", () => {
  it.each(["tvc64", "tvc64p"])("restores a saved %s into another of its model: program, screen and CPU", async (model) => {
    const a = (await createTvcSession({ model })).bootToBasic();
    a.typeKeys('10 PRINT "STATE"\nRUN\n', { settle: 20 });
    const parts = a.machine.saveMachineState();
    const bytes = writeKliveStateFile({
      header: {
        machineId: a.machine.machineId,
        modelId: model,
        kliveVersion: "0.0.0",
        coreId: parts.coreId,
        fingerprint: parts.fingerprint,
        memorySize: parts.memorySize,
        savedAt: new Date(0).toISOString(),
        pc: a.machine.pc,
        machineName: "Videoton TVC"
      },
      image: parts.image,
      host: parts.host,
      media: []
    });
    const file = readKliveStateFile(bytes);

    const b = await createTvcSession({ model });
    b.runFrames(3);
    b.machine.loadMachineState({ ...parts, image: file.image, host: file.host });
    expect(b.machine.pc).toBe(a.machine.pc);
    expect(b.peek(0x19ef)).toBe(a.peek(0x19ef));
    a.runFrames(5);
    b.runFrames(5);
    expect(b.screenPixels()).toEqual(a.screenPixels());
    expect(b.machine.tacts).toBe(a.machine.tacts);
  });
});
