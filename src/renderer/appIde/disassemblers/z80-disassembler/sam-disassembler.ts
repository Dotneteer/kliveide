import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4, toSbyte } from "../utils";
import { CUSTOM_Z80_DISASSEMBLY_TOOL, ICustomDisassembler, IDisassemblyApi } from "./custom-disassembly";

/*
 * The SAM Coupé's custom disassembler (`dev/plans/SAM_COUPE_PLAN.md` §11). `RST 8` is the ROM's error and
 * DOS-hook call: the byte after it is an error code (below 128) or a DOS hook (128 and up), and execution
 * goes on after that byte when a hook returns (the machine's `getCallInstructionLength` gives 2 for it, so
 * Step Over agrees). Programs call the DOS this way too, so the decoding is not gated on an address.
 *
 * The hook names are MGT's, from the SAM Coupé Technical Manual's SAMDOS list and the MasterDOS additions
 * the Unofficial Technical Manual gives (as the research pack records them, STORAGE_FIRMWARE_SOFTWARE.md
 * §3.3); where the two manuals disagree, the Technical Manual's numbers (which match their hex) are used.
 *
 * Two more restarts take inline data, read from ROM 3.0's bytes
 * (`dev/ai/rom-annotations/sam-authoring-guide.md`, "The restarts' inline data"):
 *
 * - `RST 28h` runs the calculator over the bytes after it (ROM1's $C7B7 reads them through IX), one
 *   operation byte each, until an operation that ends the stream ($33-$38); a few take operands. Any
 *   caller reaches it the same way, so it is decoded everywhere.
 * - `RST 30h` from below $4000 (ROM0's $01CF tests the return address's high byte) is followed by a word:
 *   with bit 15 set, a call to that ROM1 address; with bit 15 clear, a jump to the address with bit 15 set.
 *   From $4000 up it goes through RST30V with nothing after it.
 * - `CALL $0201` and `CALL $01FA` are followed by a word too: ROM0's $0201 calls that address with ROM1
 *   paged out and returns past the word; $01FA jumps there (it drops the return address). ROM1 reaches
 *   ROM0's code this way. Only the unconditional CALL is decoded: a not-taken `CALL Z` would run the word.
 * - `CALL $0D47` is followed by an error code: ROM0's statement search jumps to $0008 with the return
 *   address on the stack when it finds nothing (so RST $08's body reads the byte), and drops it when it does.
 */

const RST_08 = 0xcf;
const RST_28 = 0xef;
const RST_30 = 0xf7;
const CALL_NN = 0xcd;
/** ROM0's routines that take the address to go to from the word after the CALL */
const ROM0_CALL_WITH_WORD = 0x0201;
const ROM0_JUMP_WITH_WORD = 0x01fa;
/** ROM0's statement search, which takes the error code for "not found" from the byte after the CALL */
const ROM0_FIND_STATEMENT = 0x0d47;

/** What follows a calculator operation byte, whether it ends the stream, and what the code does */
export type SamCalcShape = {
  operands: "none" | "offset" | "byte" | "word" | "number" | "counted";
  ends?: boolean;
  text: string;
};

/**
 * A calculator operation, as far as its handler was read: ROM1's table at $C6FB serves $00-$5D, and
 * $60-$FF are decoded in code at $C7D2. The descriptions are Klive's; other codes are listed by number.
 */
