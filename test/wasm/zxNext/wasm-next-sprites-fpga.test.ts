import type { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { defineSpriteFpgaTests } from "../../zxnext/sprite-fpga-scenarios";
import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

/* The WASM sprite engine against the FPGA. The scenarios and their reference model are shared. */
defineSpriteFpgaTests({
  name: "WASM",
  createMachine: () => createTestZxNextWasmMachine(),
  setNextReg: (machine, reg, value) =>
    (machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextSetNextRegisterDirect(reg, value),
  patternByte4: (machine, variant, cell) =>
    (machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetSpritePatternByte4(variant, cell),
  patternByte8: (machine, variant, cell) =>
    (machine as ZxNextWasmV2Machine).wasmV2Runtime!.exports.zxnextGetSpritePatternByte8(variant, cell)
});
