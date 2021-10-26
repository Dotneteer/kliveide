import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  MachineCreationOptions,
} from "@abstractions/vm-core-types";
import { ZxSpectrumCoreBase } from "./ZxSpectrumCoreBase";
import {
  ICustomDisassembler,
  IDisassemblyApi,
} from "@ext/cpu-z80/custom-disassembly";
import {
  MemorySection,
  FetchResult,
  DisassemblyItem,
  intToX2,
  toSbyte,
  intToX4,
} from "@ext/cpu-z80/disassembly-helper";
import { FloatNumber } from "./FloatNumber";
import { calcOps } from "./calc-ops";
import { VirtualMachineToolBase } from "@ext-core/VitualMachineToolBase";

/**
 * ZX Spectrum 48 main execution cycle entry point
 */
const SP48_MAIN_ENTRY = 0x12ac;

/**
 * ZX Spectrum 48 core implementation
 */
export class ZxSpectrum48Core extends ZxSpectrumCoreBase {
  /**
   * Instantiates a core with the specified options
   * @param options Options to use with machine creation
   */
  constructor(options: MachineCreationOptions) {
    super(options);
  }

  /**
   * Gets the unique model identifier of the machine
   */
  readonly modelId = "sp48";

  /**
   * The name of the module file with the WA machine engine
   */
  readonly waModuleFile: string = "sp48.wasm";

  /**
   * Gets a unique identifier for the particular configuration of the model
   */
  get configurationId(): string {
    return this.modelId;
  }

  /**
   * Friendly name to display
   */
  readonly displayName = "ZX Spectrum 48K";

  /**
   * Prepares the engine for code injection
   * @param _model Model to run in the virtual machine
   */
  async prepareForInjection(_model: string): Promise<number> {
    const controller = this.controller;
    await controller.start(
      new ExecuteCycleOptions(
        EmulationMode.UntilExecutionPoint,
        DebugStepMode.None,
        0,
        SP48_MAIN_ENTRY
      )
    );
    await controller.waitForCycleTermination();
    return SP48_MAIN_ENTRY;
  }
}

/**
 * Represents the custom tools associated with ZX Spectrum 48
 */
export class ZxSpectrum48Tools extends VirtualMachineToolBase {
  /**
   * The virtual machine can provide its custom disassember
   * @returns The custom disassebler, if supported; otherwise, null
   */
  provideCustomDisassembler(): ICustomDisassembler | null {
    return new ZxSpectrum48CustomDisassembler();
  }
}

/**
 * Custom disassembler for the ZX Spectrum 48 model
 */
