import * as fs from "fs";
import * as path from "path";

import { ErrorCodes, errorMessages, ParserErrorMessage } from "../errors";
import { InputStream } from "../parser/input-stream";
import { TokenStream } from "../parser/token-stream";

import {
  Directive,
  ExpressionNode,
  IncludeDirective,
  ModelPragma,
  PartialZ80AssemblyLine,
  Z80AssemblyLine,
} from "../parser/tree-nodes";
import { Z80AsmParser } from "../parser/z80-asm-parser";
import {
  AssemblerErrorInfo,
  AssemblerOptions,
  AssemblerOutput,
  SourceFileItem,
  SpectrumModelType,
} from "./assembler-in-out";
import { BinaryComparisonInfo } from "./assembler-types";
import { AssemblyModule } from "./assembly-module";
import { ExpressionValue } from "./expressions";

/**
 * The file name of a direct text compilation
 */
const NO_FILE_ITEM = "#";

/**
 * The valid Spectrum model values
 */
const VALID_MODELS = ["SPECTRUM48", "SPECTRUM128", "SPECTRUMP3", "NEXT"];

/**
 * This class provides the functionality of the Z80 Assembler
 */
export class Z80Assembler {
  // --- Use these options
  private _options: AssemblerOptions;

  // --- Store the current output
  private _output: AssemblerOutput;

  // --- The current module
  private _currentModule: AssemblyModule;

  /**
   * The condition symbols
   */
  conditionSymbols = new Set<string>();

  /**
   * Lines after running the preprocessor
   */
  preprocessedLines: Z80AssemblyLine[] = [];

  /**
   * .comparebin pragma information
   */
  compareBins: BinaryComparisonInfo[] = [];

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(filename: string, options?: AssemblerOptions): AssemblerOutput {
    const sourceText = fs.readFileSync(filename, "utf8");
    return this.doCompile(new SourceFileItem(filename), sourceText, options);
  }

  /**
   * Compiles he passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compile(sourceText: string, options?: AssemblerOptions): AssemblerOutput {
    return this.doCompile(
      new SourceFileItem(NO_FILE_ITEM),
      sourceText,
      options
    );
  }

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * @param sourceItem Represents the source file item to add to the output
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  private doCompile(
    sourceItem: SourceFileItem,
    sourceText: string,
    options?: AssemblerOptions
  ): AssemblerOutput {
    this._options = options ?? new AssemblerOptions();
    this.conditionSymbols = new Set<string>(this._options.predefinedSymbols);
    this._currentModule = this._output = new AssemblerOutput(
      sourceItem,
      options?.useCaseSensitiveSymbols ?? false
    );
    this.compareBins = [];

    // --- Execute the compilation phases
    const parseResult = this.executeParse(0, sourceItem, sourceText);
    if (parseResult.success) {
      this.preprocessedLines = parseResult.parsedLines;
    } else {
      this._output.segments.length = 0;
    }

    // --- Done
    return this._output;
  }

  // ==========================================================================
  // Main compilation methods

  /**
   * Parses the source code passed to the compiler. Executes the preprocessor.
   * @param fileIndex Source file index
   * @param sourceItem Source file item
   * @param sourceText Source code to parse
   * @returns An object with `success` property to indicate compilation success, and
   * a `parsedLines` property with all lines parsed.
   */
  private executeParse(
    fileIndex: number,
    sourceItem: SourceFileItem,
    sourceText: string
  ): {
    success: boolean;
    parsedLines?: Z80AssemblyLine[];
  } {
    // --- Initialize the parse result
    const parsedLines: Z80AssemblyLine[] = [];

    // --- Parse the main file
    const is = new InputStream(sourceText);
    const ts = new TokenStream(is);
    const parser = new Z80AsmParser(ts, fileIndex);
    const parsed = parser.parseProgram();

    // --- Collect syntax errors
    for (const error of parser.errors) {
      this.reportParserError(sourceItem, error);
    }

    // --- Exit if there are any errors
    if (parser.hasErrors) {
      return { success: false };
    }

    // --- Now, process directives and the .model pragma
    let currentLineIndex = 0;
    let ifdefStack: (boolean | null)[] = [];
    let processOps: ProcessOps = { ops: true };
    var anyProcessed = false;
    const visitedLines = parsed.assemblyLines;

    // --- Traverse through parsed lines
    while (currentLineIndex < visitedLines.length) {
      var line = visitedLines[currentLineIndex];
      switch (line.type) {
        case "ZxBasicPragma": {
          if (anyProcessed) {
            this.reportAssemblyError("Z2002", line);
            break;
          }

          this._options.useCaseSensitiveSymbols = true;
          this._options.procExplicitLocalsOnly = true;
          this._options.flexibleDefPragmas = true;
          this._currentModule = this._output = new AssemblerOutput(
            sourceItem,
            true
          );
          this._output.sourceType = "zxbasic";
          anyProcessed = true;
          break;
        }
        case "ModelPragma":
          this.processModelPragma((line as unknown) as ModelPragma);
          anyProcessed = true;
          break;
        case "IncludeDirective": {
          // --- Parse the included file
          const includedLines = this.applyIncludeDirective(
            (line as unknown) as IncludeDirective,
            sourceItem
          );
          if (includedLines.success && includedLines.lines) {
            // --- Add the parse result of the include file to the result
            parsedLines.push(...includedLines.lines);
            anyProcessed = true;
          }

          break;
        }
        case "LineDirective":
          // TODO: Process a #line directive
          break;
        default: {
          if (
            this.applyDirective(
              (line as unknown) as Directive,
              ifdefStack,
              processOps
            )
          ) {
            anyProcessed = true;
            break;
          }
          if (processOps.ops) {
            line.fileIndex = fileIndex;
            line.sourceText = sourceText.substr(
              line.startPosition,
              line.endPosition - line.startPosition + 1
            );
            parsedLines.push(line);
            anyProcessed = true;
          }

          break;
        }
      }
      currentLineIndex++;
    }

    // --- Check if all #if and #ifdef has a closing #endif tag
    if (ifdefStack.length > 0 && visitedLines.length > 0) {
      this.reportAssemblyError("Z2003", visitedLines[visitedLines.length - 1]);
    }

    // --- Done
    return {
      success: this._output.errorCount === 0,
      parsedLines,
    };
  }

