import {
  CompilerMessage,
  CompilerResponseMessage,
} from "@abstractions/z80-compiler-service";
import { parentPort } from "worker_threads";
import { Z80Assembler } from "./assembler";

console.log("Assembler worker initialized.");
const assembler = new Z80Assembler();

parentPort.on("message", (data: CompilerMessage) => {
  switch (data.type) {
    case "Compile":
      parentPort.postMessage(<CompilerResponseMessage>{
        type: "CompileResult",
        correlationId: data.correlationId,
        result: assembler.compile(data.sourceText, data.options),
      });
      break;
    case "CompileFile":
      parentPort.postMessage(<CompilerResponseMessage>{
        type: "CompileResult",
        correlationId: data.correlationId,
        result: assembler.compileFile(data.filename, data.options),
      });
      break;
  }
});
