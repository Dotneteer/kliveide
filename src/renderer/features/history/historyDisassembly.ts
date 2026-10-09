import { MemorySectionType } from "@abstractions/MemorySection";
import { HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/*
 * Disassembles history records one instruction at a time, from the bytes the record captured - not
 * from today's memory, so self-modifying code reads as it ran (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md`
 * D5, T12). The disassembler sees the record's four bytes at offset 0 and prints them at the record's
 * PC (`setAddressOffset`). Results are cached by (PC, bytes): a loop's instructions repeat across
 * thousands of rows, so the cache turns a full-ring filter into a few hundred disassemblies.
 */

export type HistoryInstruction = { text: string; length: number };

export type HistoryLabelLookup = (address: number) => string | undefined;

export class HistoryDisassemblyCache {
  private readonly cache = new Map<string, HistoryInstruction>();

  /**
   * @param z80n Whether the Z80N extended instructions are decoded (the Next)
   * @param labelOf The name of an address, for operands: the shared resolver's
   * (`annotations/symbolResolver.ts`), so build symbols, annotations and ROM labels all name here
   */
  constructor(
    private readonly z80n: boolean,
    private readonly labelOf?: HistoryLabelLookup
  ) {}

  /** The cached instruction of a record, or undefined before `disassemble` ran for it */
  peek(record: HistoryRecord): HistoryInstruction | undefined {
    return this.cache.get(this.key(record));
  }

  /** Disassembles a record's instruction (an event record has none) */
  async disassemble(record: HistoryRecord): Promise<HistoryInstruction | undefined> {
    if (record.kind !== HistoryKind.Instruction) return undefined;
    const key = this.key(record);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const disassembler = new Z80Disassembler(
      [new MemorySection(0, 3, MemorySectionType.Disassemble)],
      Uint8Array.from(record.bytes),
      undefined,
      {
        // --- "$1EB7", not a generated "L1EB7": only the compilation's labels are names here
        noLabelPrefix: true,
        allowExtendedSet: this.z80n,
        operandLabelResolver: this.labelOf ? (operand) => this.labelOf!(operand.operandValue) : undefined
      }
    );
    disassembler.setAddressOffset(record.regs.pc);
    const output = await disassembler.disassemble(0, 0);
    const item = output?.outputItems?.[0];
    const result: HistoryInstruction = {
      text: item?.instruction ?? "???",
      length: Math.max(1, Math.min(4, item?.opCodes?.length ?? 4))
    };
    this.cache.set(key, result);
    return result;
  }

  private key(record: HistoryRecord): string {
    const b = record.bytes;
    return `${record.regs.pc}:${b[0]}:${b[1]}:${b[2]}:${b[3]}`;
  }
}
