import type { BinarySegment } from "@abstractions/CompilerInfo";

/*
 * Writing a compilation's segments into a machine's memory, banked segments included
 * (`.plans/Z80_UNIT_TESTS_PLAN.md` T5). A segment with a `bank` goes into that bank whatever is
 * paged in: on the 128K and the +2A/+3 a bank is a 16K partition; on the Next, `.bank n` is the
 * 16K bank n, which is the two 8K pages 2n and 2n+1. Writes go straight to the emulated memory:
 * loading is not something the emulated CPU does, so it takes no contention and no machine time.
 *
 * A banked byte goes through the machine's `writeMemoryPartition` when it has one: the 128K and
 * +2A/+3 cores keep a flat copy of the paged-in memory (what `get64KFlatMemory` and the IDE's
 * memory views read) that a write into the bank's own array would leave stale.
 */

/** What the writer needs of a machine */
export type SegmentTarget = {
  doWriteMemory(address: number, value: number): void;
  getMemoryPartition(index: number): Uint8Array;
  writeMemoryPartition?(index: number, offset: number, value: number): void;
};

/**
 * Writes one byte of a partition whatever is paged in, keeping the core's copy of the paged-in
 * memory in step when the machine has one
 */
export function writePartitionByte(machine: SegmentTarget, index: number, offset: number, value: number): void {
  if (machine.writeMemoryPartition) {
    machine.writeMemoryPartition(index, offset, value & 0xff);
    return;
  }
  const memory = machine.getMemoryPartition(index);
  if (offset >= 0 && offset < memory.length) memory[offset] = value & 0xff;
}

/**
 * Writes one segment
 * @param machine The machine
 * @param segment The segment
 * @param eightKPages The machine's partitions are 8K pages (the Next)
 */
export function writeCodeSegment(
  machine: SegmentTarget,
  segment: Pick<BinarySegment, "bank" | "bankOffset" | "startAddress" | "emittedCode">,
  eightKPages: boolean
): void {
  const code = segment.emittedCode;
  if (segment.bank === undefined) {
    for (let i = 0; i < code.length; i++) {
      machine.doWriteMemory((segment.startAddress + i) & 0xffff, code[i] & 0xff);
    }
    return;
  }
  const base = segment.bankOffset ?? 0;
  if (!eightKPages) {
    for (let i = 0; i < code.length; i++) writePartitionByte(machine, segment.bank, base + i, code[i]);
    return;
  }
  // --- The Next: a bank is two 8K pages, and a segment may cross into the second (or further)
  for (let i = 0; i < code.length; i++) {
    const offset = base + i;
    writePartitionByte(machine, segment.bank * 2 + (offset >> 13), offset & 0x1fff, code[i]);
  }
}

/** Writes every segment that holds code */
export function writeCodeSegments(
  machine: SegmentTarget,
  segments: Pick<BinarySegment, "bank" | "bankOffset" | "startAddress" | "emittedCode">[],
  eightKPages: boolean
): void {
  for (const segment of segments) {
    if (segment.emittedCode?.length) writeCodeSegment(machine, segment, eightKPages);
  }
}
