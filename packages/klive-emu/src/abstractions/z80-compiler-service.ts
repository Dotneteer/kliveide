import { ILiteEvent } from "@shared/utils/LiteEvent";
import { CompilationState } from "@state/AppState";
import {
  AssemblerOptions,
  AssemblerOutput,
} from "../main/z80-compiler/assembler-in-out";

/**
 * Definition of base compiler messages including requests and responses
 */
export interface CompilerMessageBase {
  type: CompilerMessage["type"];
  correlationId?: number;
}

/**
 * Ask the compiler to compile a source file
 */
export interface CompileFileMessage extends CompilerMessageBase {
  type: "CompileFile";
  filename: string;
  options?: AssemblerOptions;
}

/**
 * Ask the compiler to compile the specified source text
 */
export interface CompileSourceMessage extends CompilerMessageBase {
  type: "Compile";
  sourceText: string;
  options?: AssemblerOptions;
}

/**
 * All compiler requests
 */
export type CompilerRequestMessage = CompileFileMessage | CompileSourceMessage;

/**
 * Result of the assembler call
 */
export interface AssemblerOutputResponse extends CompilerMessageBase {
  type: "CompileResult";
  result: AssemblerOutput;
}

/**
 * All compiler responses
 */
export type CompilerResponseMessage = AssemblerOutputResponse;

/**
 * Defines the messages the compiler accepts
 */
export type CompilerMessage = CompilerRequestMessage | CompilerResponseMessage;

/**
 * This interface defines the operations of the Z80 Compiler service
 */
export interface IZ80CompilerService {
  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compileFile(
    filename: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput>;

  /**
   * Compiles the passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  compile(
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput>;
}