export function samCalcShape(op: number): SamCalcShape {
  if (op === 0x1e || op === 0x1f) return { operands: "offset", text: "conditional jump" };
  if (op === 0x20) return { operands: "offset", text: "jump" };
  if (op === 0x21) return { operands: "byte", text: "set the loop counter" };
  if (op === 0x22) return { operands: "offset", text: "decrement the loop counter, jump if not zero" };
  if (op === 0x26) return { operands: "byte", text: "byte operand" };
  if (op === 0x27) return { operands: "number", text: "stack a 5-byte number" };
  if (op === 0x28) return { operands: "counted", text: "stack bytes" };
  if (op === 0x29 || op === 0x2a) return { operands: "word", text: "word operand" };
  if (op === 0x33) return { operands: "none", ends: true, text: "end of calculation" };
  if (op >= 0x34 && op <= 0x38) {
    return { operands: "none", ends: true, text: "end of calculation, return from the caller" };
  }
  if (op >= 0xe0) return { operands: "none", text: `stack constant ${op - 0xe0}` };
  if (op >= 0xd8) return { operands: "none", text: `recall memory ${op - 0xd8}` };
  if (op >= 0xd0) return { operands: "none", text: `store memory ${op - 0xd0}` };
  if (op >= 0xc8) return { operands: "none", text: `store memory ${op - 0xc8} and drop` };
  return { operands: "none", text: "operation" };
}

/**
 * Whether a byte cannot be a calculator operation: $60-$C7 raise an error (ROM1 $C7EE), and the table at
 * $C6FB has entries for $00-$5D only (its next words are the code at $C7B7). A stream that meets one is
 * data decoded as code, so the decoder leaves the stream there instead of running on through the page.
 */
export function samCalcOpInvalid(op: number): boolean {
  return op >= 0x5e && op < 0xc8;
}

/** The DOS hooks, by the code that follows `RST 8` */
export const SAM_DOS_HOOKS: ReadonlyMap<number, string> = new Map<number, string>([
  [128, "INIT"],
  [129, "HGTHD"],
  [130, "HLOAD"],
  [131, "HVERY"],
  [132, "HSAVE"],
  [133, "HSKSF"],
  [136, "HAUTO"],
  [137, "HSKTD"],
  [138, "HFMTK"],
  [139, "HVAR"],
  [140, "HEOF"],
  [141, "HPTR"],
  [142, "HPATH"],
  [143, "HLDPG"],
  [144, "HVEPG"],
  [145, "HSDIR"],
  [146, "HOFSM"],
  [147, "HOFLE"],
  [148, "SBYT"],
  [149, "HWSAD"],
  [150, "HSVBK"],
  [151, "HDBOP"],
  [152, "CFSM"],
  [153, "HORDER"],
  [158, "HGFLE"],
  [159, "LBYT"],
  [160, "HRSAD"],
  [161, "HLDBK"],
  [162, "HMRSAD"],
  [163, "HMWSAD"],
  [164, "REST"],
  [165, "PCAT"],
  [166, "HERAZ"],
  [168, "HCHRD"]
]);

/** The comment on the byte after `RST 8` */
export function samRst8Comment(code: number): string {
  if (code < 128) return `(error ${code})`;
  const hook = SAM_DOS_HOOKS.get(code);
  return hook ? `(DOS hook ${code}: ${hook})` : `(DOS hook ${code})`;
}

/** Options: where a `RST 30h` is followed by a word (default: below $4000, ROM0's addresses) */
export type SamDisassemblerOptions = {
  rst30HasWord?: (address: number) => boolean;
};

