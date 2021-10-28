import { ICustomVmTool } from "@modules-core/virtual-machine-tool";
import {
  CUSTOM_Z80_DISASSEMBLY_TOOL,
  ICustomDisassembler,
  IDisassemblyApi,
} from "@modules/cpu-z80/custom-disassembly";
import {
  DisassemblyItem,
  FetchResult,
  intToX2,
  MemorySection,
} from "@modules/cpu-z80/disassembly-helper";

/**
 * Custom disassembler for the Cambridge Z88 model
 */
export class CambridgeZ88CustomDisassembler
  implements ICustomVmTool, ICustomDisassembler
{
  private _api: IDisassemblyApi;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api
   */
  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param _section
   */
  startSectionDisassembly(_section: MemorySection): void {}

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(peekResult: FetchResult): boolean {
    if (peekResult.opcode === 0xdf) {
      // --- Handle RST 18H
      this._api.fetch();
      const opByte = this._api.fetch().opcode;
      const apiName = z88FppApis[opByte] ?? "<unknown>";

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)} ${intToX2(opByte)}`,
        instruction: `fpp ${apiName}`,
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    } else if (peekResult.opcode === 0xe7) {
      // --- Handle RST 20H
      this._api.fetch();
      let opByte = this._api.fetch().opcode;
      let opCodes = `${intToX2(peekResult.opcode)} ${intToX2(opByte)}`;
      if (opByte === 6 || opByte === 9 || opByte === 12) {
        const opByte2 = this._api.fetch().opcode;
        opByte = (opByte2 << 8) + opByte;
        opCodes += ` ${intToX2(opByte2)}`;
      }
      const apiName = z88OzApis[opByte] ?? "<unknown>";

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes,
        instruction: `oz ${apiName}`,
      };
      this._api.addDisassemblyItem(newItem);
      if (opByte === 0x93) {
        // --- Special case, add a 0-terminated string
        let str = ".defb ";
        let ch = 0;
        let isFirst = true;
        let usedString = false;
        do {
          ch = this._api.fetch().opcode;
          if (ch >= 32 && ch <= 127) {
            if (usedString) {
              str += String.fromCharCode(ch);
            } else {
              if (!isFirst) {
                str += ", ";
              }
              str += '"' + String.fromCharCode(ch);
            }
            usedString = true;
          } else {
            if (usedString) {
              str += '"';
            }
            if (!isFirst) {
              str += ", ";
            }
            str += `$${intToX2(ch)}`;
            usedString = false;
          }
          isFirst = false;
        } while (ch);
        const strItem: DisassemblyItem = {
          address: peekResult.offset,
          opCodes: "",
          instruction: str,
        };
        this._api.addDisassemblyItem(strItem);
      }

      return true;
    } else if (peekResult.opcode === 0xef) {
      // --- Handle RST 28H
      // --- Consume th operation code
      this._api.fetch();

      // --- Get the 24-bit LSB address
      const byte1 = this._api.fetch().opcode;
      const byte2 = this._api.fetch().opcode;
      const byte3 = this._api.fetch().opcode;
      const addr = (byte3 << 16) | (byte2 << 8) | byte1;

      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)} ${intToX2(byte1)} ${intToX2(
          byte2
        )} ${intToX2(byte3)}`,
        instruction: `extcall $${addr
          .toString(16)
          .padStart(6, "")
          .toLowerCase()}`,
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    } else if (peekResult.opcode === 0xf7) {
      // --- Handle RST 30H
      this._api.fetch();
      // --- Create the item
      const newItem: DisassemblyItem = {
        address: peekResult.offset,
        opCodes: `${intToX2(peekResult.opcode)}`,
        instruction: "rst oz_mbp",
      };
      this._api.addDisassemblyItem(newItem);
      return true;
    }

    // --- Use the default disassembly
    return false;
  }

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param _item Disassembled item
   */
  afterInstruction(_item: DisassemblyItem): void {}
}

/**
 * List of Z88 RST 18H APIs
 */
