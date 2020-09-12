import "mocha";
import * as fs from "fs";
import * as path from "path";
import { CpuApi } from "../../src/native/api/api";
import { importObject } from "../import-object";

const buffer = fs.readFileSync(path.join(__dirname, "../../build/spectrum.wasm"));
let api: CpuApi;

describe("Z80 CPU register access", () => {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as CpuApi;
  });

  beforeEach(() => {
    api.turnOnCpu();
  });

});
