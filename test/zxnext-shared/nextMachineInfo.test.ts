import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import {
  buildNextCodeInjectionFlow,
  nextPartitionLabels,
  parseNextPartitionLabel,
  z80nCallInstructionLength,
  ZXNEXT_MAIN_WAITING_LOOP
} from "@emu/machines/zxNext/nextMachineInfo";

/*
 * `nextMachineInfo.ts` is what the ZX Spectrum Next machine tells the IDE and the debugger about
 * itself: partition names, disassembly sections, the code-injection flow, step-over lengths. It was
 * extracted so the WASM host and the TypeScript machine could not drift apart; the TypeScript
 * machine is gone, and the module stays as the machine's own description, pinned here.
 */

describe("nextMachineInfo", () => {
  const wasm = new ZxNextWasmV2Machine();

  it("names, describes and groups the same set of partitions", () => {
    // --- 4 Next ROMs + 2 alt ROMs + DivMMC ROM + 16 DivMMC RAM pages + 224 banks. A partition the
    // --- machine names but does not describe or group leaves a blank cell in the bank chooser.
    const labels = wasm.getPartitionLabels();
    expect(Object.keys(labels)).toHaveLength(4 + 2 + 1 + 16 + 224);
    expect(Object.keys(wasm.getPartitionDescriptions()).sort()).toEqual(Object.keys(labels).sort());
    expect(Object.keys(wasm.getPartitionGroups()).sort()).toEqual(Object.keys(labels).sort());
    const parsed = ["R0", "x1", "dm", "m0", "MF", "0A", "df", "E0", "UN", "Q1", "zz"].map((l) =>
      wasm.parsePartitionLabel(l)
    );
    expect(parsed).toEqual([-1, -6, -7, -8, -23, 0x0a, 0xdf, undefined, undefined, -6, undefined]);
  });

  it("reports the Next ROM at pages 0-1 to the memory view", () => {
    expect(wasm.getRomFlags()).toEqual([true, true, false, false, false, false, false, false]);
  });

  it("every partition label parses back to its partition", () => {
    for (const [partition, label] of Object.entries(nextPartitionLabels())) {
      expect(parseNextPartitionLabel(label), label).toBe(Number(partition));
    }
  });

  it("offers a disassembly section for every combination of the RAM and screen options", () => {
    for (const ram of [false, true]) {
      for (const screen of [false, true]) {
        const sections = wasm.getDisassemblySections({ ram, screen });
        expect(sections.length, `ram=${ram} screen=${screen}`).toBeGreaterThan(0);
        for (const section of sections) {
          expect(section.startAddress, `ram=${ram} screen=${screen}`).toBeLessThanOrEqual(
            section.endAddress
          );
        }
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