export class ZxSpectrum48CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;
  private _inRst08Mode = false;
  private _inRst28Mode = false;
  private _seriesCount = 0;

  /**
   * Klive passes the disassembly API to the custom disassembler
   * @param api
   */
  setDisassemblyApi(api: IDisassemblyApi): void {
    this._api = api;
  }

  /**
   * The disassembler starts disassembling a memory section
   * @param section
   */
  startSectionDisassembly(section: MemorySection): void {
    // --- No ZX Spectrum 48 specific code to disassemle
    this._inRst08Mode = false;
    this._inRst28Mode = false;
    this._seriesCount = 0;
  }

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(fecthResult: FetchResult): boolean {
    // --- Handle RST #08 byte code
    if (this._inRst08Mode) {
      const address = fecthResult.offset;
      const errorCode = this._api.fetch().opcode;
      this._inRst08Mode = false;
      this._api.addDisassemblyItem({
        address,
        instruction: `.defb $${intToX2(errorCode)}`,
        hardComment: `(error code: $${intToX2(errorCode)})`,
      });
      return true;
    }

    // --- Handle RST #28 byte codes
    if (this._inRst28Mode) {
      const address = fecthResult.offset;
      const calcCode = this._api.fetch().opcode;
      this.disassembleCalculatorEntry(address, calcCode);
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
    // --- Check for Spectrum 48K RST #08
    if (item.opCodes && item.opCodes.trim() === "CF") {
      this._inRst08Mode = true;
      item.hardComment = "(Report error)";
      return;
    }

    // --- Check for Spectrum 48K RST #28
    if (
      item.opCodes &&
      (item.opCodes.trim() === "EF" || // --- RST #28
        item.opCodes.trim() === "CD 5E 33" || // --- CALL 335E
        item.opCodes.trim() === "CD 62 33")
    ) {
      // --- CALL 3362
      this._inRst28Mode = true;
      this._seriesCount = 0;
      item.hardComment = "(Invoke Calculator)";
    }
  }

  /**
   * Disassemble a calculator entry
   * @param address Address of calculator entry
   * @param calcCode Calculator entry code
   */
  private disassembleCalculatorEntry(address: number, calcCode: number): void {
    // --- Create the default disassembly item
    const item: DisassemblyItem = {
      address,
      instruction: `.defb $${intToX2(calcCode)}`,
    };
    const opCodes: number[] = [calcCode];

    // --- If we're in series mode, obtain the subsequent series value
    if (this._seriesCount > 0) {
      let lenght = (calcCode >> 6) + 1;
      if ((calcCode & 0x3f) === 0) {
        lenght++;
      }
      for (let i = 0; i < lenght; i++) {
        const nextByte = this._api.fetch().opcode;
        opCodes.push(nextByte);
      }
      let instruction = ".defb ";
      for (let i = 0; i < opCodes.length; i++) {
        if (i > 0) {
          instruction += ", ";
        }
        instruction += `$${intToX2(opCodes[i])}`;
      }
      item.instruction = instruction;
      item.hardComment = `(${FloatNumber.FromCompactBytes(opCodes).toFixed(
        6
      )})`;
      this._seriesCount--;
      this._api.addDisassemblyItem(item);
      return;
    }

    // --- Generate the output according the calculation op code
    switch (calcCode) {
      case 0x00:
      case 0x33:
      case 0x35:
        const fetchValue = this._api.fetch();
        const jump = fetchValue.opcode;
        opCodes.push(jump);
        const jumpAddr = (fetchValue.offset - 1 + toSbyte(jump)) & 0xffff;
        this._api.createLabel(jumpAddr);
        item.instruction = `.defb $${intToX2(calcCode)}, $${intToX2(jump)}`;
        item.hardComment = `(${calcOps[calcCode]}: L${intToX4(jumpAddr)})`;
        this._inRst28Mode = calcCode !== 0x33;
        break;

      case 0x34:
        this._seriesCount = 1;
        item.hardComment = "(stk-data)";
        break;

      case 0x38:
        item.hardComment = "(end-calc)";
        this._inRst28Mode = false;
        break;

      case 0x86:
      case 0x88:
      case 0x8c:
        this._seriesCount = calcCode - 0x80;
        item.hardComment = `(series-0${(calcCode - 0x80).toString(16)})`;
        break;

      case 0xa0:
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
        const constNo = calcCode - 0xa0;
        item.hardComment = this.getIndexedCalcOp(0x3f, constNo);
        break;

      case 0xc0:
      case 0xc1:
      case 0xc2:
      case 0xc3:
      case 0xc4:
      case 0xc5:
        const stNo = calcCode - 0xc0;
        item.hardComment = this.getIndexedCalcOp(0x40, stNo);
        break;

      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3:
      case 0xe4:
      case 0xe5:
        const getNo = calcCode - 0xe0;
        item.hardComment = this.getIndexedCalcOp(0x41, getNo);
        break;

      default:
        const comment = calcOps[calcCode] ?? `calc code: $${intToX2(calcCode)}`;
        item.hardComment = `(${comment})`;
        break;
    }
    this._api.addDisassemblyItem(item);
  }

  /**
   * Gets the indexed operation
   * @param opCode operation code
   * @param index operation index
   */
  private getIndexedCalcOp(opCode: number, index: number): string {
    const ops = calcOps[opCode];
    if (ops) {
      const values = ops.split("|");
      if (index >= 0 && values.length > index) {
        return `(${values[index]})`;
      }
    }
    return `calc code: ${opCode}/${index}`;
  }
}
