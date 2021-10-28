import {
  CompilerMessage,
  CompilerOutput,
  CompilerResponseMessage,
} from "@abstractions/z80-compiler-service";
import { parentPort } from "worker_threads";
import { Z80Assembler } from "./assembler";
import { AssemblerOptions } from "./assembler-in-out";

parentPort.on("message", (data: CompilerMessage) => {
  const assembler = new Z80Assembler();
  switch (data.type) {
    case "Compile":
      parentPort.postMessage(<CompilerResponseMessage>{
        type: "CompileResult",
        correlationId: data.correlationId,
        result: assembler.compile(
          data.sourceText,
          data.options as AssemblerOptions
        ) as unknown as CompilerOutput,
      });
      break;
    case "CompileFile":
      parentPort.postMessage(<CompilerResponseMessage>{
        type: "CompileResult",
        correlationId: data.correlationId,
        result: assembler.compileFile(
          data.filename,
          data.options as AssemblerOptions
        ) as unknown as CompilerOutput,
      });
      break;
  }
});
