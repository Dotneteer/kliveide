import type { ErrorCodes } from "@main/compiler-common/assembler-errors";
import type { CopperBlock } from "@common/zxnext/copper/copperBlocks";
import { dmaProgramWarnings, groupDmaPrograms } from "@common/zxnext/dma/dmaProgram";
import { zx8081CharCode } from "@common/zx8081/charset";
import { ZX80_REM_BODY, ZX81_REM_BODY } from "@common/zx8081/programImage";
import { ExpressionValueType } from "@abstractions/CompilerInfo";
import { BinarySegment, NexFileHandleMode } from "@main/compiler-common/assembler-in-out";
import { FixupType, IExpressionValue } from "@main/compiler-common/abstractions";
import { CommonAssembler } from "@main/compiler-common/common-assembler";
import { FixupEntry } from "@main/compiler-common/fixups";
import {
  AssemblyLine,
  BankPragma,
  Expression,
  PagePragma,
  PartialAssemblyLine
} from "@main/compiler-common/tree-nodes";
import type { Z80Node } from "./assembler-tree-nodes";
import type { Z80TokenType } from "./z80-token-stream";
import {
  findModelTypeByName,
  isEnterpriseModelType,
  isHt1080zModelType,
  isTvcModelType,
  isZx8081ModelType,
  SpectrumModelType,
  SpectrumModelTypes
} from "./SpectrumModelTypes";
import { convertSpectrumString } from "./z80-utils";
import {
  CopperHaltPragma,
  CopperMovePragma,
  CopperNopPragma,
  CopperWaitPragma,
  CopperWordPragma,
  DefZxPragma,
  DmaCmdPragma,
  DmaContinuePragma,
  DmaDisablePragma,
  DmaEnablePragma,
  DmaLoadPragma,
  DmaReadMaskPragma,
  DmaResetPragma,
  DmaWr0Pragma,
  DmaWr1Pragma,
  DmaWr2Pragma,
  DmaWr3Pragma,
  DmaWr4Pragma,
  DmaWr5Pragma,
  SaveNexBarPragma,
  SaveNexBorderPragma,
  SaveNexCopperPragma,
  SaveNexCorePragma,
  SaveNexEntryAddrPragma,
  SaveNexEntryBankPragma,
  SaveNexFileHandlePragma,
  SaveNexFilePragma,
  SaveNexPalettePragma,
  SaveNexPreservePragma,
  SaveNexRamPragma,
  SaveNexScreenPragma,
  SaveNexStackAddrPragma,
  Z80MachinePragma
} from "./z80-machine-tree-nodes";

/**
 * The valid model names of `.model` (`SpectrumModelTypes` keeps the display names)
 */
const VALID_MODELS = ["SPECTRUM48", "SPECTRUM128", "SPECTRUMP3", "NEXT", "ZX80", "ZX81", "HT1080Z", "TVC", "ENTERPRISE", "SAMCOUPE"];

/**
 * The machines Klive's Z80 assembler targets (the ZX Spectrum family, the ZX Spectrum Next, the
 * ZX80/ZX81, the HT-1080Z, the TVC, the Enterprise and the SAM Coupé): their models, default code
 * addresses and code-range warnings, memory banks and pages, and the machine pragmas (`.savenex`,
 * `.dma`, `.copper`, `.defzx`). None of this is Z80 instruction knowledge, and none of it belongs to the
 * CPU-neutral core; `Z80Assembler` adds the Z80 instruction set on top.
 */
export abstract class Z80MachineAssembler extends CommonAssembler<Z80Node, Z80TokenType> {
  // --- True once a `.savenex border` pragma set the border, so the Next auto-mode default does not override it
  private _nexBorderSetExplicitly = false;

  /**
   * Every `.copper` word emitted, in emission order; `collectCopperBlocks` turns them into the
   * output's `copperBlocks` once the fixups have patched the words
   */
  private _copperEmissions: CopperEmission[] = [];

  /**
   * Every `.dma` line's bytes, in emission order; `checkDmaPrograms` groups them into programs and
   * reports their warnings once the fixups have patched the bytes (NEXT_DMA_DEBUGGING_PLAN §10)
   */
  private _dmaEmissions: DmaEmission[] = [];

  // ==========================================================================
  // Models

  protected validateModelType(modelType: string): boolean {
    return VALID_MODELS.includes(modelType.toUpperCase());
  }

  protected getModelNameById(modelId: number): string {
    return SpectrumModelTypes[modelId];
  }

  protected getModelIdByName(modelName: string): number | undefined {
    return findModelTypeByName(modelName);
  }

  /**
   * The 128K, +3 and Next page banks; the 48K, the ZX80/ZX81, the HT-1080Z and the others have none
   * @param modelId The model ID to check
   */
  protected modelSupportsBankPragma(modelId: number): ErrorCodes | null {
    if (
      modelId === SpectrumModelType.Spectrum128 ||
      modelId === SpectrumModelType.SpectrumP3 ||
      modelId === SpectrumModelType.Next
    ) {
      return null;
    }
    return "Z0308";
  }

  /**
   * `.model Next` switches automatic Next mode on
   * @param modelId The selected model
   */
  protected onModelSelected(modelId: number): void {
    if (modelId === SpectrumModelType.Next) {
      this.applyNextDefaults();
    }
  }

  /**
   * Where code with no `.org` goes: $8000, except on the ZX80/ZX81, where nothing executes there and
   * code lives in the `1 REM` line (`dev/ai/zx8081.md`, "Machine code decisions", D3)
   */
  protected getDefaultStartAddress(): number {
    switch (this._output.modelType ?? this._options?.currentModel) {
      case SpectrumModelType.ZX81:
        return ZX81_REM_BODY;
      case SpectrumModelType.ZX80:
        return ZX80_REM_BODY;
      // --- Free RAM on every HT-1080Z model, above BASIC (`dev/plans/HT1080Z_CODE_INJECTION_PLAN.md` D8)
      case SpectrumModelType.HT1080Z:
        return 0x7000;
      // --- After the BASIC launcher line, where TVC machine code is loaded (`common/tvc/codePlacement.ts`)
      case SpectrumModelType.TVC:
        return 0x1a30;
      // --- Where EXOS loads a `$$APP` program (`common/enterprise/codePlacement.ts`)
      case SpectrumModelType.Enterprise:
        return 0x0100;
      default:
        return 0x8000;
    }
  }

  /**
   * ZX Spectrum strings: `\i`, `\p`, ... are the Spectrum's control codes
   * @param text The string's text
   */
  protected convertStringToBytes(text: string): string {
    return convertSpectrumString(text);
  }

  // ==========================================================================
  // Compilation lifecycle

  protected resetCpuCompilationState(): void {
    this._nexBorderSetExplicitly = false;
    this._copperEmissions = [];
    this._dmaEmissions = [];
  }

