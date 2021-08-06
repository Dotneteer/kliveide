import { MachineCreationOptions } from "../core/vm-core-types";
import { ZxSpectrumCoreBase } from "./ZxSpectrumCoreBase";
import {
  ICustomDisassembler,
  IDisassemblyApi,
} from "../../../shared/z80/disassembler/custom-disassembly";
import {
  MemorySection,
  FetchResult,
  DisassemblyItem,
} from "../../../shared/z80/disassembler/disassembly-helper";

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
}

/**
 * Custom disassembler for the ZX Spectrum 48 model
 */
export class ZxSpectrum48CustomDisassembler implements ICustomDisassembler {
  private _api: IDisassemblyApi;

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
    // --- Nothing to do
  }

  /**
   * The disassembler is about to disassemble the subsequent instruction. The custom disassembler
   * can sign up to take the job.
   * @param peekResult The result of a peek(0) operation
   * @returns True, if the custom disassembler wants to disassemble the next instruction(s);
   * otherwise, false
   */
  beforeInstruction(fecthResult: FetchResult): boolean {
    // TODO: Implement this method
    return false;
  }

  /**
   * The disassembler decoded the subsequent instruction. The custom disassembler can change the
   * details of the disassembled item, or update its internal state accordingly
   * @param item Disassembled item
   */
  afterInstruction(item: DisassemblyItem): void {
    // TODO: Implement this method
  }
}
