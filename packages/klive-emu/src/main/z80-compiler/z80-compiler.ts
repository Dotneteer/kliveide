import * as path from "path";
import { Worker } from "worker_threads";
import {
  CompilerRequestMessage,
  CompilerResponseMessage,
  IZ80CompilerService,
} from "@abstractions/z80-compiler-service";
import { AssemblerOptions, AssemblerOutput } from "./assembler-in-out";

import "worker-loader!./assembler.kliveworker.ts";
import { endCompileAction, startCompileAction } from "@state/compilation-reducer";
import { dispatch } from "@extensibility/service-registry";

/**
 * This class implements the operations of the Z80 Compiler service
 */
export class Z80CompilerService implements IZ80CompilerService {
  private _requestSeqNo = 0;
  private _worker: Worker;

  constructor() {
    this._worker = new Worker(
      path.resolve(path.join(__dirname, "main.bundle.worker.js"))
    );
    this._worker.on("message", (msg: CompilerResponseMessage) => {
      this.processResponse(msg);
    });
  }

  /**
   * Stores resolvers for
   */
  private _messageResolvers = new Map<
    number,
    (
      msg?: CompilerResponseMessage | PromiseLike<CompilerResponseMessage>
    ) => void
  >();

  /**
   * Sends out a message in a fire-and-forget fashion
   * @param message Message to send out
   */
  private postMessage(message: CompilerRequestMessage): void {
    this._worker.postMessage(message);
  }

  /**
   * Sends out a message and waits asynchronously for the response
   * @param message Message to send out
   * @returns Response for the message
   */
  async sendMessage<TResp extends CompilerResponseMessage>(
    message: CompilerRequestMessage
  ): Promise<TResp> {
    if (message.correlationId === undefined) {
      message.correlationId = this._requestSeqNo++;
    }
    const promise = new Promise<TResp>((resolve) => {
      this._messageResolvers.set(
        message.correlationId,
        resolve as (
          value: CompilerResponseMessage | PromiseLike<CompilerResponseMessage>
        ) => void
      );
    });
    this.postMessage(message);
    return promise;
  }

  /**
   * Processes the response that arrives back on the response channel
   * @param response Response to process
   */
  private processResponse(response: CompilerResponseMessage): void {
    const resolver = this._messageResolvers.get(response.correlationId);
    if (resolver) {
      resolver(response);
      this._messageResolvers.delete(response.correlationId);
    }
  }

  /**
   * Compiles the Z80 Assembly code in the specified file into Z80
   * binary code.
   * @param filename Z80 assembly source file (absolute path)
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compileFile(
    filename: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput> {
    dispatch(startCompileAction(filename));
    const response = await this.sendMessage<CompilerResponseMessage>({
      type: "CompileFile",
      filename,
      options,
    });
    dispatch(endCompileAction(response.result));
    return response.result;
  }

  /**
   * Compiles he passed Z80 Assembly code into Z80 binary code.
   * binary code.
   * @param sourceText Z80 assembly source code text
   * @param options Compiler options. If not defined, the compiler uses the default options.
   * @returns Output of the compilation
   */
  async compile(
    sourceText: string,
    options?: AssemblerOptions
  ): Promise<AssemblerOutput> {
    dispatch(startCompileAction(null));
    const response = await this.sendMessage<CompilerResponseMessage>({
      type: "Compile",
      sourceText,
      options,
    });
    dispatch(endCompileAction(response.result));
    return response.result;
  }
}