  /**
   * Collects the Copper programs and checks the DMA programs once the fixups are resolved, then
   * fills the Next auto-mode defaults the source did not set (`.ent` is resolved by now)
   * @param emitSuccess Whether the code emission and the fixups succeeded
   */
  protected completeAssembly(emitSuccess: boolean): boolean {
    if (emitSuccess) {
      emitSuccess = this.collectCopperBlocks();
    }
    if (emitSuccess) {
      this.checkDmaPrograms();
    }
    if (this._output.isNextAutoMode) {
      this.applyNextAutoModeFinalDefaults();
    }
    return emitSuccess;
  }

  /**
   * In Next auto mode, a segment without a bank is unbanked code (bank 2 and on in the NEX file)
   * @param segment The segment that started
   */
  protected onSegmentStarted(segment: BinarySegment): void {
    if (this._output.isNextAutoMode && segment.bank === undefined) {
      if (!this._output.unbankedSegments) {
        this._output.unbankedSegments = [];
      }
      if (!this._output.unbankedSegments.includes(segment)) {
        this._output.unbankedSegments.push(segment);
      }
    }
  }

  /**
   * Tells if the current model (`.model`, or the options' `currentModel`) is the ZX Spectrum Next
   */
  protected isNextModel(): boolean {
    return (this._output.modelType ?? this._options.currentModel) === SpectrumModelType.Next;
  }

  /**
   * Warns about code where the model cannot run or load it
   */
  protected checkEmitAddress(): void {
    this.checkUnbankedCodeRange();
    this.checkZx8081CodeRange();
    this.checkHt1080zCodeRange();
    this.checkTvcCodeRange();
    this.checkEnterpriseCodeRange();
  }

  /**
   * Applies automatic defaults for ZX Spectrum Next model.
   *
   * Only switches automatic Next mode on. The border and entry address defaults are applied by
   * `applyNextAutoModeFinalDefaults` once the whole source has been assembled: filling them in here
   * (when `.model Next` is seen) made them indistinguishable from explicit values - `.ent` could never
   * set the NEX entry point, and a `.savenex border 0` could only survive by the accident that `.model`
   * is processed before the pragmas.
   */
  private applyNextDefaults(): void {
    // Mark that we're in automatic Next mode (for unbanked code handling)
    this._output.isNextAutoMode = true;
  }


  /**
   * Fills the Next auto-mode `.savenex` defaults that no source line set, after all fixups are resolved:
   * - border: 7, unless `.savenex border` gave a value (0 included);
   * - entry address: `.savenex entryaddr` > `.ent` > $8000.
   */
  private applyNextAutoModeFinalDefaults(): void {
    const nexConfig = this._output.nexConfig;
    if (!this._nexBorderSetExplicitly) {
      nexConfig.borderColor = 7;
    }
    if (nexConfig.entryAddr === undefined) {
      nexConfig.entryAddr = this._output.entryAddress ?? 0x8000;
    }
  }


  /**
   * On a ZX80/ZX81, an instruction fetched at $8000 or above executes as a NOP (the ULA's display
   * trick), so code there cannot run. Warned once per segment: data may legitimately live there.
   */
  protected checkZx8081CodeRange(): void {
    const model = this._output.modelType ?? this._options.currentModel;
    if (!isZx8081ModelType(model) || !this._currentSegment) return;
    const currentAddress = this.getCurrentAssemblyAddress();
    if (currentAddress > 0x7fff && !(this._currentSegment as any).zx8081RangeWarned) {
      this.reportAssemblyWarning(
        "Z0378",
        this._currentSourceLine,
        null,
        currentAddress.toString(16).toUpperCase()
      );
      (this._currentSegment as any).zx8081RangeWarned = true;
    }
  }


  /**
   * On the HT-1080Z, code below $3C00 is in the ROM or the keyboard area and cannot be loaded, and code
   * in $3C00-$42E8 is overwritten by BASIC's screen and the ROM's work area
   * (`dev/plans/HT1080Z_CODE_INJECTION_PLAN.md` D2). Warned once per segment and area: injection and
   * export refuse the first, and the second can be deliberate (a picture in video RAM).
   */
  protected checkHt1080zCodeRange(): void {
    const model = this._output.modelType ?? this._options.currentModel;
    if (!isHt1080zModelType(model) || !this._currentSegment) return;
    const address = this.getCurrentAssemblyAddress();
    const segment = this._currentSegment as any;
    const hex = address.toString(16).toUpperCase().padStart(4, "0");
    if (address < 0x3c00) {
      if (!segment.ht1080zRomWarned) this.reportAssemblyWarning("Z0382", this._currentSourceLine, null, hex);
      segment.ht1080zRomWarned = true;
    } else if (address < 0x42e9) {
      if (!segment.ht1080zWorkWarned) this.reportAssemblyWarning("Z0383", this._currentSourceLine, null, hex);
      segment.ht1080zWorkWarned = true;
    }
  }


  /**
   * On the TVC, code below $1A30 is in BASIC's and the ROM's work area or the launcher line, and code
   * above $BBFF leaves BASIC no room or reaches the ROM (`common/tvc/codePlacement.ts`). Warned once
   * per segment and area; Run and Export refuse both.
   */
  protected checkTvcCodeRange(): void {
    const model = this._output.modelType ?? this._options.currentModel;
    if (!isTvcModelType(model) || !this._currentSegment) return;
    const address = this.getCurrentAssemblyAddress();
    const segment = this._currentSegment as any;
    const hex = address.toString(16).toUpperCase().padStart(4, "0");
    if (address < 0x1a30) {
      if (!segment.tvcLowWarned) this.reportAssemblyWarning("Z0384", this._currentSourceLine, null, hex);
      segment.tvcLowWarned = true;
    } else if (address > 0xbbff) {
      if (!segment.tvcHighWarned) this.reportAssemblyWarning("Z0385", this._currentSourceLine, null, hex);
      segment.tvcHighWarned = true;
    }
  }


  /**
   * On the Enterprise, a program is an EXOS `$$APP` loaded at $0100 (`common/enterprise/codePlacement.ts`):
   * below $0100 is EXOS's page-zero area, and from $C000 page 3 holds EXOS's system segment. Warned
   * once per segment and area; Run and Export refuse both.
   */
  protected checkEnterpriseCodeRange(): void {
    const model = this._output.modelType ?? this._options.currentModel;
    if (!isEnterpriseModelType(model) || !this._currentSegment) return;
    const address = this.getCurrentAssemblyAddress();
    const segment = this._currentSegment as any;
    const hex = address.toString(16).toUpperCase().padStart(4, "0");
    if (address < 0x0100) {
      if (!segment.epLowWarned) this.reportAssemblyWarning("Z0386", this._currentSourceLine, null, hex);
      segment.epLowWarned = true;
    } else if (address > 0xbfff) {
      if (!segment.epHighWarned) this.reportAssemblyWarning("Z0387", this._currentSourceLine, null, hex);
      segment.epHighWarned = true;
    }
  }