export class SamCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _pending: "rst8" | "calc" | "rst30" | "rom0call" | "rom0jump" | undefined;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  constructor(private readonly _options: SamDisassemblerOptions = {}) {}

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._pending = undefined;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    const pending = this._pending;
    if (!pending) return false;
    const address = fetchResult.offset;
    if (pending === "rst8") {
      this._pending = undefined;
      const code = this._api.fetch().opcode;
      this.emit(address, [code], samRst8Comment(code));
    } else if (pending === "rst30") {
      this._pending = undefined;
      const low = this._api.fetch().opcode;
      const word = low | (this._api.fetch().opcode << 8);
      const target = word | 0x8000;
      this._api.createLabel(target);
      this._api.addDisassemblyItem({
        address,
        opCodes: [low, word >> 8],
        instruction: `.defw ${this.hex4(word)}`,
        hardComment: `(${word & 0x8000 ? "call" : "jump to"} ROM1 ${this.hex4(target)})`
      });
    } else if (pending === "rom0call" || pending === "rom0jump") {
      this._pending = undefined;
      const low = this._api.fetch().opcode;
      const word = low | (this._api.fetch().opcode << 8);
      this._api.createLabel(word);
      this._api.addDisassemblyItem({
        address,
        opCodes: [low, word >> 8],
        instruction: `.defw ${this.hex4(word)}`,
        hardComment: `(${pending === "rom0call" ? "call" : "jump to"} ${this.hex4(word)}, ROM1 paged out)`
      });
    } else {
      if (samCalcOpInvalid(this._api.peek().opcode)) {
        this._pending = undefined;
        return false;
      }
      this.calculatorEntry(address);
    }
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.length === 3 && item.opCodes[0] === CALL_NN) {
      const target = item.opCodes[1] | (item.opCodes[2] << 8);
      if (target === ROM0_CALL_WITH_WORD) this._pending = "rom0call";
      if (target === ROM0_JUMP_WITH_WORD) this._pending = "rom0jump";
      if (target === ROM0_FIND_STATEMENT) this._pending = "rst8";
      return;
    }
    if (item.opCodes?.length !== 1) return;
    const op = item.opCodes[0];
    if (op === RST_08) {
      this._pending = "rst8";
      item.hardComment = "(error or DOS hook)";
    } else if (op === RST_28) {
      this._pending = "calc";
      item.hardComment = "(calculator)";
    } else if (op === RST_30 && (this._options.rst30HasWord ?? ((address) => address < 0x4000))(item.address)) {
      this._pending = "rst30";
      item.hardComment = "(ROM1 call)";
    }
  }

  /** One calculator operation with its operands; an operation that ends the stream leaves calculator mode */
  private calculatorEntry(address: number): void {
    const op = this._api.fetch().opcode;
    const shape = samCalcShape(op);
    const bytes = [op];
    let text = `calc $${intToX2(op)}: ${shape.text}`;
    switch (shape.operands) {
      case "offset": {
        const offset = this._api.fetch();
        bytes.push(offset.opcode);
        // --- The offset counts from its own byte (ROM1 $C86F: ADD IX,BC with IX on the offset); a
        // --- fetch reports the offset after the byte it read
        const target = (offset.offset - 1 + toSbyte(offset.opcode)) & 0xffff;
        this._api.createLabel(target);
        text += ` to ${this.hex4(target)}`;
        break;
      }
      case "byte":
        bytes.push(this._api.fetch().opcode);
        break;
      case "word":
        bytes.push(this._api.fetch().opcode, this._api.fetch().opcode);
        break;
      case "number":
        for (let i = 0; i < 5; i++) bytes.push(this._api.fetch().opcode);
        break;
      case "counted": {
        // --- The operation and its count make one row; the bytes it stacks follow as one row per
        // --- 5-byte number. A single row of them all (ROM1 has three of 61 bytes) widened the listing's
        // --- instruction column to over 300 characters and pushed every comment off the screen
        const count = this._api.fetch().opcode;
        bytes.push(count);
        this.emit(address, bytes, `(${text} ${count})`);
        for (let start = 0; start < count; start += 5) {
          const row: number[] = [];
          for (let i = start; i < Math.min(count, start + 5); i++) row.push(this._api.fetch().opcode);
          this.emit(address + 2 + start, row, `(calc $28: bytes ${start + 1}-${start + row.length} of ${count})`);
        }
        return;
      }
    }
    if (shape.ends) this._pending = undefined;
    this.emit(address, bytes, `(${text})`);
  }

  private hex4(value: number): string {
    return this._api.decimalMode ? value.toString(10) : `$${intToX4(value)}`;
  }

  private emit(address: number, bytes: number[], comment: string): void {
    const list = bytes.map((b) => (this._api.decimalMode ? b.toString(10) : `$${intToX2(b)}`)).join(", ");
    this._api.addDisassemblyItem({ address, opCodes: bytes, instruction: `.defb ${list}`, hardComment: comment });
  }
}