  // ==========================================================================
  // Process directives

  /**
   * Apply the #include directive
   * @param includeDir
   * @param sourceItem
   */
  applyIncludeDirective(
    includeDir: IncludeDirective,
    sourceItem: SourceFileItem
  ): { success: boolean; lines?: Z80AssemblyLine[] } {
    const parsedLines: Z80AssemblyLine[] = [];

    // --- Check the #include directive
    let filename = includeDir.filename.trim();

    // --- Now, we have the file name, calculate the path
    if (sourceItem.filename !== NO_FILE_ITEM) {
      // --- The file name is taken into account as relative
      const dirname = path.dirname(sourceItem.filename) ?? "";
      filename = path.join(dirname, filename);
    }

    // --- Check for file existence
    if (!fs.existsSync(filename)) {
      this.reportAssemblyError("Z2004", includeDir, filename);
      return { success: false };
    }

    // --- Check for repetition
    var childItem = new SourceFileItem(filename);
    if (sourceItem.containsInIncludeList(childItem)) {
      this.reportAssemblyError("Z2005", includeDir, filename);
      return { success: false };
    }

    // --- Check for circular reference
    if (!sourceItem.include(childItem)) {
      this.reportAssemblyError("Z2006", includeDir, filename);
      return { success: false };
    }

    // --- Now, add the included item to the output
    this._output.sourceFileList.push(childItem);

    // --- Read the include file
    let sourceText: string;
    try {
      sourceText = fs.readFileSync(filename, "utf8");
    } catch (err) {
      this.reportAssemblyError("Z2007", includeDir, filename, err.toString());
      return { success: false };
    }

    // --- Parse the file
    return this.executeParse(
      this._output.sourceFileList.length - 1,
      childItem,
      sourceText
    );
  }