  /**
   * In Next auto mode, warns (once per segment) when unbanked code goes above $BFFF, beyond bank 2's
   * typical range
   */
  protected checkUnbankedCodeRange(): void {
    // Only check if in Next auto mode and current segment is unbanked
    if (!this._output.isNextAutoMode || !this._currentSegment || this._currentSegment.bank !== undefined) {
      return; // Not in auto mode, or segment is explicitly banked
    }
    
    const currentAddress = this.getCurrentAssemblyAddress();
    if (currentAddress > 0xbfff) {
      // Mark segment as warned so we don't repeat the warning
      if (!(this._currentSegment as any).rangeWarned) {
        // Report as warning, not error - code can exceed $bfff
        this.reportAssemblyWarning(
          "Z0370",
          this._currentSourceLine,
          null,
          currentAddress.toString(16).toUpperCase()
        );
        (this._currentSegment as any).rangeWarned = true;
      }
    }
  }


  // ==========================================================================
  // Machine pragmas

  /**
   * Processes the machine pragmas
   * @param pragma The pragma line
   * @param _label The line's label, if any
   * @param emitAction When set, the pragma emits its bytes through it (structure fields)
   */
  protected applyCpuPragma(
    pragma: AssemblyLine<Z80Node>,
    _label: string | null,
    emitAction?: (b: number) => void
  ): void {
    const pragmaLine = pragma as unknown as Z80MachinePragma<Z80Node, Z80TokenType>;
    // --- A `.dma` line: where its bytes start, recorded after the switch
    const dmaStart = pragmaLine.type.startsWith("Dma") ? this.dmaEmissionStart() : undefined;
    switch (pragmaLine.type) {
      case "DefZxPragma":
        this.processDefZxPragma(pragmaLine, emitAction);
        break;
      case "SaveNexFilePragma":
        this.processSaveNexFile(pragmaLine);
        break;
      case "SaveNexRamPragma":
        this.processSaveNexRam(pragmaLine);
        break;
      case "SaveNexBorderPragma":
        this.processSaveNexBorder(pragmaLine);
        break;
      case "SaveNexCorePragma":
        this.processSaveNexCore(pragmaLine);
        break;
      case "SaveNexStackAddrPragma":
        this.processSaveNexStackAddr(pragmaLine);
        break;
      case "SaveNexEntryAddrPragma":
        this.processSaveNexEntryAddr(pragmaLine);
        break;
      case "SaveNexEntryBankPragma":
        this.processSaveNexEntryBank(pragmaLine);
        break;
      case "SaveNexFileHandlePragma":
        this.processSaveNexFileHandle(pragmaLine);
        break;
      case "SaveNexPreservePragma":
        this.processSaveNexPreserve(pragmaLine);
        break;
      case "SaveNexScreenPragma":
        this.processSaveNexScreen(pragmaLine);
        break;
      case "SaveNexPalettePragma":
        this.processSaveNexPalette(pragmaLine);
        break;
      case "SaveNexCopperPragma":
        this.processSaveNexCopper(pragmaLine);
        break;
      case "SaveNexBarPragma":
        this.processSaveNexBar(pragmaLine);
        break;

      // --- DMA pragma cases (each line's bytes are recorded for `checkDmaPrograms`)
      case "DmaResetPragma":
        this.processDmaSimpleCommand(pragmaLine, 0xc3);
        break;
      case "DmaLoadPragma":
        this.processDmaSimpleCommand(pragmaLine, 0xcf);
        break;
      case "DmaEnablePragma":
        this.processDmaSimpleCommand(pragmaLine, 0x87);
        break;
      case "DmaDisablePragma":
        this.processDmaSimpleCommand(pragmaLine, 0x83);
        break;
      case "DmaContinuePragma":
        this.processDmaSimpleCommand(pragmaLine, 0xd3);
        break;
      case "DmaCmdPragma":
        this.processDmaCmdPragma(pragmaLine);
        break;
      case "DmaReadMaskPragma":
        this.processDmaReadMaskPragma(pragmaLine);
        break;
      case "DmaWr0Pragma":
        this.processDmaWr0Pragma(pragmaLine);
        break;
      case "DmaWr1Pragma":
        this.processDmaWr1Pragma(pragmaLine);
        break;
      case "DmaWr2Pragma":
        this.processDmaWr2Pragma(pragmaLine);
        break;
      case "DmaWr3Pragma":
        this.processDmaWr3Pragma(pragmaLine);
        break;
      case "DmaWr4Pragma":
        this.processDmaWr4Pragma(pragmaLine);
        break;
      case "DmaWr5Pragma":
        this.processDmaWr5Pragma(pragmaLine);
        break;

      // --- Copper pragma cases
      case "CopperWaitPragma":
        this.processCopperWaitPragma(pragmaLine);
        break;
      case "CopperMovePragma":
        this.processCopperMovePragma(pragmaLine);
        break;
      case "CopperNopPragma":
        this.processCopperFixedWord(pragmaLine, 0x0000);
        break;
      case "CopperHaltPragma":
        this.processCopperFixedWord(pragmaLine, 0xffff);
        break;
      case "CopperWordPragma":
        this.processCopperWordPragma(pragmaLine);
        break;
    }
    if (dmaStart) this.recordDmaEmission(pragmaLine, dmaStart);
  }

  /**
   * `.defzx` is the machine pragma that emits bytes, so it can be a structure field
   * @param asmLine The pragma line
   */
  protected isCpuByteEmittingPragma(asmLine: AssemblyLine<Z80Node>): boolean {
    return asmLine.type === "DefZxPragma";
  }

  /**
   * Resolves the NEX header's and the Copper's fixups
   * @param fixup The fixup
   * @param value The evaluated value of its expression
   */
  protected resolveCpuFixup(fixup: FixupEntry<Z80Node, Z80TokenType>, value: IExpressionValue): boolean {
    const emittedCode = this._output.segments[fixup.segmentIndex].emittedCode;
    switch (fixup.type) {
      case FixupType.NexStackAddr: {
        const stackAddr = value.asWord();
        if (stackAddr < 0 || stackAddr > 0xffff) {
          this.reportAssemblyError("Z0351", fixup.sourceLine);
          return false;
        }
        this._output.nexConfig.stackAddr = stackAddr;
        return true;
      }
      case FixupType.NexEntryAddr: {
        const entryAddr = value.asWord();
        if (entryAddr < 0 || entryAddr > 0xffff) {
          this.reportAssemblyError("Z0352", fixup.sourceLine);
          return false;
        }
        this._output.nexConfig.entryAddr = entryAddr;
        return true;
      }
      case FixupType.CopperWait:
      case FixupType.CopperMove: {
        // --- The same range checks as an immediate operand (T6, T7)
        const operandValue = value.asLong();
        const operand = fixup.data ?? 0;
        if (!this.checkCopperOperand(fixup.sourceLine, fixup.type, operand, operandValue)) {
          return false;
        }
        this.patchCopperOperand(emittedCode, fixup.offset, fixup.type, operand, operandValue);
        return true;
      }
    }
    return super.resolveCpuFixup(fixup, value);
  }

