import type { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  type ICustomDisassembler,
  type IDisassemblyApi
} from "./custom-disassembly";

/*
 * A machine's custom disassembler, gated on the code being in the ROM it describes
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5, §4.7).
 *
 * The 48K custom disassembler reads the bytes after `RST $08` as a report code and after `RST $28`
 * as calculator literals. That is true of the 48K BASIC ROM's code and of nothing else: a program in
 * RAM that uses `RST $28` for its own purposes would have its next instructions listed as `.defb`.
 * So the decoding runs only for instructions in a ROM page that *is* a 48K BASIC ROM (by its bytes,
 * or by its position when Klive does not know them, Q7) — which is also what lets it be registered
 * for the 128K, the +3 and the Scorpion, whose other ROM pages are different programs. The ZX81's is
 * gated the same way on the ZX81 ROM.
 */

/** What a gate knows about the memory being listed. */
export type CustomDisassemblyContext = {
  /** Whether the instruction at an address is in a ROM page the custom disassembler describes. */
  inDescribedRom(address: number): boolean;
};

/** A factory a machine registers as `CT_CUSTOM_DISASSEMBLER`. */
export type CustomDisassemblerFactory = (context?: CustomDisassemblyContext) => ICustomDisassembler;

export class RomGatedCustomDisassembler implements ICustomDisassembler {
  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  constructor(
    private readonly inner: ICustomDisassembler,
    private readonly gate: (address: number) => boolean
  ) {}

  setDisassemblyApi(api: IDisassemblyApi): void {
    this.inner.setDisassemblyApi(api);
  }

  startSectionDisassembly(section: MemorySection): void {
    this.inner.startSectionDisassembly(section);
  }

  /** Asked only while the inner one is decoding data after a gated instruction. */
  beforeInstruction(fetchResult: FetchResult): boolean {
    return this.inner.beforeInstruction(fetchResult);
  }

  afterInstruction(item: DisassemblyItem): void {
    if (this.gate(item.address)) this.inner.afterInstruction(item);
  }
}

/**
 * Wrap a custom disassembler in its ROM gate. Without a context — a caller that knows nothing of
 * the paging — the gate is the ROM area alone, which is what the decoding always assumed.
 */
export function gateOnRom(
  inner: ICustomDisassembler,
  context: CustomDisassemblyContext | undefined,
  romEnd: number
): ICustomDisassembler {
  return new RomGatedCustomDisassembler(
    inner,
    context ? (address) => context.inDescribedRom(address) : (address) => (address & 0xffff) < romEnd
  );
}
