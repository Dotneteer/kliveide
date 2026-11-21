import { DisassemblyItem, FetchResult, MemorySection } from "../common-types";
import { intToX2 } from "../utils";
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
 */

const RST_08 = 0xcf;

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

export class SamCustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst8 = false;

  readonly toolId = CUSTOM_Z80_DISASSEMBLY_TOOL;

  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  startSectionDisassembly(_section: MemorySection): void {
    this._inRst8 = false;
  }

  beforeInstruction(fetchResult: FetchResult): boolean {
    if (!this._inRst8) return false;
    this._inRst8 = false;
    const code = this._api.fetch().opcode;
    this._api.addDisassemblyItem({
      address: fetchResult.offset,
      opCodes: [code],
      instruction: `.defb ${this._api.decimalMode ? code.toString(10) : `$${intToX2(code)}`}`,
      hardComment: samRst8Comment(code)
    });
    return true;
  }

  afterInstruction(item: DisassemblyItem): void {
    if (item.opCodes?.length === 1 && item.opCodes[0] === RST_08) {
      this._inRst8 = true;
      item.hardComment = "(error or DOS hook)";
    }
  }
}