  /**
   * Processes the .bank pragma
   * @param pragma Pragma to process
   * @param label Label information
   */
  processBankPragma(pragma: BankPragma<Z80Node, Z80TokenType>, label: string | null): void {
    if (label) {
      // --- No label is allowed
      this.reportAssemblyError("Z0305", pragma);
      return;
    }

    // --- Check pragma value
    var value = this.evaluateExprImmediate(pragma.bankId);
    if (!value.isValid) {
      return;
    }
    
    // --- Check for appropriate model type first
    const errCode = this.modelSupportsBankPragma(this._output.modelType);
    if (this._output.modelType === undefined || errCode) {
      this.reportAssemblyError(errCode, pragma);
      return;
    }
    
    // --- Check if noexport flag is used (only allowed for Next model)
    if (pragma.noexport) {
      const isNext = this._output.modelType === SpectrumModelType.Next;
      if (!isNext) {
        this.reportAssemblyError("Z0331", pragma);
        return;
      }
    }
    
    // --- Bank range check depends on model
    const isNext = this._output.modelType === SpectrumModelType.Next;
    const maxBank = isNext ? 111 : 7;
    if (value.asWord() > maxBank) {
      this.reportAssemblyError("Z0306", pragma);
      return;
    }

    // --- Check offsetValue
    let offset = 0;
    if (pragma.offset !== null) {
      var offsetValue = this.evaluateExprImmediate(pragma.offset);
      if (!offsetValue.isValid) {
        return;
      }
      offset = offsetValue.asWord();
      if (offset > 0x3fff) {
        this.reportAssemblyError("Z0307", pragma);
        return;
      }
    }

    this.ensureCodeSegment((0xc000 + offset) & 0xffff);
    if (this._currentSegment.currentOffset !== 0 || this._currentSegment.bank !== undefined) {
      // --- There is already code emitted for the current segment,
      // --- thus create a new segment
      this._currentSegment = new BinarySegment();
      this._output.segments.push(this._currentSegment);
    }
    
    // --- For non-Next models, a bank can be used only once
    // --- For Next, allow multiple segments per bank
    if (!isNext && this._output.segments.some((s) => s.bank === value.value)) {
      this.reportAssemblyError("Z0309", pragma, null, value.value);
      return;
    }
    this._currentSegment.startAddress = (0xc000 + offset) & 0xffff;
    this._currentSegment.bank = value.value;
    this._currentSegment.bankOffset = offset;
    this._currentSegment.nexExport = !pragma.noexport; // Default true, set to false if noexport flag present
    this._currentSegment.maxCodeLength = 0x4000 - offset;
    // --- A reused empty segment may be the one Next auto mode tracked as unbanked; once it has a
    // --- bank, the NEX writer must not also treat it as bank 2 code (as `.page` already ensures)
    if (this._output.unbankedSegments) {
      const index = this._output.unbankedSegments.indexOf(this._currentSegment);
      if (index >= 0) this._output.unbankedSegments.splice(index, 1);
    }
  }


  /**
   * Processes the .page pragma: the code that follows is assembled for `address` (by default
   * $C000 for an even page, $E000 for an odd one) and stored in the 8K `page`, that is, in 16K bank
   * `page >> 1` from offset `(page & 1) * $2000` plus the address's offset within its 8K slot. With a
   * count of 2 (an even page, an address on an 8K boundary) the code may fill `page` and `page + 1`:
   * the whole 16K bank, for code that runs in a 16K window.
   * @param pragma Pragma to process
   * @param label Label information
   */
  processPagePragma(pragma: PagePragma<Z80Node, Z80TokenType>, label: string | null): void {
    if (label) {
      this.reportAssemblyError("Z0332", pragma);
      return;
    }
    if (!this.isNextModel()) {
      
      this.reportAssemblyError("Z0333", pragma);
      return;
    }

    const pageValue = this.evaluateExprImmediate(pragma.page);
    if (!pageValue.isValid) {
      return;
    }
    const page = pageValue.asLong();
    if (page < 0 || page > 223) {
      this.reportAssemblyError("Z0334", pragma);
      return;
    }

    let address = page & 1 ? 0xe000 : 0xc000;
    if (pragma.address) {
      const addressValue = this.evaluateExprImmediate(pragma.address);
      if (!addressValue.isValid) {
        return;
      }
      address = addressValue.asLong();
      if (address < 0 || address > 0xffff) {
        this.reportAssemblyError("Z0335", pragma);
        return;
      }
    }

    let count = 1;
    if (pragma.count) {
      const countValue = this.evaluateExprImmediate(pragma.count);
      if (!countValue.isValid) {
        return;
      }
      count = countValue.asLong();
      if (count !== 1 && count !== 2) {
        this.reportAssemblyError("Z0336", pragma);
        return;
      }
      if (count === 2 && ((page & 1) !== 0 || (address & 0x1fff) !== 0 || address > 0xc000)) {
        this.reportAssemblyError("Z0337", pragma);
        return;
      }
    }

    this.ensureCodeSegment(address);
    if (this._currentSegment.currentOffset !== 0 || this._currentSegment.bank !== undefined) {
      this._currentSegment = new BinarySegment();
      this._output.segments.push(this._currentSegment);
    }
    const offsetInPage = address & 0x1fff;
    this._currentSegment.startAddress = address;
    this._currentSegment.bank = page >> 1;
    this._currentSegment.bankOffset = (page & 1) * 0x2000 + offsetInPage;
    this._currentSegment.maxCodeLength = count * 0x2000 - offsetInPage;
    if (this._output.unbankedSegments) {
      const index = this._output.unbankedSegments.indexOf(this._currentSegment);
      if (index >= 0) this._output.unbankedSegments.splice(index, 1);
    }
  }


  /**
   * Processes the .defzx pragma: text in the ZX80's or ZX81's character set, a lower-case letter
   * giving the inverse-video capital (`dev/ai/zx8081.md`, "Machine code decisions", D2)
   * @param pragma Pragma to process
   * @param emitAction Action to emit a code byte
   */
  processDefZxPragma(pragma: DefZxPragma<Z80Node, Z80TokenType>, emitAction?: (b: number) => void): void {
    const model = this._output.modelType ?? this._options.currentModel;
    if (!isZx8081ModelType(model)) {
      this.reportAssemblyError("Z0379", pragma);
      return;
    }
    const message = this.evaluateExprImmediate(pragma.value);
    if (!message.isValid) return;
    if (message.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0380", pragma);
      return;
    }
    const isZx81 = model === SpectrumModelType.ZX81;
    const codes: number[] = [];
    for (const ch of message.asString()) {
      const code = zx8081CharCode(ch, isZx81);
      if (code === undefined) {
        this.reportAssemblyError("Z0381", pragma, null, isZx81 ? "ZX81" : "ZX80", ch);
        return;
      }
      codes.push(code);
    }
    for (const code of codes) {
      if (emitAction) {
        emitAction.call(this, code);
      } else {
        this.emitByte(code);
      }
    }
  }


  /** The segment and offset the next byte goes to, for a `.dma` line's record */
  private dmaEmissionStart(): { segmentIndex: number; offset: number; segment: BinarySegment } {
    this.ensureCodeSegment();
    return {
      segmentIndex: this._output.segments.length - 1,
      offset: this._currentSegment.currentOffset,
      segment: this._currentSegment
    };
  }


