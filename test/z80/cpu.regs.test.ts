import "mocha";
import * as fs from "fs";
import { CpuApi } from "../../src/native/api";

const buffer = fs.readFileSync("./build/spectrum.wasm");
let api: CpuApi;

describe("Z80 CPU register access", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, {
        imports: { trace: (arg: number) => console.log(arg) }
    });
    api = (wasm.instance.exports as unknown) as CpuApi;
  });

  beforeEach(() => {
    api.turnOnCpu();
  });

  it("Generate paper table", () => {
    const colors: number[] = [];
    for (let b = 0; b < 0x100; b++) {
      const paper = (b & 0x78) >> 3;
      const ink = (b & 0x07) | ((b & 0x40) >> 3);
      colors[b] = b & 0x80 ? paper : ink
    }
                        
    console.log(colors)
    let vals = "";
    for (let i=0; i < colors.length; i++) {
      const val = colors[i]
      vals += `\\${(val < 16 ? "0" : "") + val.toString(16)}`;
    }
    let result = `(data (i32.const 0x07_6000) "${vals}")`
    console.log(result);
  });

  it("Generate LD code", () => {
    let result = "";
    const regs = ["b", "c", "d", "e", "h", "l", "(hl)", "a"]
    for (let d = 0; d < 8; d++) {
      if (d === 6) continue;
      for (let s = 0; s < 8; s++) {
        if (s === 6 || s === d) continue;
        const code = 0x40 + 8 * d + s;
        result += `  ;; ld ${regs[d]},${regs[s]} (0x${code.toString(16)})\r\n`;
        result += `  (func $Ld${regs[d].toUpperCase()}${regs[s].toUpperCase()}\r\n`
        result += `    (call $set${regs[d].toUpperCase()} (call $get${regs[s].toUpperCase()}))\r\n`
        result += `  )\r\n\r\n`
      }
    }

    console.log(result);
  });

  it("Generate LD table", () => {
    let result = "";
    const regs = ["b", "c", "d", "e", "h", "l", "(hl)", "a"]
    for (let d = 0; d < 8; d++) {
      result += `    ;; 0x${(0x40 + 8*d).toString(16)}-0x${(0x40 + 8*d + 7).toString(16)}\r\n    `
      for (let s = 0; s < 8; s++) {
        if (d === 6 && s === 6) {
          result += "$Halt     "
        } else if (d === 6) {
          result += "$LdHLiQ   "
        } else if (s === 6) {
          result += "$LdQHLi   "
        } else if (d === s) {
          result += "$NOOP     ";
        } else {
          result += `$Ld${regs[d].toUpperCase()}${regs[s].toUpperCase()}     `;
        }
      }
      result += "\r\n";
    }
    console.log(result);
  });

});
