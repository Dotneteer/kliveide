import type {
  CompilerOptions,
  IKliveCompiler,
  KliveCompilerOutput
} from "@abstractions/CompilerInfo";

import { Z80CompilerService } from "./z80-compiler-service";
import { InputStream } from "../compiler-common/input-stream";
import { TokenStream, Z80TokenType } from "./token-stream";
import { Z80AsmParser } from "./z80-asm-parser";
import { Z80Node } from "@main/z80-compiler/assembler-tree-nodes";
import { AppState } from "@common/state/AppState";

/**
 * Wraps the built-in Klive Z80 Compiler
 */
export class Z80Compiler implements IKliveCompiler {
  private _state: AppState;

  /**
   * The unique ID of the compiler
   */
  readonly id = "Z80Compiler";

  /**
   * Compiled language
   */
  readonly language = "kz80-asm";

  /**
   * Indicates if the compiler supports Klive compiler output
   */
  readonly providesKliveOutput = true;

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compileFile(filename: string, options?: Record<string, any>): Promise<KliveCompilerOutput> {
    const output = await new Z80CompilerService().compileFile(filename, options as CompilerOptions);
    return output;
  }

  /**
   * Checks if the specified file can have a breakpoint
   * @param line The line content to check
   */
  async lineCanHaveBreakpoint(line: string): Promise<boolean> {
    const is = new InputStream(line);
    const ts = new TokenStream<Z80TokenType>(is);
    const parser = new Z80AsmParser<Z80Node, Z80TokenType>(ts);
    const parsed = await parser.parseProgram();
    if (parser.errors.length > 0) {
      return false;
    }
    if (parsed.assemblyLines.length === 0) {
      return false;
    }
    const parsedLine = parsed.assemblyLines[0];
    return parsedLine && !restrictedNodes.includes(parsedLine.type as Z80Node["type"]);
  }

  get state(): AppState {
    return this._state;
  }

  /**
   * Optionally forwards the current state to the compiler
   * @param state State to forward to the compiler
   */
  setAppState(state: AppState): void {
    this._state = state;
  }
}

const restrictedNodes: Z80Node["type"][] = [
  "CommentOnlyLine",
  "LabelOnlyLine",
  "OrgPragma",
  "XorgPragma",
  "EntPragma",
  "XentPragma",
  "DispPragma",
  "BankPragma",
  "EquPragma",
  "VarPragma",
  "InjectOptPragma",
  "SkipPragma",
  "ExternPragma",
  "ModelPragma",
  "AlignPragma",
  "TracePragma",
  "RndSeedPragma",
  "ErrorPragma",
  "IncBinPragma",
  "CompareBinPragma",
  "OnSuccessPragma",
  "MacroStatement",
  "MacroEndStatement",
  "MacroParameter",
  "MacroParameterLine",
  "LoopStatement",
  "LoopEndStatement",
  "WhileStatement",
  "WhileEndStatement",
  "RepeatStatement",
  "UntilStatement",
  "ProcStatement",
  "ProcEndStatement",
  "IfStatement",
  "IfUsedStatement",
  "IfNUsedStatement",
  "ElseStatement",
  "ElseIfStatement",
  "EndIfStatement",
  "BreakStatement",
  "ContinueStatement",
  "ModuleStatement",
  "ModuleEndStatement",
  "StructStatement",
  "StructEndStatement",
  "ForStatement",
  "NextStatement",
  "IfDefDirective",
  "IfNDefDirective",
  "DefineDirective",
  "UndefDirective",
  "IfModDirective",
  "IfNModDirective",
  "EndIfDirective",
  "ElseDirective",
  "IfDirective",
  "IncludeDirective",
  "LineDirective"
];
