import { describe, expect, it } from "vitest";

import type { ResponseMessage } from "@common/messaging/messages-core";

import createAppStore from "@state/store";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import { createZ88Session, type Z88Key, type Z88TestSession } from "../../harness/z88";
import { Digest, goldens } from "./z88-goldens";

/*
 * The IDE's view of the Cambridge Z88 (Step 11 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
 *
 * The IDE talks to the emulator only through `MainToEmuProcessor`, so this test drives exactly that:
 * the requests the panels make - the CPU, Blink and memory panels, the partition labels the memory and
 * disassembly views use, the disassembly sections, the call stack - and the two editors, registers
 * and memory, whose writes must reach the core.
 *
 * The answers are checked against `goldens/wasm-z88-ide-parity.json`: what the TypeScript machine
 * answered in the same state, recorded before it was removed
 * (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`, `z88-goldens.ts`).
 */

const golden = goldens("wasm-z88-ide-parity");

/** An IDE request, answered by the emulator's message processor for this machine */
async function ide(s: Z88TestSession, method: string, ...args: unknown[]): Promise<any> {
  const response = (await processMainToEmuMessages(
    { type: "ApiMethodRequest", method, args } as any,
    createAppStore("emu"),
    undefined,
    {
      machineService: {
        getMachineController: () => ({
          machine: s.machine,
          state: 0,
          debugSupport: { breakpoints: [] as unknown[] }
        })
      }
    } as any
  )) as ResponseMessage & { result?: any; message?: string };
  if (response.type !== "ApiMethodResponse") {
    return { error: response.message ?? response.type };
  }
  return response.result;
}

/** An IDE request; its answer must be the golden */
async function expectAnswer(where: string, s: Z88TestSession, method: string, ...args: unknown[]) {
  const answer = await ide(s, method, ...args);
  golden.expect(`${where}: ${method}(${args.map((x) => JSON.stringify(x)).join(", ")})`, answer);
  return answer;
}

/** Everything the IDE panels read */
async function expectIdeState(where: string, s: Z88TestSession): Promise<void> {
  await expectAnswer(where, s, "getCpuState");
  await expectAnswer(where, s, "getCpuStateChunk");
  await expectAnswer(where, s, "getBlinkState");
  await expectAnswer(where, s, "getRomFlags");
  await expectAnswer(where, s, "getPartitionLabels");
  await expectAnswer(where, s, "getPartitionDescriptions");
  await expectAnswer(where, s, "getPartitionGroups");
  for (const label of ["00", "1F", "20", "3F", "40", "C0", "FF", "R0", "zz"]) {
    await expectAnswer(where, s, "parsePartitionLabel", label);
  }
  await expectAnswer(where, s, "getDisassemblySections", {});
  await expectAnswer(where, s, "getCallStack");
  // --- The memory panel: the CPU's 64K (with the registers and partition labels it shows), and
  // --- every 16K bank of the 4 MB (one digest of all 256 answers)
  await expectAnswer(where, s, "getMemoryContents");
  const banks = new Digest();
  for (let bank = 0; bank < 256; bank++) banks.add(await ide(s, "getMemoryContents", bank));
  golden.expect(`${where}: getMemoryContents(<every bank>)`, banks.take());
}

describe("Z88 IDE: the panels show the machine", () => {
  it.each(["OZ50", "OZ40", "OZ30"])(
    "%s after booting and a few keys",
    async (model) => {
      const s = await createZ88Session({ model, rom: "model" });
      const script: Z88Key[][] = [["Index"], ["Down"], ["Enter"], ["Escape"]];
      s.runFrames(1700);
      for (const keys of script) {
        s.keyDown(...keys).runFrames(6);
        s.keyUp(...keys).runFrames(30);
      }
      await expectIdeState(`${model} after booting and a few keys`, s);
    },
    120_000
  );

  it("a stop in the middle of a frame, with a card in command mode", async () => {
    const s = await createZ88Session();
    const source = `
      .org $8000
start:
      ld a,$41
      out ($d3),a          ; SR3: bank $41, slot 1
      ld a,$aa
      ld ($c555),a
      ld a,$55
      ld ($c2aa),a
      ld a,$90
      ld ($c555),a         ; AMD autoselect: the chip answers codes, not its array
      ld ix,$1234
      ld iy,$5678
      exx
      ex af,af'
stop: nop
      jr stop
    `;
    await s.loadCode(source, { entry: "start" });
    await s.plugCard(1, { cardType: "AMDF29F040B", size: 512 });
    s.runTo("stop");
    await expectIdeState("stopped mid-frame, a card in command mode", s);
  });
});