  /**
   * Apply the specified directive
   * @param directive Directive to apply
   * @param ifdefStack Stack if conditional directives
   * @param processOps Object with the "process operation" flag
   * @returns True, if the directive has been processed successfully
   */
  applyDirective(
    directive: Directive,
    ifdefStack: (boolean | null)[],
    processOps: ProcessOps
  ): boolean {
    const doProc = processOps.ops;
    switch (directive.type) {
      case "DefineDirective":
        if (doProc) {
          this.conditionSymbols.add(directive.identifier.name);
        }
        break;

      case "UndefDirective":
        if (doProc) {
          this.conditionSymbols.delete(directive.identifier.name);
        }
        break;

      case "IfDefDirective":
      case "IfNDefDirective":
      case "IfModDirective":
      case "IfNModDirective":
      case "IfDirective":
        if (doProc) {
          if (directive.type === "IfDirective") {
            const value = this.evalImmediate(
              (directive as unknown) as Z80AssemblyLine,
              directive.condition
            );
            // TODO: Update this
            processOps.ops = true; // value.isValid && value.Value !== 0;
          } else if (
            directive.type === "IfModDirective" ||
            directive.type === "IfNModDirective"
          ) {
            if (
              VALID_MODELS.indexOf(directive.identifier.name.toUpperCase()) < 0
            ) {
              this.reportAssemblyError("Z2008", directive);
              processOps.ops = false;
            } else {
              const refModel =
                this._output.modelType ?? this._options.currentModel;
              const modelName = SpectrumModelType[refModel].toUpperCase();
              const contains = modelName === directive.identifier.name;
              const negate = directive.type === "IfNModDirective";
              processOps.ops = (contains && !negate) || (!contains && negate);
            }
          } else {
            const contains = this.conditionSymbols.has(
              directive.identifier.name
            );
            const negate = directive.type === "IfNDefDirective";
            processOps.ops = (contains && !negate) || (!contains && negate);
          }
          ifdefStack.push(processOps.ops);
        } else {
          ifdefStack.push(null);
        }
        break;

      case "ElseDirective":
        if (ifdefStack.length === 0) {
          this.reportAssemblyError("Z2009", directive);
        } else {
          const peekVal = ifdefStack.pop();
          if (peekVal !== null) {
            processOps.ops = !peekVal;
            ifdefStack.push(processOps.ops);
          } else {
            ifdefStack.push(null);
          }
        }
        break;

      case "EndIfDirective":
        if (ifdefStack.length === 0) {
          this.reportAssemblyError("Z2010", directive);
        } else {
          ifdefStack.pop();
          processOps.ops =
            ifdefStack.length === 0 || ifdefStack[ifdefStack.length - 1];
        }
        break;

      default:
        return false;
    }
    return true;
  }

  // ==========================================================================
  // Process pragmas

  /**
   * Process the specified .model pragma
   * @param pragma Pragma to process
   */
  processModelPragma(pragma: ModelPragma): void {
    if (this._output.modelType) {
      this.reportAssemblyError("Z2011", pragma);
      return;
    }

    let modelType: SpectrumModelType;
    switch (pragma.modelId.toUpperCase()) {
      case "SPECTRUM48":
        modelType = SpectrumModelType.Spectrum48;
        break;
      case "SPECTRUM128":
        modelType = SpectrumModelType.Spectrum128;
        break;
      case "SPECTRUMP3":
        modelType = SpectrumModelType.SpectrumP3;
        break;
      case "NEXT":
        modelType = SpectrumModelType.Next;
        break;
      default:
        this.reportAssemblyError("Z2012", pragma);
        return;
    }
    this._output.modelType = modelType;
  }

  // ==========================================================================
  // Process Expressions

  evalImmediate(
    opLine: Z80AssemblyLine,
    expr: ExpressionNode
  ): ExpressionValue {
    throw new Error();
  }

  // ==========================================================================
  // Error reporting
  /**
   * Translates a parser error into an assembler error
   * @param sourceItem Source information to allow tracking the filename in which
   * the error occurred
   * @param error The error raised by the parser
   */
  private reportParserError(
    sourceItem: SourceFileItem,
    error: ParserErrorMessage
  ): void {
    const errorInfo = new AssemblerErrorInfo(
      error.code,
      sourceItem.filename,
      error.position,
      error.text
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(error.code);
  }

  /**
   * Reports an assembly error
   * @param code Error code
   * @param sourceLine Assembly line of the error
   * @param parameters Optional parameters to report
   */
  private reportAssemblyError(
    code: ErrorCodes,
    sourceLine: PartialZ80AssemblyLine,
    ...parameters: any[]
  ): void {
    if (!(sourceLine as any).fileIndex === undefined) {
      return;
    }
    const line = sourceLine as Z80AssemblyLine;
    const sourceItem = this._output.sourceFileList[line.fileIndex];
    let errorText: string = errorMessages[code] ?? "Unkonwn error";
    if (parameters) {
      parameters.forEach(
        (o, idx) =>
          (errorText = replace(
            errorText,
            `{{${idx}}}`,
            parameters[idx].toString()
          ))
      );
    }
    const errorInfo = new AssemblerErrorInfo(
      code,
      sourceItem.filename,
      line.startPosition,
      errorText
    );
    this._output.errors.push(errorInfo);
    this.reportScopeError(code);

    function replace(
      input: string,
      placeholder: string,
      replacement: string
    ): string {
      do {
        input = input.replace(placeholder, replacement);
      } while (input.includes(placeholder));
      return input;
    }
  }

  /**
   * Administer the error in the local scope
   * @param errorCode
   */
  private reportScopeError(errorCode: ErrorCodes): void {
    if (this._output.localScopes.length === 0) {
      // --- No local scopes, no administration
      return;
    }

    let localScope = this._output.localScopes[
      this._output.localScopes.length - 1
    ];
    if (localScope.ownerScope) {
      localScope = localScope.ownerScope;
    }
    localScope.reportError(errorCode);
  }
}

/**
 * Keep track of directive stack
 */
interface ProcessOps {
  ops: boolean;
}