  /** Records the bytes a `.dma` line emitted (none when the model is not the Next) */
  private recordDmaEmission(
    pragma: Z80MachinePragma<Z80Node, Z80TokenType>,
    start: { segmentIndex: number; offset: number; segment: BinarySegment }
  ): void {
    if (this._currentSegment !== start.segment) return;
    const length = this._currentSegment.currentOffset - start.offset;
    if (length <= 0) return;
    this._dmaEmissions.push({
      segmentIndex: start.segmentIndex,
      offset: start.offset,
      length,
      sourceLine: pragma as unknown as AssemblyLine<Z80Node>
    });
  }


  /**
   * Groups the `.dma` lines into programs and reports their warnings (NEXT_DMA_DEBUGGING_PLAN §10.2):
   * after the fixups, so symbolic values are in. Warnings only; it never fails a build.
   */
  private checkDmaPrograms(): void {
    this._output.dmaPrograms.length = 0;
    let run: DmaEmission[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const code = this._output.segments[run[0].segmentIndex]?.emittedCode;
      if (code) {
        const lines = run.map((e, index) => ({ key: index, offset: e.offset, length: e.length }));
        for (const program of groupDmaPrograms(code, lines)) {
          this._output.dmaPrograms.push({
            address: (this._output.segments[run[0].segmentIndex].startAddress + program.start) & 0xffff,
            bytes: Array.from(code.slice(program.start, program.end)),
            lines: program.lines.map((l) => ({
              fileIndex: run[l.key].sourceLine.fileIndex,
              line: run[l.key].sourceLine.line,
              offset: l.offset - program.start,
              length: l.length
            }))
          });
          for (const w of dmaProgramWarnings(program)) {
            const args = w.ownerKey !== undefined ? [...w.args, run[w.ownerKey].sourceLine.line] : w.args;
            this.reportAssemblyWarning(w.code, run[w.key].sourceLine, null, ...args);
          }
        }
      }
      run = [];
    };
    for (const emission of this._dmaEmissions) {
      if (run.length > 0 && (run[0].segmentIndex !== emission.segmentIndex || emission.offset < run[run.length - 1].offset)) {
        flush();
      }
      run.push(emission);
    }
    flush();
  }


