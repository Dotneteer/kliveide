import { describe, expect, it } from "vitest";

import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  buildNextCodeInjectionFlow,
  nextPartitionLabels,
  parseNextPartitionLabel,
  z80nCallInstructionLength,
  ZXNEXT_MAIN_WAITING_LOOP
} from "@emu/machines/zxNext/nextMachineInfo";

/*
 * `nextMachineInfo.ts` is what both ZX Spectrum Next machines tell the IDE and the debugger about
 * themselves: partition names, disassembly sections, the code-injection flow, step-over lengths. The
 * WASM host and the TypeScript machine both delegate to it, so they cannot drift apart; this pins that
 * they do, and the functions' own behaviour.
 */

describe("nextMachineInfo", () => {
  const ts = new ZxNextMachine();
  const wasm = new ZxNextWasmV2Machine();

  it("both machines name, describe and group partitions the same way", () => {
    expect(wasm.getPartitionLabels()).toEqual(ts.getPartitionLabels());
    expect(wasm.getPartitionDescriptions()).toEqual(ts.getPartitionDescriptions());
    expect(wasm.getPartitionGroups()).toEqual(ts.getPartitionGroups());
    for (const label of ["R0", "x1", "dm", "m0", "MF", "0A", "df", "E0", "UN", "Q1", "zz"]) {
      expect(wasm.parsePartitionLabel(label), label).toBe(ts.parsePartitionLabel(label));
    }
  });

  it("both machines report the Next ROM at pages 0-1 to the memory view", () => {
    expect(wasm.getRomFlags()).toEqual(ts.getRomFlags());
    expect(wasm.getRomFlags()).toEqual([true, true, false, false, false, false, false, false]);
  });

  it("every partition label parses back to its partition", () => {
    for (const [partition, label] of Object.entries(nextPartitionLabels())) {
      expect(parseNextPartitionLabel(label), label).toBe(Number(partition));
    }
  });

  it("both machines offer the same disassembly sections", () => {
    for (const ram of [false, true]) {
      for (const screen of [false, true]) {
        expect(wasm.getDisassemblySections({ ram, screen }), `ram=${ram} screen=${screen}`).toEqual(
          ts.getDisassemblySections({ ram, screen })
        );
      }
    }
  });

  it("the code-injection flow boots to the main loop and types .nexload with the file name", () => {
    const flow = buildNextCodeInjectionFlow(false, "Game.nex");
    expect(flow[1]).toMatchObject({ type: "ReachExecPoint", execPoint: ZXNEXT_MAIN_WAITING_LOOP });
    expect(flow.filter((s) => s.type === "QueueKey").length).toBeGreaterThan(".nexload Game.nex".length);
    const withAutoExec = buildNextCodeInjectionFlow(true, "Game.nex");
    expect(withAutoExec.length).toBeGreaterThan(flow.length);
  });

  it("measures CALL-like instructions for step-over, including the Z80N NEXTREG forms", () => {
    const at = (...bytes: number[]) => z80nCallInstructionLength((a) => bytes[a] ?? 0, 0);
    expect(at(0xcd, 0x00, 0x80)).toBe(3); // CALL nn
    expect(at(0xc4)).toBe(3); // CALL NZ,nn
    expect(at(0xdf)).toBe(3); // RST $18 + operand byte
    expect(at(0xff)).toBe(1); // RST $38
    expect(at(0x76)).toBe(1); // HALT
    expect(at(0xed, 0xb0)).toBe(2); // LDIR
    expect(at(0xed, 0x91)).toBe(4); // NEXTREG n,n
    expect(at(0xed, 0x92)).toBe(3); // NEXTREG n,A
    expect(at(0x00)).toBe(0);
  });
});
