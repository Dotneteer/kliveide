import { describe, it, expect } from "vitest";

import { createZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory";
import { createZxSpectrumP3eMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

/*
 * The invariant this whole naming unification exists to establish:
 *
 *   **Every name a machine can show, that machine can parse back.**
 *
 * `getPartitionLabels()` is the single authority for partition names, so a label taken from it and
 * handed to `parsePartitionLabel` must return the index it came from — for every partition, not a
 * sampled few. Written as a property over the full index range because the bug it replaces was
 * exactly a gap in a sampled table: `test/memory/partition-parsing.test.ts` checks `X0` and `DM`
 * but no `M`-label, which is how sixteen unparseable DivMMC RAM names went unnoticed.
 *
 * See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §3.
 */

type LabelledMachine = {
  getPartitionLabels(): Record<number, string>;
  parsePartitionLabel(label: string): number | undefined;
};

const machines: [string, () => LabelledMachine][] = [
  ["ZX Spectrum 128K", () => createZxSpectrum128Machine() as unknown as LabelledMachine],
  ["ZX Spectrum +2/+3E", () => createZxSpectrumP3eMachine() as unknown as LabelledMachine],
  ["ZX Spectrum Next", () => new ZxNextWasmV2Machine() as unknown as LabelledMachine]
];

describe.each(machines)("%s partition labels", (_name, create) => {
  it("parses every label in its own map back to the index it came from", () => {
    const machine = create();
    const labels = machine.getPartitionLabels();

    const entries = Object.entries(labels).map(([index, label]) => [Number(index), label] as const);
    expect(entries.length).toBeGreaterThan(0);

    for (const [index, label] of entries) {
      expect(machine.parsePartitionLabel(label), `${label} -> ${index}`).toBe(index);
    }
  });

  it("parses its labels case-insensitively, as the commands hand them over lowercased", () => {
    // --- `BreakpointCommands` lowercases an address spec before splitting it, so a parser that is
    // --- case-sensitive anywhere makes those partitions unreachable from every `bp-*` command.
    const machine = create();

    for (const [index, label] of Object.entries(machine.getPartitionLabels())) {
      expect(machine.parsePartitionLabel(label.toLowerCase()), label).toBe(Number(index));
      expect(machine.parsePartitionLabel(` ${label.toLowerCase()} `), label).toBe(Number(index));
    }
  });

  it("keeps every label within the two characters the bank column reserves", () => {
    // --- `derivePartitionWidthCh` sizes that column at 2 (or 3 for a hex label shown in decimal)
    // --- and never measures the string, so a longer label silently overflows its box.
    const machine = create();

    for (const label of Object.values(machine.getPartitionLabels())) {
      expect(label.length, label).toBeLessThanOrEqual(2);
    }
  });
});

describe("ZX Spectrum Next partition labels", () => {
  const machine = () => new ZxNextWasmV2Machine();

  it("covers every partition the machine claims to have", () => {
    // --- 4 Next ROMs + 2 alt ROMs + DivMMC ROM + 16 DivMMC RAM pages + 224 banks.
    const labels = machine().getPartitionLabels();
    expect(Object.keys(labels)).toHaveLength(4 + 2 + 1 + 16 + 224);
  });

  it("accepts a lowercase DivMMC RAM partition", () => {
    // --- Regression: `bp-set m0:$8000` reported "Invalid partition". The switch normalized its
    // --- subject but the `M` branch tested the original string, and the command had already
    // --- lowercased it — so all sixteen DivMMC RAM partitions were unreachable.
    const m = machine();
    expect(m.parsePartitionLabel("m0")).toBe(-8);
    expect(m.parsePartitionLabel("mf")).toBe(-23);
    expect(m.parsePartitionLabel("M0")).toBe(-8);
    expect(m.parsePartitionLabel("MF")).toBe(-23);
  });

  it("reads A0 and D0 as RAM banks, not as an alt ROM or a DivMMC page", () => {
    // --- Why the map uses `X0`/`M0` and not the mnemonic `A0`/`D0`: those spellings are already
    // --- taken by the hex bank namespace, so they are ambiguous by construction.
    const m = machine();
    expect(m.parsePartitionLabel("A0")).toBe(0xa0);
    expect(m.parsePartitionLabel("A1")).toBe(0xa1);
    expect(m.parsePartitionLabel("D0")).toBe(0xd0);
    expect(m.parsePartitionLabel("DF")).toBe(0xdf);
  });

  it("rejects a malformed DivMMC RAM label rather than guessing", () => {
    const m = machine();
    expect(m.parsePartitionLabel("M")).toBeUndefined();
    expect(m.parsePartitionLabel("M10")).toBeUndefined();
    expect(m.parsePartitionLabel("MG")).toBeUndefined();
  });

  it("rejects a bank beyond the machine's range", () => {
    const m = machine();
    expect(m.parsePartitionLabel("DF")).toBe(223);
    expect(m.parsePartitionLabel("E0")).toBeUndefined();
    expect(m.parsePartitionLabel("FF")).toBeUndefined();
  });
});

/*
 * The paged-in page labels - `getCurrentPartitionLabels()` and `getPartition()` - need a running
 * memory mapping, so they live with the machine that owns one:
 * `test/wasm/zxNext/wasm-next-partition-labels.test.ts`.
 */

describe("ZX Spectrum Next retired partition names", () => {
  const machine = () => new ZxNextWasmV2Machine();

  it("still parses the alternate ROMs' former names", () => {
    // --- `Q0`/`Q1` named the alternate ROMs before `X0`/`X1`. A script that uses them keeps
    // --- working; nothing on disk stored a partition *name*, so the alias is the whole exposure.
    const m = machine();

    expect(m.parsePartitionLabel("Q0")).toBe(-5);
    expect(m.parsePartitionLabel("Q1")).toBe(-6);
    expect(m.parsePartitionLabel("q0")).toBe(-5);
  });

  it("does not offer the former names back", () => {
    // --- An alias is an input, not a name: the map, the bank column and `bp-list` all say `X0`.
    const labels = Object.values(machine().getPartitionLabels());

    expect(labels).toContain("X0");
    expect(labels).toContain("X1");
    expect(labels).not.toContain("Q0");
    expect(labels).not.toContain("Q1");
  });
});