  /**
   * Processes the .savenex file pragma
   */
  processSaveNexFile(pragma: SaveNexFilePragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma); // SaveNex only with Next model
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // File requires string filename
      return;
    }

    this._output.nexConfig.filename = filenameValue.asString();
  }

  /**
   * Processes the .savenex ram pragma
   */
  processSaveNexRam(pragma: SaveNexRamPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const sizeValue = this.evaluateExprImmediate(pragma.size);
    if (sizeValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0342", pragma); // RAM requires 768 or 1792
      return;
    }

    const size = sizeValue.asLong();
    if (size !== 768 && size !== 1792) {
      this.reportAssemblyError("Z0342", pragma);
      return;
    }

    this._output.nexConfig.ramSize = size;
  }

  /**
   * Processes the .savenex border pragma
   */
  processSaveNexBorder(pragma: SaveNexBorderPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const colorValue = this.evaluateExprImmediate(pragma.color);
    if (colorValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0343", pragma); // Border requires 0-7
      return;
    }

    const color = colorValue.asLong();
    if (color < 0 || color > 7) {
      this.reportAssemblyError("Z0343", pragma);
      return;
    }

    this._output.nexConfig.borderColor = color;
    this._nexBorderSetExplicitly = true;
  }

  /**
   * Processes the .savenex core pragma
   */
  processSaveNexCore(pragma: SaveNexCorePragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const majorValue = this.evaluateExprImmediate(pragma.major);

    let major: number;
    let minor: number;
    let subminor: number;

    // Check if it's a string format like "3.1.10"
    if (majorValue.type === ExpressionValueType.String && !pragma.minor && !pragma.subminor) {
      const versionStr = majorValue.asString();
      const parts = versionStr.split('.');
      
      if (parts.length !== 3) {
        this.reportAssemblyError("Z0344", pragma); // Core version number ranges
        return;
      }

      major = parseInt(parts[0], 10);
      minor = parseInt(parts[1], 10);
      subminor = parseInt(parts[2], 10);

      if (isNaN(major) || isNaN(minor) || isNaN(subminor)) {
        this.reportAssemblyError("Z0344", pragma);
        return;
      }
    } else {
      // Handle the numeric format with three separate expressions
      if (!pragma.minor || !pragma.subminor) {
        this.reportAssemblyError("Z0344", pragma);
        return;
      }

      const minorValue = this.evaluateExprImmediate(pragma.minor);
      const subminorValue = this.evaluateExprImmediate(pragma.subminor);

      if (majorValue.type !== ExpressionValueType.Integer ||
          minorValue.type !== ExpressionValueType.Integer ||
          subminorValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0344", pragma); // Core version number ranges
        return;
      }

      major = majorValue.asLong();
      minor = minorValue.asLong();
      subminor = subminorValue.asLong();
    }

    if (major < 0 || major > 255 || minor < 0 || minor > 255 || subminor < 0 || subminor > 255) {
      this.reportAssemblyError("Z0344", pragma);
      return;
    }

    this._output.nexConfig.coreVersion = { major, minor, subminor };
  }

  /**
   * Processes the .savenex stackaddr pragma
   */
  processSaveNexStackAddr(pragma: SaveNexStackAddrPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const addrValue = this.evaluateExpr(pragma.address);
    if (!addrValue.isValid) {
      // Forward reference - record a fixup
      this.recordFixup(
        pragma as unknown as AssemblyLine<Z80Node>,
        FixupType.NexStackAddr,
        pragma.address
      );
      return;
    }

    if (addrValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0351", pragma); // Value range error
      return;
    }

    const addr = addrValue.asLong();
    if (addr < 0 || addr > 0xffff) {
      this.reportAssemblyError("Z0351", pragma);
      return;
    }

    this._output.nexConfig.stackAddr = addr;
  }

  /**
   * Processes the .savenex entryaddr pragma
   */
  processSaveNexEntryAddr(pragma: SaveNexEntryAddrPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const addrValue = this.evaluateExpr(pragma.address);
    if (!addrValue.isValid) {
      // Forward reference - record a fixup
      this.recordFixup(
        pragma as unknown as AssemblyLine<Z80Node>,
        FixupType.NexEntryAddr,
        pragma.address
      );
      return;
    }

    if (addrValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0352", pragma); // Value range error
      return;
    }

    const addr = addrValue.asLong();
    if (addr < 0 || addr > 0xffff) {
      this.reportAssemblyError("Z0352", pragma);
      return;
    }

    this._output.nexConfig.entryAddr = addr;
  }

  /**
   * Processes the .savenex entrybank pragma
   */
  processSaveNexEntryBank(pragma: SaveNexEntryBankPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const bankValue = this.evaluateExprImmediate(pragma.bankNo);
    if (bankValue.type !== ExpressionValueType.Integer) {
      this.reportAssemblyError("Z0345", pragma); // Entry bank 0-111
      return;
    }

    const bank = bankValue.asLong();
    if (bank < 0 || bank > 111) {
      this.reportAssemblyError("Z0345", pragma);
      return;
    }

    this._output.nexConfig.entryBank = bank;
  }

  /**
   * Processes the .savenex filehandle pragma
   */
  processSaveNexFileHandle(pragma: SaveNexFileHandlePragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const modeValue = this.evaluateExprImmediate(pragma.mode);
    if (modeValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0349", pragma); // Filehandle modes
      return;
    }

    const mode = modeValue.asString().toLowerCase();
    if (mode !== "close" && mode !== "open") {
      this.reportAssemblyError("Z0349", pragma);
      return;
    }

    this._output.nexConfig.fileHandle = mode as NexFileHandleMode;
  }

  /**
   * Processes the .savenex preserve pragma
   */
  processSaveNexPreserve(pragma: SaveNexPreservePragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const valueExpr = this.evaluateExprImmediate(pragma.value);
    
    let preserveValue: boolean;
    if (valueExpr.type === ExpressionValueType.String) {
      const str = valueExpr.asString().toLowerCase();
      if (str === "on" || str === "true") {
        preserveValue = true;
      } else if (str === "off" || str === "false") {
        preserveValue = false;
      } else {
        this.reportAssemblyError("Z0350", pragma); // Preserve requires on/off
        return;
      }
    } else if (valueExpr.type === ExpressionValueType.Integer) {
      preserveValue = valueExpr.asLong() !== 0;
    } else {
      this.reportAssemblyError("Z0350", pragma);
      return;
    }

    this._output.nexConfig.preserveRegs = preserveValue;
  }

  /**
   * Processes the .savenex screen pragma
   */
  processSaveNexScreen(pragma: SaveNexScreenPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const typeValue = this.evaluateExprImmediate(pragma.screenType);
    if (typeValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0347", pragma); // Invalid screen type
      return;
    }

    const type = typeValue.asString().toLowerCase();
    const validTypes = ["layer2", "ula", "lores", "hires-color", "hires-mono"];
    if (!validTypes.includes(type)) {
      this.reportAssemblyError("Z0347", pragma);
      return;
    }

    if (!pragma.filename) {
      this._output.nexConfig.screen = { type: type as any };
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0347", pragma);
      return;
    }

    let paletteOffset: number | undefined;
    if (pragma.paletteOffset) {
      const offsetValue = this.evaluateExprImmediate(pragma.paletteOffset);
      if (offsetValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0347", pragma);
        return;
      }
      paletteOffset = offsetValue.asLong();
    }

    this._output.nexConfig.screen = {
      type: type as any,
      filename: filenameValue.asString(),
      paletteOffset
    };
  }

  /**
   * Processes the .savenex palette pragma
   */
  processSaveNexPalette(pragma: SaveNexPalettePragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // Needs string filename
      return;
    }

    this._output.nexConfig.paletteFile = filenameValue.asString();
  }

  /**
   * Processes the .savenex copper pragma
   */
  processSaveNexCopper(pragma: SaveNexCopperPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const filenameValue = this.evaluateExprImmediate(pragma.filename);
    if (filenameValue.type !== ExpressionValueType.String) {
      this.reportAssemblyError("Z0341", pragma); // Needs string filename
      return;
    }

    this._output.nexConfig.copperFile = filenameValue.asString();
  }

  /**
   * Processes the .savenex bar pragma
   */
  processSaveNexBar(pragma: SaveNexBarPragma<Z80Node, Z80TokenType>): void {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0340", pragma);
      return;
    }

    const enabledValue = this.evaluateExprImmediate(pragma.enabled);
    
    let enabled: boolean;
    if (enabledValue.type === ExpressionValueType.String) {
      const str = enabledValue.asString().toLowerCase();
      if (str === "on" || str === "true") {
        enabled = true;
      } else if (str === "off" || str === "false") {
        enabled = false;
      } else {
        this.reportAssemblyError("Z0348", pragma); // Bar requires on/off
        return;
      }
    } else if (enabledValue.type === ExpressionValueType.Integer) {
      enabled = enabledValue.asLong() !== 0;
    } else {
      this.reportAssemblyError("Z0348", pragma);
      return;
    }

    this._output.nexConfig.loadingBar.enabled = enabled;

    if (pragma.color) {
      const colorValue = this.evaluateExprImmediate(pragma.color);
      if (colorValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      const color = colorValue.asLong();
      if (color < 0 || color > 255) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.color = color;
    }

    if (pragma.delay) {
      const delayValue = this.evaluateExprImmediate(pragma.delay);
      if (delayValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.delay = delayValue.asLong();
    }

    if (pragma.startDelay) {
      const startDelayValue = this.evaluateExprImmediate(pragma.startDelay);
      if (startDelayValue.type !== ExpressionValueType.Integer) {
        this.reportAssemblyError("Z0348", pragma);
        return;
      }
      this._output.nexConfig.loadingBar.startDelay = startDelayValue.asLong();
    }
  }

  // ---------------------------------------------------------------------------
  // DMA pragma emission helpers

  private isDmaNextModel(pragma: PartialAssemblyLine<Z80Node>): boolean {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0368", pragma as unknown as AssemblyLine<Z80Node>);
      return false;
    }
    return true;
  }

  private processDmaSimpleCommand(
    pragma: DmaResetPragma<Z80Node> | DmaLoadPragma<Z80Node> | DmaEnablePragma<Z80Node> | DmaDisablePragma<Z80Node> | DmaContinuePragma<Z80Node>,
    cmdByte: number
  ): void {
    if (!this.isDmaNextModel(pragma)) return;
    this.emitByte(cmdByte);
  }

  private processDmaCmdPragma(pragma: DmaCmdPragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    const value = this.evaluateExpr(pragma.value);
    if (value.isValid) {
      this.emitByte(value.value & 0xff);
    } else if (value.isNonEvaluated) {
      this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit8, pragma.value);
      this.emitByte(0x00);
    }
  }

  private processDmaReadMaskPragma(pragma: DmaReadMaskPragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    this.emitByte(0xbb);
    const value = this.evaluateExpr(pragma.mask);
    if (value.isValid) {
      this.emitByte(value.value & 0x7f);
    } else if (value.isNonEvaluated) {
      this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit8, pragma.mask);
      this.emitByte(0x00);
    }
  }

  private processDmaWr0Pragma(pragma: DmaWr0Pragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 0111_1DTT where D=direction, TT=transfer type
    // D6:D3 always 1111 — all follow bytes exist in the stream
    const dirBit = pragma.direction === "a_to_b" ? 0x04 : 0x00;
    let ttBits: number;
    switch (pragma.transferType) {
      case "transfer":        ttBits = 0x01; break;
      case "search":          ttBits = 0x02; break;
      case "search_transfer": ttBits = 0x03; break;
      default:                ttBits = 0x01; break;
    }
    const baseByte = 0x78 | dirBit | ttBits;
    this.emitByte(baseByte);

    if (pragma.portAAddr !== undefined) {
      const addr = this.evaluateExpr(pragma.portAAddr);
      if (addr.isValid) {
        this.emitByte(addr.value & 0xff);
        this.emitByte((addr.value >> 8) & 0xff);
      } else if (addr.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit16, pragma.portAAddr);
        this.emitByte(0x00);
        this.emitByte(0x00);
      }

      if (pragma.blockLength !== undefined) {
        const len = this.evaluateExpr(pragma.blockLength);
        if (len.isValid) {
          this.emitByte(len.value & 0xff);
          this.emitByte((len.value >> 8) & 0xff);
        } else if (len.isNonEvaluated) {
          this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit16, pragma.blockLength);
          this.emitByte(0x00);
          this.emitByte(0x00);
        }
      }
    }
  }

  private processDmaWr1Pragma(pragma: DmaWr1Pragma<Z80Node>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 0TAA_M100
    let baseByte = 0x04; // D2:D0 = 100 (WR1 identifier)
    if (pragma.portType === "io") baseByte |= 0x08;         // D3
    switch (pragma.addrMode) {
      case "increment": baseByte |= 0x10; break;            // D4
      case "fixed":     baseByte |= 0x20; break;            // D5
      // decrement: 0x00
    }
    if (pragma.cycleLength) baseByte |= 0x40;               // D6: timing byte follows
    this.emitByte(baseByte);

    if (pragma.cycleLength) {
      let timingByte = 0x00;
      switch (pragma.cycleLength) {
        case "4t": timingByte = 0x00; break;
        case "3t": timingByte = 0x01; break;
        case "2t": timingByte = 0x02; break;
      }
      this.emitByte(timingByte);
    }
  }

  private processDmaWr2Pragma(pragma: DmaWr2Pragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 0TAA_M000
    let baseByte = 0x00; // D2:D0 = 000 (WR2 identifier)
    if (pragma.portType === "io") baseByte |= 0x08;
    switch (pragma.addrMode) {
      case "increment": baseByte |= 0x10; break;
      case "fixed":     baseByte |= 0x20; break;
    }
    if (pragma.cycleLength || pragma.prescaler) baseByte |= 0x40;
    this.emitByte(baseByte);

    if (pragma.cycleLength || pragma.prescaler) {
      let timingByte = 0x00;
      if (pragma.cycleLength) {
        switch (pragma.cycleLength) {
          case "4t": timingByte = 0x00; break;
          case "3t": timingByte = 0x01; break;
          case "2t": timingByte = 0x02; break;
        }
      }
      if (pragma.prescaler) timingByte |= 0x20; // D5: prescaler byte follows
      this.emitByte(timingByte);

      if (pragma.prescaler) {
        const ps = this.evaluateExpr(pragma.prescaler);
        if (ps.isValid) {
          this.emitByte(ps.value & 0xff);
        } else if (ps.isNonEvaluated) {
          this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit8, pragma.prescaler);
          this.emitByte(0x00);
        }
      }
    }
  }

  private processDmaWr3Pragma(pragma: DmaWr3Pragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 1EIS_MK00
    let baseByte = 0x80; // D7=1, D1:D0=00 (WR3 identifier)
    if (pragma.dmaEnable)   baseByte |= 0x40; // D6
    if (pragma.intEnable)   baseByte |= 0x20; // D5
    if (pragma.match)       baseByte |= 0x10; // D4: match byte follows
    if (pragma.mask)        baseByte |= 0x08; // D3: mask byte follows
    if (pragma.stopOnMatch) baseByte |= 0x04; // D2
    this.emitByte(baseByte);

    if (pragma.mask) {
      const m = this.evaluateExpr(pragma.mask);
      if (m.isValid) {
        this.emitByte(m.value & 0xff);
      } else if (m.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit8, pragma.mask);
        this.emitByte(0x00);
      }
    }
    if (pragma.match) {
      const m = this.evaluateExpr(pragma.match);
      if (m.isValid) {
        this.emitByte(m.value & 0xff);
      } else if (m.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit8, pragma.match);
        this.emitByte(0x00);
      }
    }
  }

  private processDmaWr4Pragma(pragma: DmaWr4Pragma<Z80Node, Z80TokenType>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 1MM_IBA01 where D2=D3=1 (address follow bytes always present in stream)
    let baseByte = 0x81; // D7=1, D1:D0=01 (WR4 identifier), D2=D3=1
    switch (pragma.mode) {
      case "continuous": baseByte |= 0x20; break; // MM=01
      case "burst":      baseByte |= 0x40; break; // MM=10
      // byte: MM=00
    }
    baseByte |= 0x0c; // D3=1, D2=1: address follow bytes in stream
    this.emitByte(baseByte);

    if (pragma.portBAddr !== undefined) {
      const addr = this.evaluateExpr(pragma.portBAddr);
      if (addr.isValid) {
        this.emitByte(addr.value & 0xff);
        this.emitByte((addr.value >> 8) & 0xff);
      } else if (addr.isNonEvaluated) {
        this.recordFixup(pragma as unknown as AssemblyLine<Z80Node>, FixupType.Bit16, pragma.portBAddr);
        this.emitByte(0x00);
        this.emitByte(0x00);
      }
    }
  }

  private processDmaWr5Pragma(pragma: DmaWr5Pragma<Z80Node>): void {
    if (!this.isDmaNextModel(pragma)) return;
    // Base byte: 10R0_R010
    let baseByte = 0x82; // D7:D6=10, D2:D0=010 (WR5 identifier)
    if (pragma.autoRestart) baseByte |= 0x20; // D5
    this.emitByte(baseByte);
  }


  // ---------------------------------------------------------------------------
  // Copper pragma emission helpers (`dev/plans/COPPER_DEBUGGING_PLAN.md` §4.9)
  //
  // Copper words are big-endian (high byte first), as the Copper reads them:
  //   WAIT  1HHHHHHL LLLLLLLL   line 0..511, horizontal position 0..63
  //   MOVE  0RRRRRRR VVVVVVVV   NextReg $00..$7F (0 is a NOP), 8-bit value
  // An operand that is not yet known gets a `CopperWait`/`CopperMove` fixup (trap T6), which
  // patches only its own bits and applies the same range check as an immediate operand.

  private isCopperNextModel(pragma: PartialAssemblyLine<Z80Node>): boolean {
    if (!this.isNextModel()) {
      this.reportAssemblyError("Z0372", pragma as unknown as AssemblyLine<Z80Node>);
      return false;
    }
    return true;
  }

  /**
   * Checks one Copper operand's range; reports the error and returns false when it is out of range.
   * @param kind The fixup kind (`CopperWait` or `CopperMove`)
   * @param operand 0 for the first operand (line or register), 1 for the second (hpos or value)
   */
  private checkCopperOperand(
    sourceLine: PartialAssemblyLine<Z80Node>,
    kind: FixupType,
    operand: number,
    value: number
  ): boolean {
    if (kind === FixupType.CopperWait) {
      if (operand === 0 && (value < 0 || value > 511)) {
        this.reportAssemblyError("Z0373", sourceLine, null, value);
        return false;
      }
      if (operand === 1 && (value < 0 || value > 63)) {
        this.reportAssemblyError("Z0374", sourceLine, null, value);
        return false;
      }
    } else {
      // --- T7: never mask the register - `$80` would silently become a write to `$00`
      if (operand === 0 && (value < 0 || value > 0x7f)) {
        const shown = value < 0 ? `${value}` : `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
        this.reportAssemblyError("Z0375", sourceLine, null, shown);
        return false;
      }
      if (operand === 1 && (value < -128 || value > 0xff)) {
        this.reportAssemblyError("Z0376", sourceLine, null, value);
        return false;
      }
    }
    return true;
  }

  /**
   * Patches one Copper operand into the big-endian word at `offset`, touching only its bits
   */
  private patchCopperOperand(
    code: number[],
    offset: number,
    kind: FixupType,
    operand: number,
    value: number
  ): void {
    if (kind === FixupType.CopperWait) {
      if (operand === 0) {
        code[offset] = (code[offset] & 0xfe) | ((value >> 8) & 0x01);
        code[offset + 1] = value & 0xff;
      } else {
        code[offset] = (code[offset] & 0x81) | ((value & 0x3f) << 1);
      }
    } else {
      if (operand === 0) {
        code[offset] = (code[offset] & 0x80) | (value & 0x7f);
      } else {
        code[offset + 1] = value & 0xff;
      }
    }
  }

  /**
   * Evaluates one Copper operand. Returns its value, `null` when a fixup was recorded (the operand
   * is then emitted as zero bits), or `undefined` on an error.
   */
  private evalCopperOperand(
    pragma: PartialAssemblyLine<Z80Node>,
    expr: Expression<Z80Node, Z80TokenType>,
    kind: FixupType,
    operand: number
  ): number | null | undefined {
    const sourceLine = pragma as unknown as AssemblyLine<Z80Node>;
    const value = this.evaluateExpr(expr);
    if (value.isNonEvaluated) {
      this.recordFixup(sourceLine, kind, expr, null, null, null, operand);
      return null;
    }
    if (!value.isValid) return undefined;
    if (value.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z0603", sourceLine);
      return undefined;
    }
    const numeric = value.asLong();
    return this.checkCopperOperand(pragma, kind, operand, numeric) ? numeric : undefined;
  }

  /**
   * Emits one big-endian Copper word and records it for the debug info
   */
  private emitCopperWord(pragma: PartialAssemblyLine<Z80Node>, word: number): void {
    const sourceLine = pragma as unknown as AssemblyLine<Z80Node>;
    this.ensureCodeSegment();
    this._copperEmissions.push({
      segmentIndex: this._output.segments.length - 1,
      offset: this._currentSegment.currentOffset,
      address: this.getCurrentAssemblyAddress(),
      sourceLine
    });
    this.emitByte((word >> 8) & 0xff);
    this.emitByte(word & 0xff);
  }

  private processCopperTwoOperands(
    pragma: PartialAssemblyLine<Z80Node>,
    kind: FixupType,
    first: Expression<Z80Node, Z80TokenType>,
    second: Expression<Z80Node, Z80TokenType>,
    baseWord: number
  ): void {
    if (!this.isCopperNextModel(pragma)) return;
    // --- Both fixups (if any) are recorded before the word is emitted, so they point at it
    const a = this.evalCopperOperand(pragma, first, kind, 0);
    const b = this.evalCopperOperand(pragma, second, kind, 1);
    if (a === undefined || b === undefined) return;
    const code = [(baseWord >> 8) & 0xff, baseWord & 0xff];
    if (a !== null) this.patchCopperOperand(code, 0, kind, 0, a);
    if (b !== null) this.patchCopperOperand(code, 0, kind, 1, b);
    this.emitCopperWord(pragma, (code[0] << 8) | code[1]);
  }

  private processCopperWaitPragma(pragma: CopperWaitPragma<Z80Node, Z80TokenType>): void {
    this.processCopperTwoOperands(pragma, FixupType.CopperWait, pragma.waitLine, pragma.waitHpos, 0x8000);
  }

  private processCopperMovePragma(pragma: CopperMovePragma<Z80Node, Z80TokenType>): void {
    // --- `move 0, x` is legal (a NOP) and is emitted as written (T7)
    this.processCopperTwoOperands(pragma, FixupType.CopperMove, pragma.reg, pragma.value, 0x0000);
  }

  private processCopperFixedWord(
    pragma: CopperNopPragma<Z80Node> | CopperHaltPragma<Z80Node>,
    word: number
  ): void {
    if (!this.isCopperNextModel(pragma)) return;
    this.emitCopperWord(pragma, word);
  }

  private processCopperWordPragma(pragma: CopperWordPragma<Z80Node, Z80TokenType>): void {
    if (!this.isCopperNextModel(pragma)) return;
    const sourceLine = pragma as unknown as AssemblyLine<Z80Node>;
    const value = this.evaluateExpr(pragma.value);
    if (value.isNonEvaluated) {
      this.recordFixup(sourceLine, FixupType.Bit16Be, pragma.value);
      this.emitCopperWord(pragma, 0x0000);
      return;
    }
    if (!value.isValid) return;
    if (value.type === ExpressionValueType.String) {
      this.reportAssemblyError("Z0603", sourceLine);
      return;
    }
    this.emitCopperWord(pragma, value.asWord());
  }

  /**
   * Builds the output's `copperBlocks` from the emitted `.copper` words, after the fixups: a block
   * is a maximal run of words at consecutive offsets of one segment (nothing else emitted between).
   * Reports Z0377 for a block longer than the Copper's 1024 instructions.
   * @returns False if a block is too long
   */
  private collectCopperBlocks(): boolean {
    const blocks = this._output.copperBlocks;
    blocks.length = 0;
    let success = true;
    let current: CopperBlock | null = null;
    let first: CopperEmission | null = null;
    let prev: CopperEmission | null = null;
    const close = () => {
      if (current && current.length > 1024) {
        this.reportAssemblyError(
          "Z0377",
          first.sourceLine,
          null,
          `$${current.address.toString(16).toUpperCase().padStart(4, "0")}`,
          current.length
        );
        success = false;
      }
    };
    for (const emission of this._copperEmissions) {
      const code = this._output.segments[emission.segmentIndex]?.emittedCode;
      if (!code) continue;
      const word = ((code[emission.offset] & 0xff) << 8) | (code[emission.offset + 1] & 0xff);
      const contiguous =
        prev &&
        prev.segmentIndex === emission.segmentIndex &&
        prev.offset + 2 === emission.offset;
      if (!contiguous) {
        close();
        current = { address: emission.address, length: 0, entries: [] };
        first = emission;
        blocks.push(current);
      }
      current.entries.push({
        word,
        fileIndex: emission.sourceLine.fileIndex,
        line: emission.sourceLine.line
      });
      current.length++;
      prev = emission;
    }
    close();
    return success;
  }
}

/** A `.dma` line's bytes in a segment (NEXT_DMA_DEBUGGING_PLAN §10) */
type DmaEmission = {
  segmentIndex: number;
  offset: number;
  length: number;
  sourceLine: AssemblyLine<Z80Node>;
};

/** One `.copper` word as it was emitted: where it is, and which line produced it */
type CopperEmission = {
  segmentIndex: number;
  offset: number;
  address: number;
  sourceLine: AssemblyLine<Z80Node>;
};