export const z88FppApis: Record<number, string> = {
  0x21: "FP_AND",
  0x24: "FP_IDV",
  0x27: "FP_EOR",
  0x2a: "FP_MOD",
  0x2d: "FP_OR",
  0x30: "FP_LEQ",
  0x33: "FP_NEQ",
  0x36: "FP_GEQ",
  0x39: "FP_LT",
  0x3c: "FP_EQ",
  0x3f: "FP_MUL",
  0x42: "FP_ADD",
  0x45: "FP_GT",
  0x48: "FP_SUB",
  0x4b: "FP_PWR",
  0x4e: "FP_DIV",
  0x51: "FP_ABS",
  0x54: "FP_ACS",
  0x57: "FP_ASN",
  0x5a: "FP_ATN",
  0x5d: "FP_COS",
  0x60: "FP_DEG",
  0x63: "FP_EXP",
  0x66: "FP_INT",
  0x6c: "FP_LOG",
  0x6f: "FP_NOT",
  0x72: "FP_RAD",
  0x75: "FP_SGN",
  0x78: "FP_SIN",
  0x7b: "FP_SQR",
  0x7e: "FP_TAN",
  0x81: "FP_ZER",
  0x84: "FP_ONE",
  0x87: "FP_TRU",
  0x8a: "FP_PI",
  0x8d: "FP_VAL",
  0x90: "FP_STR",
  0x93: "FP_FIX",
  0x96: "FP_FLT",
  0x9c: "FP_CMP",
  0x9f: "FP_NEG",
  0xa2: "FP_BAS",
};

