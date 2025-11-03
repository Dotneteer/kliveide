import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2, intToX4 } from "../utils";
import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  ICustomDisassembler,
  IDisassemblyApi
} from "./custom-disassembly";

/**
 * Custom disassembler for the ZX Spectrum 48 model
 */
export class ZxSpectrumNextCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _rstWith2ByteVector = false;
  private _rstWith3ByteVector = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api API to use for disassembly
   * @param machine The virtual machine instance
   */
  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param section
   */
  startSectionDisassembly(_section: MemorySection): void {
    // --- No ZX Spectrum 48 specific code to disassemle
    this._rstWith2ByteVector = false;
    this._rstWith3ByteVector = false;
  }

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(fetchResult: FetchResult): boolean {
    if (this._rstWith2ByteVector) {
      const lsb = this._api.fetch().opcode;
      const msb = this._api.fetch().opcode;
      const routine = (msb << 8) | lsb;
      const codeValue = this._api.decimalMode ? routine.toString(10) : `$${intToX4(routine)}`;
      this._api.addDisassemblyItem({
        partition: fetchResult.partitionLabel,
        address: fetchResult.offset,
        opCodes: [lsb, msb],
        instruction: `.defw ${codeValue}`,
        hardComment: `(invoke: ${codeValue})`
      });
      this._rstWith2ByteVector = false;
      return true;
    }

    if (this._rstWith3ByteVector) {
      const cmd = this._api.fetch().opcode;
      const cmdValue = this._api.decimalMode ? cmd.toString(10) : `$${intToX2(cmd)}`;
      this._api.addDisassemblyItem({
        partition: fetchResult.partitionLabel,
        address: fetchResult.offset,
        opCodes: [cmd],
        instruction: `.defb ${cmdValue}`,
        hardComment: `(command: ${cmdValue})`
      });
      const lsb = this._api.fetch().opcode;
      const msb = this._api.fetch().opcode;
      const routine = (msb << 8) | lsb;
      const codeValue = this._api.decimalMode ? routine.toString(10) : `$${intToX4(routine)}`;
      this._api.addDisassemblyItem({
        partition: fetchResult.partitionLabel,
        address: fetchResult.offset,
        opCodes: [lsb, msb],
        instruction: `.defw ${codeValue}`,
        hardComment: `(invoke: ${codeValue})`
      });
      this._rstWith3ByteVector = false;
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
  afterInstruction(item: DisassemblyItem): void {
    if (!item.opCodes) {
      return;
    }

    const currentRom = this._api.getRomPage();
    let rst = -1;
    switch (item.opCodes[0]) {
      case 0xcf:
        rst = 0x08;
        break;
      case 0xd7:
        rst = 0x10;
        break;
      case 0xdf:
        rst = 0x18;
        break;
      case 0xe7:
        rst = 0x20;
        break;
      case 0xef:
        rst = 0x28;
        break;
      default:
        return;
    }

    let rom = 0;
    switch (currentRom) {
      // ROM 0 supports RST $18, $20, $28 with 2-byte vectors
      case 0:
        switch (rst) {
          case 0x18:
            rom = 1;
            break;
          case 0x20:
            rom = 2;
            break;
          case 0x28:
            rom = 3;
            break;
          default:
            return;  
        }
        item.hardComment = `(Invoke ROM ${rom} subroutine)`;
        this._rstWith2ByteVector = true;
        this._rstWith3ByteVector = false;
        return;

      // ROM 2 supports RST $08 with 3-byte vector
      case 2:
        if (rst !== 0x08) {
          return;
        }
        console.log("ROM 2 RST $08 detected");
        this._rstWith2ByteVector = false;
        this._rstWith3ByteVector = true;
        return;
      // Other ROMs do not support custom RST handling
      default:
        return;
    }
  }
}
