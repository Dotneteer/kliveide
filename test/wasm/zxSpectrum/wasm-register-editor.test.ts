import { describe, expect, it } from "vitest";

import type { ResponseMessage } from "@common/messaging/messages-core";

import createAppStore from "@state/store";
import { processMainToEmuMessages } from "@renderer/appEmu/MainToEmuProcessor";
import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom
} from "./wasm-test-helpers";

/*
 * The IDE's register editor and Memory panel on the WASM Spectrum machines. The IDE reaches the
 * emulator only through `MainToEmuProcessor`, so the test drives exactly that:
 *
 * - `setRegisterValue` assigns the machine's register accessors - 16-bit pairs and the 8-bit halves
 *   (`a`, `f`, `xl`, `i`, ...), which `Z80Cpu` implements on its own register views. Each write must
 *   reach the WASM core, or the next instruction runs with the old value and the next sync from the
 *   core overwrites the edit. A program that stores every register to memory proves the core has them.
 * - `getMemoryContents` reads `m.af`, `m.bc`, ... directly, without `getCpuState()`, so after a normal
 *   frame (which refreshes only PC and the counters) a lazily mirrored register would be stale.
 *
 * The +3E adapter already pushed every write; it is the control.
 */

/* Stores SP at $8000, I at $8002, and pushes AF, BC, DE, HL, IX, IY, AF', BC', DE', HL' below $8100 */
const DUMP = [
  0xed, 0x73, 0x00, 0x80, // 0000 ld ($8000),sp
  0x31, 0x00, 0x81, //       0004 ld sp,$8100
  0xf5, //                   0007 push af
  0xc5, //                        push bc
  0xd5, //                        push de
  0xe5, //                        push hl
  0xdd, 0xe5, //                  push ix
  0xfd, 0xe5, //                  push iy
  0xd9, //                        exx
  0x08, //                        ex af,af'
  0xf5, //                        push af
  0xc5, //                        push bc
  0xd5, //                        push de
  0xe5, //                        push hl
  0xed, 0x57, //                  ld a,i
  0x32, 0x02, 0x80, //            ld ($8002),a
  0x18, 0xfe //                   jr $ (spin)
];

/* The edits, in the order the test makes them: the 8-bit halves override parts of the pairs */
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
  ["SP", 0xbf00],
  ["PC", 0x0000]
];

type AnyWasmMachine = {
  executeMachineFrame(): unknown;
  doReadMemory(address: number): number;
  getCpuState(): any;
  wasmV2Runtime?: { exports: Record<string, (...args: number[]) => number> };
};

async function ide(machine: AnyWasmMachine, method: string, ...args: unknown[]): Promise<any> {
  const response = (await processMainToEmuMessages(
    { type: "ApiMethodRequest", method, args } as any,
    createAppStore("emu"),
    undefined,
    {
      machineService: {
        getMachineController: () => ({ machine, state: 0, debugSupport: { breakpoints: [] as unknown[] } })
      }
    } as any
  )) as ResponseMessage & { result?: any; message?: string };
  if (response.type !== "ApiMethodResponse") throw new Error(response.message ?? response.type);
  return response.result;
}

const word = (m: AnyWasmMachine, address: number) => m.doReadMemory(address) | (m.doReadMemory(address + 1) << 8);

const MACHINES: [string, string, () => Promise<AnyWasmMachine>][] = [
  ["ZX Spectrum 48K", "sp48", () => createTestSp48WasmMachine(testRom(DUMP)) as Promise<any>],
  ["ZX Spectrum 128K", "sp128", () => createTestSp128WasmMachine(testRom(DUMP), testRom(DUMP)) as Promise<any>],
  ["ZX Spectrum +3E", "spp3e", () => createTestSpp3eWasmMachine([0, 1, 2, 3].map(() => testRom(DUMP))) as Promise<any>]
];

describe.each(MACHINES)("%s (WASM): the IDE's register editor and Memory panel", (_name, prefix, create) => {
  it("every register the editor sets reaches the core, and the code that runs sees it", async () => {
    const machine = await create();
    // --- A normal frame first: afterwards the TypeScript mirror is only lazily synchronized
    machine.executeMachineFrame();

    for (const [register, value] of EDITS) {
      await ide(machine, "setRegisterValue", register, value);
    }

    // --- The core has every edited value before a single instruction runs
    const w = machine.wasmV2Runtime!.exports;
    const core = (name: string) => w[`${prefix}GetCpu${name}`]();
    expect({
      af: core("Af"),
      bc: core("Bc"),
      de: core("De"),
      hl: core("Hl"),
      af_: core("AfAlt"),
      bc_: core("BcAlt"),
      de_: core("DeAlt"),
      hl_: core("HlAlt"),
      ix: core("Ix"),
      iy: core("Iy"),
      ir: core("Ir"),
      wz: core("Wz"),
      sp: core("Sp"),
      pc: core("Pc")
    }).toEqual({
      af: 0x5aa5,
      bc: 0x1122,
      de: 0x3344,
      hl: 0x5566,
      af_: 0x5678,
      bc_: 0x6789,
      de_: 0x789a,
      hl_: 0x89ab,
      ix: 0x7788,
      iy: 0x99aa,
      ir: 0x3e05,
      wz: 0xbcde,
      sp: 0xbf00,
      pc: 0x0000
    });

    // --- And the program that runs stores them
    machine.executeMachineFrame();
    expect(word(machine, 0x8000), "SP").toBe(0xbf00);
    expect(machine.doReadMemory(0x8002), "I").toBe(0x3e);
    expect(
      [0x80fe, 0x80fc, 0x80fa, 0x80f8, 0x80f6, 0x80f4, 0x80f2, 0x80f0, 0x80ee, 0x80ec].map((a) => word(machine, a))
    ).toEqual([0x5aa5, 0x1122, 0x3344, 0x5566, 0x7788, 0x99aa, 0x5678, 0x6789, 0x789a, 0x89ab]);
  });

  it("the Memory panel's registers are the core's after a normal frame", async () => {
    const machine = await create();
    await ide(machine, "setRegisterValue", "PC", 0x0000);
    machine.executeMachineFrame();

    // --- The program exchanged the register sets (EXX, EX AF,AF') and moved SP; the core knows
    const w = machine.wasmV2Runtime!.exports;
    const contents = await ide(machine, "getMemoryContents");
    expect({
      af: contents.af,
      bc: contents.bc,
      de: contents.de,
      hl: contents.hl,
      af_: contents.af_,
      bc_: contents.bc_,
      sp: contents.sp,
      pc: contents.pc
    }).toEqual({
      af: w[`${prefix}GetCpuAf`](),
      bc: w[`${prefix}GetCpuBc`](),
      de: w[`${prefix}GetCpuDe`](),
      hl: w[`${prefix}GetCpuHl`](),
      af_: w[`${prefix}GetCpuAfAlt`](),
      bc_: w[`${prefix}GetCpuBcAlt`](),
      sp: w[`${prefix}GetCpuSp`](),
      pc: w[`${prefix}GetCpuPc`]()
    });
  });
});
