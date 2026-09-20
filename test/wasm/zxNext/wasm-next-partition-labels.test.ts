import { describe, expect, it } from "vitest";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/*
 * Partition labels and indexes are IDE-facing (breakpoints, the Memory view, the memory-mapping
 * panel), so they are pinned here rather than covered by the hardware harness. Pinned values are the
 * ones both cores agreed on at tag `pre-zxnext-ts-removal-2026-09-19`.
 *
 * Partition vocabulary: 0..223 are 8K RAM pages ("00".."DF"); -1..-4 ROM 0-3 ("R0".."R3"); -5/-6
 * Alt ROM 0/1 ("X0"/"X1"); -7 the DivMMC ROM ("DM"); -8..-23 DivMMC RAM pages 0-15 ("M0".."MF").
 */

type ExpectedLabels = {
  labels: string[];
  partitions: number[];
  /** getPartition at $0000, $2000, $4000, $8000, $C000, $E000 */
  pagePartitions: number[];
};

describe("ZX Spectrum Next WASM partition labels", () => {
  it("labels the reset, MMU RAM, system-region, alternate ROM, and all-RAM mappings", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- Reset MMU layout $FF,$FF,$0A,$0B,$04,$05,$00,$01 (catalogue MEM-001)
    expectLabels(wasm, {
      labels: ["R0", "R0", "0A", "0B", "04", "05", "00", "01"],
      partitions: [0xff, 0xff, 0x0a, 0x0b, 0x04, 0x05, 0x00, 0x01],
      pagePartitions: [-1, -1, 0x0a, 0x04, 0x00, 0x01]
    });

    // --- RAM pages 4/5 in slots 0/1; page $E0 (past the last RAM page) in slot 2 shows as ROM 0
    writeNextReg(wasm, 0x50, 0x04);
    writeNextReg(wasm, 0x51, 0x05);
    writeNextReg(wasm, 0x52, 0xe0);
    expectLabels(wasm, {
      labels: ["04", "05", "R0", "0B", "04", "05", "00", "01"],
      partitions: [0x04, 0x05, 0xff, 0x0b, 0x04, 0x05, 0x00, 0x01],
      pagePartitions: [0x04, 0x05, -1, 0x04, 0x00, 0x01]
    });

    // --- $8C bit 7 enables the Alt ROM: ROM slots 0/1 read Alt ROM 0 ("X0"); slot 2 keeps "R0"
    writeNextReg(wasm, 0x8c, 0x80);
    writeNextReg(wasm, 0x50, 0xff);
    writeNextReg(wasm, 0x51, 0xff);
    expectLabels(wasm, {
      labels: ["X0", "X0", "R0", "0B", "04", "05", "00", "01"],
      partitions: [0xff, 0xff, 0xff, 0x0b, 0x04, 0x05, 0x00, 0x01],
      pagePartitions: [-5, -5, -1, 0x04, 0x00, 0x01]
    });

    // --- $8E = $07: +3 special mode, layout 11 = 16K banks 4-7-6-3 (catalogue MEM-010)
    writeNextReg(wasm, 0x8e, 0x07);
    expectLabels(wasm, {
      labels: ["08", "09", "0E", "0F", "0C", "0D", "06", "07"],
      partitions: [0x08, 0x09, 0x0e, 0x0f, 0x0c, 0x0d, 0x06, 0x07],
      pagePartitions: [0x08, 0x09, 0x0e, 0x0c, 0x06, 0x07]
    });
  });

  /*
   * A positive partition index is the **8K page** the MMU names.
   *
   * The two sides of the system used to disagree about this: `getPartitionForPage` halved the MMU
   * value to a 16K bank, while `getMemoryPartition(index)` read an 8K slice at
   * `OFFS_NEXT_RAM + 0x2000 * index`. So `bp-set 0A:$C000` and selecting bank `0A` in the Memory
   * view named different memory. Four things already said 8K — the 224-entry label map,
   * `MF_BANK: 224`, `getMemoryPartition`, and the docs — so the resolver was the outlier.
   * See `.plans/NEX_DEBUGGING_PLAN.md` §4.1 (Q9).
   */
  it("reports a positive partition as the 8K page the MMU names", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- Distinct 8K banks, all below the 224 threshold that diverts to the ROM decode chain.
    // --- Pages 4 and 5 are deliberately the two halves of one 16K bank (2), and pages 0/1 and 6/7
    // --- likewise, so a resolver that answered in 16K banks would collapse each pair.
    const banks = [0x10, 0x11, 0x22, 0x23, 0x04, 0x05, 0x36, 0x37];

    banks.forEach((bank, page) => writeNextReg(wasm, 0x50 + page, bank));

    banks.forEach((bank, page) => {
      expect(wasm.getPartition(page * 0x2000), `page ${page}`).toBe(bank);
    });
    expect(wasm.getCurrentPartitions()).toEqual(banks);
  });

  it("gives the two 8K halves of one 16K bank different partitions", async () => {
    // --- This is the property bank-relative breakpoints rest on: an offset in a bank's low half
    // --- must not match a page holding its high half. Under the old 16K reading both halves
    // --- reported the same partition and the distinction was impossible.
    const wasm = await createTestZxNextWasmMachine();

    writeNextReg(wasm, 0x54, 0x04); // --- 16K bank 2, low half, at $8000
    writeNextReg(wasm, 0x55, 0x05); // --- 16K bank 2, high half, at $A000

    expect(wasm.getPartition(0x8000)).toBe(0x04);
    expect(wasm.getPartition(0xa000)).toBe(0x05);
    expect(wasm.getPartition(0x8000)).not.toBe(wasm.getPartition(0xa000));
  });

  /*
   * Moved here from `test/memory/partition-label-round-trip.test.ts` with the TypeScript Next's
   * removal: these are properties of the *paged-in* labels, which need a live memory mapping.
   *
   * The bug they replace: the disassembly bank column showed `A0` for the alternate ROM - a
   * spelling `parsePartitionLabel` rejects, and one that is anyway ambiguous with RAM bank $A0.
   */
  it("names every paged-in page with a label it parses back, inside the 2ch column budget", async () => {
    const wasm = await createTestZxNextWasmMachine();

    for (const pageAltRom of [false, true]) {
      // --- $8C bit 7 pages the Alt ROM in, the state that used to surface the `A0`/`A1` names.
      if (pageAltRom) writeNextReg(wasm, 0x8c, 0x80);
      const where = pageAltRom ? "with the alternate ROM paged in" : "after reset";
      const labels = wasm.getCurrentPartitionLabels();

      for (const label of labels) {
        // --- `UN` is the unpaged marker, not a partition name.
        expect(label.length, `${label} ${where}`).toBeLessThanOrEqual(2);
        if (label === "UN") continue;
        expect(wasm.parsePartitionLabel(label), `${label} ${where}`).toBeDefined();
      }

      // --- `getPartition` feeds `shouldStopAt`, so a disagreement with the shown label is a
      // --- partitioned breakpoint matching the wrong partition.
      for (let page = 0; page < 8; page++) {
        const fromLabel = labels[page] === "UN" ? undefined : wasm.parsePartitionLabel(labels[page]);
        expect(wasm.getPartition(page * 0x2000), `page ${page} (${labels[page]}) ${where}`).toBe(
          fromLabel
        );
      }
    }
  });

  it("parses partition labels and lists the full label map", async () => {
    const wasm = await createTestZxNextWasmMachine();

    // --- "UN" and "Q0"/"Q1" are not Next labels: "UN" gives undefined; the "Q" aliases are pinned
    // --- (they resolve to the Alt ROM partitions).
    const expected: Array<[string, number | undefined]> = [
      ["UN", undefined],
      ["R0", -1],
      ["R3", -4],
      ["X0", -5],
      ["X1", -6],
      ["Q0", -5],
      ["Q1", -6],
      ["DM", -7],
      ["M0", -8],
      ["MF", -23],
      ["00", 0],
      ["DF", 223]
    ];
    for (const [label, partition] of expected) {
      expect(wasm.parsePartitionLabel(label), label).toBe(partition);
    }

    const map = wasm.getPartitionLabels();
    const expectedMap: Record<number, string> = {};
    for (let page = 0; page < 224; page++) {
      expectedMap[page] = page.toString(16).toUpperCase().padStart(2, "0");
    }
    for (let rom = 0; rom < 4; rom++) expectedMap[-1 - rom] = `R${rom}`;
    expectedMap[-5] = "X0";
    expectedMap[-6] = "X1";
    expectedMap[-7] = "DM";
    for (let page = 0; page < 16; page++) expectedMap[-8 - page] = `M${page.toString(16).toUpperCase()}`;
    expect(map).toEqual(expectedMap);
  });
});

function expectLabels(wasm: ZxNextWasmV2Machine, expected: ExpectedLabels): void {
  expect(wasm.getCurrentPartitionLabels()).toEqual(expected.labels);
  expect(wasm.getCurrentPartitions()).toEqual(expected.partitions);
  const pagePartitions = [0x0000, 0x2000, 0x4000, 0x8000, 0xc000, 0xe000].map((address) =>
    wasm.getPartition(address)
  );
  expect(pagePartitions).toEqual(expected.pagePartitions);
}

function writeNextReg(machine: ZxNextWasmV2Machine, reg: number, value: number): void {
  machine.doWritePort(0x243b, reg);
  machine.doWritePort(0x253b, value);
}
