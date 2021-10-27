import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { TestCpuApi, TestZ80Machine } from "../../src/extensions/cpu-z80/test-z80-machine";
import { importObject } from "./import-object";

const buffer = fs.readFileSync(path.join(__dirname, "../../build/tz80.wasm"));
let api: TestCpuApi;
let testMachine: TestZ80Machine;

describe("Extended ops 00-3f", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as TestCpuApi;
    testMachine = new TestZ80Machine(api);
  });

  beforeEach(() => {
    testMachine.reset();
  });

  for (let i = 0x00; i <= 0x3f; i++) {
    it(`${i < 16 ? "0" + i.toString(16) : i.toString(16)}: nop`, () => {
      let s = testMachine.initCode([0xed, i]);

      s = testMachine.run();

      testMachine.shouldKeepRegisters();
      testMachine.shouldKeepMemory();
      expect(s.pc).toBe(0x0002);
      expect(s.tacts).toBe(8);
    });
  }
});
