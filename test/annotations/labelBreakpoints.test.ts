import { describe, it, expect, vi, beforeEach } from "vitest";

const getPartitionLabels = vi.fn();
const parsePartitionLabel = vi.fn();
vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({ getPartitionLabels, parsePartitionLabel })
}));

import { MF_BANK, MF_ROM, MI_SPECTRUM_128, MI_SPECTRUM_48, MI_ZX81 } from "@common/machines/constants";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import {
  resetActiveAnnotationSetForTests,
  setActiveAnnotationSet
} from "@renderer/appIde/annotations/activeAnnotationSet";
import { resetRomLayersForTests, setRomPartitions } from "@renderer/appIde/annotations/romAnnotations";
import type { RomPartitionInfo } from "@renderer/appIde/annotations/romAnnotationLoader";
import { compileCondition, bindCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
import { bankLocalSymbolKey } from "@common/utils/breakpoint-condition/condition-types";
import {
  mergedConditionSymbols,
  resetConditionSymbolsForTests,
  setRomConditionSymbols
} from "@renderer/appIde/utils/condition-symbols";
import {
  resolveLabelBreakpointsFor,
  withoutBanks
} from "@renderer/appIde/DocumentPanels/Next/nexLabelBreakpoints";
import { sp128BankSpace, zx8081BankSpace } from "@common/annotations/bankSpace";

/*
 * Breakpoints named by annotation labels on every machine
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.6, §5.5): `bp-set 7:Main`, `bp-set ROM:CLS`,
 * and `ROM:<name>` / `<bank>:<name>` in conditions.
 */

function contextFor(machineId: string): any {
  return {
    messenger: {},
    store: { getState: () => ({ emulatorState: { machineId } }) },
    service: {
      machineService: {
        getMachineInfo: () => ({ machine: { machineId, features: { [MF_ROM]: 2, [MF_BANK]: 8 } } })
      },
      projectService: { getBreakpointAddressInfo: () => undefined }
    }
  };
}

async function validate(addrSpec: string, machineId: string) {
  const args: any = { addrSpec };
  const messages = await new SetBreakpointCommand().validateCommandArgs(contextFor(machineId), args);
  return { args, errors: messages.filter((m) => m.type === ValidationMessageType.Error) };
}

const ROM_LAYERED = (partition: number): RomPartitionInfo => ({
  partition,
  source: { crc32: "ddee531f", size: 0x4000, path: "roms/sp48.rom", page: 0 },
  workingPath: "/home/Klive/RomAnnotations/sp48.rom.dis",
  workingPage: 0,
  hasWorkingCopy: true,
  bindings: [],
  layers: [
    {
      kind: "shipped",
      path: "roms/sp48.rom.dis",
      origin: "ROM: sp48.rom",
      page: 0,
      annotations: {
        schemaVersion: 3,
        machine: "rom",
        banks: {
          "0": {
            offsetIndex: 0,
            regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
            localLabels: [{ name: "CLS", value: 0x0d6b }]
          }
        }
      }
    }
  ]
});

beforeEach(() => {
  resetActiveAnnotationSetForTests();
  resetRomLayersForTests();
  resetConditionSymbolsForTests();
  getPartitionLabels.mockResolvedValue({ [-1]: "R0", [-2]: "R1", 0: "B0", 7: "B7" });
});

describe("bp-set with an annotation label", () => {
  it("anchors <bank>:<label> to the active set's label, case kept", async () => {
    setActiveAnnotationSet({ path: "/g/game.z80.dis", machine: "sp128", reason: "snapshot" });
    const { args, errors } = await validate("07:MainLoop", MI_SPECTRUM_128);
    expect(errors).toEqual([]);
    expect(args).toMatchObject({ label: "MainLoop", labelFile: "/g/game.z80.dis", bank: 7 });
  });

  it("refuses <bank>:<label> with no active annotation set", async () => {
    const { errors } = await validate("07:MainLoop", MI_SPECTRUM_128);
    expect(errors[0].message).toContain("No annotation set is active");
  });

  it("refuses a bank the machine does not have", async () => {
    setActiveAnnotationSet({ path: "/g/game.z80.dis", machine: "sp128", reason: "snapshot" });
    const { errors } = await validate("08:MainLoop", MI_SPECTRUM_128);
    expect(errors[0].message).toContain("Invalid bank");
  });

  it("resolves ROM:<name> now: the address, and the ROM partition on a machine that has them", async () => {
    setRomPartitions([ROM_LAYERED(-2)]);
    const on128 = await validate("ROM:CLS", MI_SPECTRUM_128);
    expect(on128.errors).toEqual([]);
    expect(on128.args).toMatchObject({ address: 0x0d6b, partition: -2 });

    setRomPartitions([ROM_LAYERED(-1)]);
    const on48 = await validate("rom:CLS", MI_SPECTRUM_48);
    expect(on48.errors).toEqual([]);
    expect(on48.args.address).toBe(0x0d6b);
    expect(on48.args.partition).toBeUndefined();
  });

  it("refuses an unknown ROM label", async () => {
    setRomPartitions([ROM_LAYERED(-1)]);
    const { errors } = await validate("ROM:NOPE", MI_SPECTRUM_48);
    expect(errors[0].message).toContain("No ROM label named NOPE");
  });

  it("keeps <partition>:<address> meaning what it did", async () => {
    parsePartitionLabel.mockResolvedValue(-2);
    const { args, errors } = await validate("R1:$0D6B", MI_SPECTRUM_128);
    expect(errors).toEqual([]);
    expect(args).toMatchObject({ partition: -2, address: 0x0d6b });
    expect(args.label).toBeUndefined();
  });
});

describe("label breakpoint resolution", () => {
  const annotations = {
    schemaVersion: 3,
    machine: "zx81" as const,
    banks: {
      "1": {
        offsetIndex: 1 as const,
        regions: [{ start: 0, end: 0x3fff, type: "disassemble" as const }],
        localLabels: [{ name: "Loop", value: 0x0082 }]
      }
    }
  };

  it("resolves a ZX81 bank label to its canonical address, partitionless (§4.7)", () => {
    const space = zx8081BankSpace("zx81", { ramKb: 16, rom8k: true });
    const [resolved] = resolveLabelBreakpointsFor(
      [{ label: "Loop", labelFile: "/p.dis", bank: 1, exec: true }],
      "/p.dis",
      annotations,
      space
    );
    expect(resolved.resolvedAddress).toBe(0x4082);
    expect(resolved.resolvedBank).toBeUndefined();
  });

  it("keeps a bank site on a banked machine", () => {
    expect(withoutBanks({ kind: "bank", bank: 7, bankOffset: 0x10 }, sp128BankSpace)).toEqual({
      kind: "bank",
      bank: 7,
      bankOffset: 0x10
    });
  });
});

describe("conditions", () => {
  it("reads ROM:<name> from the ROM's labels on any machine (§5.5)", () => {
    setRomConditionSymbols([{ name: "CLS", address: 0x0d6b }]);
    const facts = conditionMachineFacts(MI_SPECTRUM_48, {});
    const result = compileCondition("PC == ROM:CLS", { accessKind: "exec", ...facts, symbols: mergedConditionSymbols() });
    expect(result.errors).toEqual([]);
    bindCondition(result.compiled!, mergedConditionSymbols());
    expect(result.compiled!.inactiveReason).toBeUndefined();
  });

  it("reads <bank>:<name> on every bank-space machine, not the Next only", () => {
    const facts = conditionMachineFacts(MI_SPECTRUM_128, { [-1]: "R0", 7: "B7" });
    expect(facts.bankLabels).toBe(true);
    const result = compileCondition("HL == 07:Table", {
      accessKind: "exec",
      ...facts,
      symbols: { [bankLocalSymbolKey(7, "Table")]: 0x100 }
    });
    expect(result.errors).toEqual([]);
    expect(conditionMachineFacts(MI_ZX81, {}).bankLabels).toBe(true);
    expect(conditionMachineFacts("z88", {}).bankLabels).toBe(false);
  });
});