export const z88OzApis: Record<number, string> = {
  0x21: "OS_BYE",
  0x24: "OS_PRT",
  0x27: "OS_OUT",
  0x2a: "OS_IN",
  0x2d: "OS_TIN",
  0x30: "OS_XIN",
  0x33: "OS_PUR",
  0x36: "OS_UGB",
  0x39: "OS_GB",
  0x3c: "OS_PB",
  0x3f: "OS_GBT",
  0x42: "OS_PBT",
  0x45: "OS_MV",
  0x48: "OS_FRM",
  0x4b: "OS_FWM",
  0x4e: "OS_MOP",
  0x51: "OS_MCL",
  0x54: "OS_MAL",
  0x57: "OS_MFR",
  0x5a: "OS_MGB",
  0x5d: "OS_MPB",
  0x60: "OS_BIX",
  0x63: "OS_BOX",
  0x66: "OS_NQ",
  0x69: "OS_SP",
  0x6c: "OS_SR",
  0x6f: "OS_ESC",
  0x72: "OS_ERC",
  0x75: "OS_ERH",
  0x78: "OS_UST",
  0x7b: "OS_FN",
  0x7e: "OS_WAIT",
  0x81: "OS_ALM",
  0x84: "OS_CLI",
  0x87: "OS_DOR",
  0x8a: "OS_FC",
  0x8d: "OS_SI",
  0x90: "OS_BOUT",
  0x93: "OS_POUT",
  0x96: "OS_HOUT",
  0x99: "OS_SOUT",
  0x9c: "OS_KIN",
  0x9f: "OS_NLN",

  0xb606: "OS_FAT",
  0xb806: "OS_ISO",
  0xba06: "OS_FDP",
  0xbc06: "OS_WTS",
  0xc006: "OS_FXM",
  0xc206: "OS_AXM",
  0xc406: "OS_FMA",
  0xc606: "OS_PLOZ",
  0xc806: "OS_FEP",
  0xca06: "OS_WTB",
  0xcc06: "OS_WRT",
  0xce06: "OS_WSQ",
  0xd006: "OS_ISQ",
  0xd206: "OS_AXP",
  0xd406: "OS_SCI",
  0xd606: "OS_DLY",
  0xd806: "OS_BLP",
  0xda06: "OS_BDE",
  0xdc06: "OS_BHL",
  0xde06: "OS_FTH",
  0xe006: "OS_VTH",
  0xe206: "OS_GTH",
  0xe406: "OS_REN",
  0xe606: "OS_DEL",
  0xe806: "OS_CL",
  0xea06: "OS_OP",
  0xec06: "OS_OFF",
  0xee06: "OS_USE",
  0xf006: "OS_EPR",
  0xf206: "OS_HT",
  0xf406: "OS_MAP",
  0xf606: "OS_EXIT",
  0xf806: "OS_STK",
  0xfa06: "OS_POLL",
  0xfc06: "OS_???",
  0xfe06: "OS_DOM",

  0x0609: "GN_GDT",
  0x0809: "GN_PDT",
  0x0a09: "GN_GTM",
  0x0c09: "GN_PTM",
  0x0e09: "GN_SDO",
  0x1009: "GN_GDN",
  0x1209: "GN_PDN",
  0x1409: "GN_DIE",
  0x1609: "GN_DEI",
  0x1809: "GN_GMD",
  0x1a09: "GN_GMT",
  0x1c09: "GN_PMD",
  0x1e09: "GN_PMT",
  0x2009: "GN_MSC",
  0x2209: "GN_FLO",
  0x2409: "GN_FLC",
  0x2609: "GN_FLW",
  0x2809: "GN_FLR",
  0x2a09: "GN_FLF",
  0x2c09: "GN_FPB",
  0x2e09: "GN_NLN",
  0x3009: "GN_CLS",
  0x3209: "GN_SKC",
  0x3409: "GN_SKF",
  0x3609: "GN_SKT",
  0x3809: "GN_SIP",
  0x3a09: "GN_SOP",
  0x3c09: "GN_SOE",
  0x3e09: "GN_RBE",
  0x4009: "GN_WBE",
  0x4209: "GN_CME",
  0x4409: "GN_XNX",
  0x4609: "GN_XIN",
  0x4809: "GN_XDL",
  0x4a09: "GN_ERR",
  0x4c09: "GN_ESP",
  0x4e09: "GN_FCM",
  0x5009: "GN_FEX",
  0x5209: "GN_OPW",
  0x5409: "GN_WCL",
  0x5609: "GN_WFN",
  0x5809: "GN_PRS",
  0x5a09: "GN_PFS",
  0x5c09: "GN_WSM",
  0x5e09: "GN_ESA",
  0x6009: "GN_OPF",
  0x6209: "GN_CL",
  0x6409: "GN_DEL",
  0x6609: "GN_REN",
  0x6809: "GN_AAB",
  0x6a09: "GN_FAB",
  0x6c09: "GN_LAB",
  0x6e09: "GN_UAB",
  0x7009: "GN_ALP",
  0x7209: "GN_M16",
  0x7409: "GN_D16",
  0x7609: "GN_M24",
  0x7809: "GN_D24",
  0x7a09: "GN_WIN",
  0x7c09: "GN_CRC",
  0x7e09: "GN_GAB",
  0x8009: "GN_LDM",
  0x8209: "GN_ELF",
  0x8409: "GN_GHN",
  0x8609: "GN_PHN",
  0x8809: "GN_DIR",
  0x8a09: "GN_MOV",
  0x8c09: "GN_CPY",
  0x8e09: "GN_LUT",

  0x060c: "DC_INI",
  0x080c: "DC_BYE",
  0x0a0c: "DC_ENT",
  0x0c0c: "DC_NAM",
  0x0e0c: "DC_IN",
  0x100c: "DC_OUT",
  0x120c: "DC_PRT",
  0x140c: "DC_ICL",
  0x160c: "DC_NQ",
  0x180c: "DC_SP",
  0x1a0c: "DC_ALT",
  0x1c0c: "DC_RBD",
  0x1e0c: "DC_XIN",
  0x200c: "DC_GEN",
  0x220c: "DC_POL",
  0x240c: "DC_RTE",
  0x260c: "DC_ELF",
  0x280c: "DC_DBG",
  0x2a0c: "DC_DIS",
  0x2c0c: "DC_SBP",
  0x2e0c: "DC_RBP",
  0x300c: "DC_LCK",
};
