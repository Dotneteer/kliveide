import { describe, expect, it } from "vitest";
import { SysVarType, type SysVar } from "@abstractions/SysVar";
import {
  MemoryMap,
  MemorySection
} from "@renderer/appIde/disassemblers/common-types";
import {
  buildSysVarNameMap,
  chainOperandLabelResolvers,
  createSysVarOperandLabelResolver,
  sanitizeSysVarName
} from "@renderer/appIde/disassemblers/sys-var-operand-labels";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

const SYS_VARS: SysVar[] = [
  { address: 0x5c08, name: "LAST-K", type: SysVarType.Byte },
  { address: 0x5c0d, name: "K-DATA", type: SysVarType.Byte },
  { address: 0x5c0d, name: "TVDATA", type: SysVarType.Word },
  { address: 0x5c3a, name: "ERR NR", type: SysVarType.Byte },
  { address: 0x5c8d, name: "ATTR P", type: SysVarType.Byte }
];

describe("sanitizeSysVarName", () => {
  it("leaves a legal identifier alone", () => {
    expect(sanitizeSysVarName("TVDATA")).toBe("TVDATA");
    expect(sanitizeSysVarName("S_POSN1")).toBe("S_POSN1");
  });

  it("replaces spaces and hyphens", () => {
    expect(sanitizeSysVarName("ATTR P")).toBe("ATTR_P");
    expect(sanitizeSysVarName("CH-ADD")).toBe("CH_ADD");
    expect(sanitizeSysVarName("DF CCL")).toBe("DF_CCL");
  });
});

describe("buildSysVarNameMap", () => {
  it("keys sanitized names by address", () => {
    const names = buildSysVarNameMap(SYS_VARS);

    expect(names.get(0x5c08)).toBe("LAST_K");
    expect(names.get(0x5c3a)).toBe("ERR_NR");
    expect(names.get(0x5c8d)).toBe("ATTR_P");
  });

  it("keeps the first of two variables sharing an address", () => {
    expect(buildSysVarNameMap(SYS_VARS).get(0x5c0d)).toBe("K_DATA");
  });

  it("is empty for a machine that declares none", () => {
    expect(buildSysVarNameMap(undefined).size).toBe(0);
    expect(buildSysVarNameMap([]).size).toBe(0);
  });
});

describe("createSysVarOperandLabelResolver", () => {
  it("is undefined when the machine declares no variables", () => {
    expect(createSysVarOperandLabelResolver([])).toBeUndefined();
    expect(createSysVarOperandLabelResolver(undefined)).toBeUndefined();
  });

  it("names a data operand", () => {
    const resolve = createSysVarOperandLabelResolver(SYS_VARS)!;

    expect(resolve(operand({ pragma: "W", operandValue: 0x5c08 }))).toBe("LAST_K");
    expect(resolve(operand({ pragma: "w", operandValue: 0x5c08 }))).toBe("LAST_K");
  });

  it("declines a branch target", () => {
    const resolve = createSysVarOperandLabelResolver(SYS_VARS)!;

    expect(resolve(operand({ pragma: "L", operandValue: 0x5c08 }))).toBeUndefined();
  });

  it("declines an address that is not a system variable", () => {
    const resolve = createSysVarOperandLabelResolver(SYS_VARS)!;

    expect(resolve(operand({ pragma: "W", operandValue: 0x8000 }))).toBeUndefined();
  });
});

describe("chainOperandLabelResolvers", () => {
  it("is undefined when nothing is left after the absent ones are dropped", () => {
    expect(chainOperandLabelResolvers(undefined, undefined)).toBeUndefined();
  });

  it("returns the single resolver unwrapped", () => {
    const only = () => "Only";
    expect(chainOperandLabelResolvers(undefined, only, undefined)).toBe(only);
  });

  it("takes the first name offered", () => {
    const chained = chainOperandLabelResolvers(
      () => undefined,
      () => "Second",
      () => "Third"
    )!;

    expect(chained(operand({}))).toBe("Second");
  });

  it("declines when every resolver declines", () => {
    const chained = chainOperandLabelResolvers(
      () => undefined,
      () => undefined
    )!;

    expect(chained(operand({}))).toBeUndefined();
  });
});

describe("system variable names in a disassembly", () => {
  it("names the target of a 16-bit load", async () => {
    expect(await disassembleOne([0x21, 0x08, 0x5c])).toBe("ld hl,LAST_K");
  });

  it("names the target of a store", async () => {
    expect(await disassembleOne([0x32, 0x3a, 0x5c])).toBe("ld (ERR_NR),a");
    expect(await disassembleOne([0x22, 0x8d, 0x5c])).toBe("ld (ATTR_P),hl");
  });

  it("names a stack pointer load", async () => {
    expect(await disassembleOne([0x31, 0x08, 0x5c])).toBe("ld sp,LAST_K");
  });

  it("leaves a call to the same address as a label", async () => {
    expect(await disassembleOne([0xcd, 0x08, 0x5c])).toBe("call L5C08");
  });

  it("leaves an address that names nothing unchanged", async () => {
    expect(await disassembleOne([0x21, 0x34, 0x12])).toBe("ld hl,$1234");
  });
});

function operand(overrides: Record<string, unknown>) {
  return {
    instructionAddress: 0x0000,
    instructionOffset: 0x0000,
    operandIndex: 0,
    operandValue: 0x5c08,
    pragma: "W",
    defaultText: "$5C08",
    ...overrides
  } as any;
}

async function disassembleOne(opCodes: number[]): Promise<string | undefined> {
  const map = new MemoryMap();
  map.add(new MemorySection(0x0000, opCodes.length - 1));
  const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
    operandLabelResolver: createSysVarOperandLabelResolver(SYS_VARS)
  });
  const output = await disassembler.disassemble();
  return output?.outputItems[0].instruction;
}