describe("Z88 IDE: the editors reach the machine", () => {
  // --- Stores every register where the test can see it, so an edit that stayed in a mirror (and never
  // --- reached the core) shows up as different memory
  const DUMP = `
      .org $8000
start:
      ld ($a000),sp
      ld sp,$a100
      push af
      push bc
      push de
      push hl
      push ix
      push iy
      exx
      ex af,af'
      push af
      push bc
      push de
      push hl
      ld a,i
      ld ($a002),a
done: jr done
  `;

  const EDITS: [string, number][] = [
    ["AF", 0x1234],
    ["BC", 0x2345],
    ["DE", 0x3456],
    ["HL", 0x4567],
    ["AF'", 0x5678],
    ["BC'", 0x6789],
    ["DE'", 0x789a],
    ["HL'", 0x89ab],
    ["IX", 0x9abc],
    ["IY", 0xabcd],
    ["WZ", 0xbcde],
    ["A", 0x5a],
    ["F", 0xa5],
    ["B", 0x11],
    ["C", 0x22],
    ["D", 0x33],
    ["E", 0x44],
    ["H", 0x55],
    ["L", 0x66],
    ["XH", 0x77],
    ["XL", 0x88],
    ["YH", 0x99],
    ["YL", 0xaa],
    ["I", 0x3e],
    ["R", 0x05],
    ["SP", 0xbf00]
  ];

  it("every register the register editor sets is in the core, and the code that runs sees it", async () => {
    const s = await createZ88Session();
    await s.loadCode(DUMP, { entry: "start" });
    s.runFrames(2);
    for (const [register, value] of EDITS) {
      await ide(s, "setRegisterValue", register, value);
    }
    await ide(s, "setRegisterValue", "PC", s.symbol("start"));
    const regs = await expectAnswer("register edits", s, "getCpuState");
    expect([regs.af, regs.bc, regs.de, regs.hl]).toEqual([0x5aa5, 0x1122, 0x3344, 0x5566]);
    expect([regs.ix, regs.iy, regs.sp, regs.pc]).toEqual([0x7788, 0x99aa, 0xbf00, 0x8000]);
    expect(regs.ir >> 8).toBe(0x3e);

    s.runTo("done");
    await expectIdeState("register edits, after the dump", s);
    // --- The dump itself: SP, then AF, BC, DE, HL, IX, IY and the alternates, top-down from $A100
    expect(s.peekWord(0xa000)).toBe(0xbf00);
    expect(s.peekWord(0xa0fe)).toBe(0x5aa5);
    expect(s.peekWord(0xa0fc)).toBe(0x1122);
    expect(s.peekWord(0xa0f6)).toBe(0x7788);
    expect(s.peekWord(0xa0f4)).toBe(0x99aa);
    expect(s.peekWord(0xa0f2)).toBe(0x5678);
    expect(s.peek(0xa002)).toBe(0x3e);
  });

  it("the memory editor writes 8, 16, 24 and 32 bits in both byte orders, through the paging", async () => {
    const s = await createZ88Session();
    await s.loadCode(`
      .org $8000
spin: jr spin
    `);
    await s.plugCard(1, { cardType: "RAM128", size: 128 });
    s.out(0xd3, 0x41); // SR3: a bank of the slot 1 RAM card
    let address = 0xc010;
    for (const size of [8, 16, 24, 32]) {
      for (const bigEndian of [false, true]) {
        await ide(s, "setMemoryContent", address, 0x89abcdef, size, bigEndian);
        address += 8;
      }
    }
    await ide(s, "setMemoryContent", 0xfffe, 0x11223344, 32, false); // wraps to $0000
    await expectIdeState("memory edits", s);
    expect([...s.peekBytes(0xc010, 4)]).toEqual([0xef, 0x00, 0x00, 0x00]);
    expect([...s.peekBytes(0xc048, 4)]).toEqual([0x89, 0xab, 0xcd, 0xef]);
    expect(s.physPeek(0x10_0000 + 0x4000 + 0x0048)).toBe(0x89);
    expect([s.peek(0xfffe), s.peek(0xffff), s.peek(0x0000), s.peek(0x0001)]).toEqual([
      0x44, 0x33, 0x22, 0x11
    ]);
  });
});
