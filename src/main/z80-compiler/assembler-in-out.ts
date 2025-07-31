import path from "path";

import type { ErrorCodes } from "./assembler-errors";

import { SpectrumModelType } from "@abstractions/CompilerInfo";
import { AssemblyModule } from "./assembly-module";
import { IAssemblerErrorInfo, IBinarySegment, IFileLine, IListFileItem, ISourceFileItem, SourceMap, SymbolValueMap } from "@main/compiler-common/abstractions";
import { Z80Instruction } from "./assembler-tree-nodes";
import { Z80TokenType } from "./token-stream";

/**
 * This class represents the output of the Z80 assembler
 */
export class AssemblerOutput extends AssemblyModule<Z80Instruction, Z80TokenType> {
  constructor (
    public readonly sourceItem: SourceFileItem,
    caseSensitive: boolean
  ) {
    super(null, caseSensitive);
    this.sourceFileList = [sourceItem];
    this.sourceMap = {};
    this.addressMap = new Map<IFileLine, number[]>();
    this.listFileItems = [];
    this.injectOptions = {};
    this.traceOutput = [];
  }

  /**
   * The segments of the compilation output
   */
  readonly segments: IBinarySegment[] = [];

  /**
   * The errors found during the compilation
   */
  readonly errors: IAssemblerErrorInfo[] = [];

  /**
   * Number of errors
   */
  get errorCount (): number {
    return this.errors.length;
  }

  /**
   * The type of Spectrum model to use
   */
  modelType?: SpectrumModelType;

  /**
   * Entry address of the code
   */
  entryAddress?: number;

  /**
   * Entry address of the code to use when exporting it
   */
  exportEntryAddress?: number;

  /**
   * Inject options
   */
  injectOptions: Record<string, boolean> = {};

  /**
   * The commands to execute when the compilation is successful
   */
  onSuccessCommands: string[] = [];

  /**
   * The source files involved in this compilation, in
   * their file index order
   */
  readonly sourceFileList: ISourceFileItem[];

  /**
   * Source map information that assigns source file info with
   * the address
   */
  readonly sourceMap: SourceMap;

  /**
   * Source map information that assigns source file info with the address
   */
  readonly addressMap: Map<IFileLine, number[]>;

  /**
   * Items of the list file
   */
  readonly listFileItems: IListFileItem[];

  /**
   * Trace outputs
   */
  readonly traceOutput: string[];

  /**
   * Adds the specified information to the address map
   * @param fileIndex File index
   * @param line Source line number
   * @param address Address
   */
  addToAddressMap (fileIndex: number, line: number, address: number): void {
    const sourceInfo: IFileLine = { fileIndex, line };
    const addressList = this.addressMap.get(sourceInfo);
    if (addressList) {
      addressList.push(address);
    } else {
      this.addressMap.set(sourceInfo, [address]);
    }
  }
}

/**
 * A single segment of the code compilation
 */
export class BinarySegment implements IBinarySegment {
  /**
   * The bank of the segment
   */
  bank?: number;

  /**
   * Start offset used for banks
   */
  bankOffset: number;

  /**
   * Maximum code length of this segment
   */
  maxCodeLength?: number;

  /**
   * Start address of the compiled block
   */
  startAddress: number;

  /**
   * Optional displacement of this segment
   */
  displacement?: number;

  /**
   * The current assembly address when the .disp pragma was used
   */
  dispPragmaOffset?: number;

  /**
   * Intel hex start address of this segment
   */
  xorgValue?: number;

  /**
   * Emitted Z80 binary code
   */
  emittedCode: number[] = [];

  /**
   * Signs if segment overflow has been detected
   */
  overflowDetected: boolean = false;

  /**
   * Shows the offset of the instruction being compiled
   */
  currentInstructionOffset?: number;

  /**
   * The current code generation offset
   */
  get currentOffset (): number {
    return this.emittedCode.length;
  }

  /**
   * Emits the specified byte to the segment
   * @param data Byte to emit
   * @returns Null, if byte emitted; otherwise, error message
   */
  emitByte (data: number): ErrorCodes | null {
    this.emittedCode.push(data & 0xff);
    if (
      this.startAddress + this.emittedCode.length > 0x10000 &&
      !this.overflowDetected
    ) {
      this.overflowDetected = true;
      return "Z0410";
    }
    if (
      this.emittedCode.length > this.maxCodeLength &&
      !this.overflowDetected
    ) {
      this.overflowDetected = true;
      return "Z0411";
    }
    return null;
  }
}

/**
 * Represents a compilation error
 */
export class AssemblerErrorInfo implements IAssemblerErrorInfo {
  constructor (
    public readonly errorCode: ErrorCodes,
    public readonly filename: string,
    public readonly line: number,
    public readonly startPosition: number,
    public readonly endPosition: number | null,
    public readonly startColumn: number,
    public readonly endColumn: number | null,
    public readonly message: string,
    public readonly isWarning?: boolean
  ) {}
}

/**
 * Describes a source file item
 */
export class SourceFileItem implements ISourceFileItem {
  public readonly filename: string;

  constructor (filename: string) {
    this.filename = path.normalize(filename).replace(/\\/g, "/");
  }

  /**
   * Optional parent item
   */
  parent?: SourceFileItem;

  /**
   * Included files
   */
  readonly includes: SourceFileItem[] = [];

  /**
   * Adds the specified item to the "includes" list
   * @param childItem Included source file item
   * @returns True, if including the child item is OK;
   * False, if the inclusion would create a circular reference,
   * or the child is already is in the list
   */
  include (childItem: SourceFileItem): boolean {
    let current: SourceFileItem = this;
    while (current) {
      if (current.filename === childItem.filename) {
        return false;
      }
      current = current.parent;
    }
    if (this.containsInIncludeList(childItem)) {
      return false;
    }
    this.includes.push(childItem);
    childItem.parent = this;
    return true;
  }

  /**
   * Checks if this item already contains the specified child item in
   * its "includes" list
   * @param childItem Child item to check
   * @returns True, if this item contains the child item; otherwise, false
   */
  containsInIncludeList (childItem: SourceFileItem): boolean {
    return this.includes.some(c => c.filename === childItem.filename);
  }
}

/**
 * Represents the input options of the compiler
 */
export class AssemblerOptions {
  /**
   * Predefined compilation symbols
   */
  predefinedSymbols: SymbolValueMap = {};

  /**
   * The default start address of the compilation
   */
  defaultStartAddress?: number;

  /**
   * The current ZX Spectrum model
   */
  currentModel: SpectrumModelType = SpectrumModelType.Spectrum48;

  /**
   * The maximum number of errors to report within a loop
   */
  maxLoopErrorsToReport = 16;

  /**
   * Indicates that assembly symbols should be case sensitively.
   */
  useCaseSensitiveSymbols: boolean = false;

  /**
   * Allows flexible use of DEFx pragmas
   */
  flexibleDefPragmas: boolean = false;
}
