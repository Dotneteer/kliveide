import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  ICustomDisassembler,
  IDisassemblyApi
} from "./custom-disassembly";
import {
  DisassemblyItem,
  FetchResult,
  intToX2,
  intToX4,
  MemorySection,
} from "./disassembly-helper";

/**
 * Custom disassembler for the ZX Spectrum 48 model
 */
export class ZxSpectrumNextCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst182028Mode = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api API to use for disassembly
   * @param machine The virtual machine instance
   */
  setDisassemblyApi (api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param section
   */
  startSectionDisassembly (_section: MemorySection): void {
    // --- No ZX Spectrum 48 specific code to disassemle
    this._inRst182028Mode = false;
  }

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction (fetchResult: FetchResult): boolean {
    // --- Handle RST $18 word address
    if (this._inRst182028Mode) {
      const lsb = this._api.fetch().opcode;
      const msb = this._api.fetch().opcode;
      const routine = (msb << 8) | lsb;
      this._api.addDisassemblyItem({
        partition: fetchResult.partitionLabel,
        address: fetchResult.offset,
        opCodes: `${intToX2(lsb)} ${intToX2(msb)}`,
        instruction: `.defw $${intToX4(routine)}`,
        hardComment: `(invoke: $${intToX4(routine)})`
      });
      this._inRst182028Mode = false;
      return true;
    }

    // --- No custom disassembly
    return false;
  }

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param item Disassembled item
   */
  afterInstruction (item: DisassemblyItem): void {
    if (!item.opCodes) {  
      return;
    }

    let rom = 0;
    switch (item.opCodes.trim()) {
      case "DF":
        rom = 1;
        break;
      case "E7":
        rom = 2;
        break;
      case "EF":
        rom = 3;
        break;
      default:
        return;
    }

    this._inRst182028Mode = true;
    item.hardComment = `(Invoke ROM ${rom} subroutine)`;
  }
}