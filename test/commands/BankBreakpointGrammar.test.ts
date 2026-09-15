import { describe, it, expect, vi, beforeEach } from "vitest";
import { MI_ZXNEXT, MF_BANK, MF_ROM } from "@common/machines/constants";

const getPartitionLabels = vi.fn();
const parsePartitionLabel = vi.fn();

vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({ getPartitionLabels, parsePartitionLabel })
}));

import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

/**
 * `bp-set <bank>:+<offset>` — a bank-relative breakpoint: an offset inside a ZX Spectrum Next 16K
 * bank, firing wherever that bank happens to be paged.
 *
 * The `+` is what separates it from the absolute `<partition>:<address>` form. It is safe because no
 * address literal can begin with one, so no existing spelling changes meaning — which matters,
 * because `bp-set`'s grammar is public API that appears in the docs and in users' scripts
 * (`.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §2).
 */
function contextFor(machineId: string): any {
  return {
    messenger: {},
    service: {
      machineService: {
        getMachineInfo: () => ({
          machine: {
            machineId,
            features: { [MF_ROM]: 7, [MF_BANK]: 224 }
          }
        })
      },
      projectService: {
        getBreakpointAddressInfo: () => undefined
      }
    }
  };
}

async function validate(addrSpec: string, machineId = MI_ZXNEXT, options: any = {}) {
  const command = new SetBreakpointCommand();
  const args: any = { addrSpec, ...options };
  const messages = await command.validateCommandArgs(contextFor(machineId) as any, args);
  return { args, messages, errors: messages.filter((m) => m.type === ValidationMessageType.Error) };
}

describe("bp-set bank-relative grammar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPartitionLabels.mockResolvedValue({ 0: "00", 10: "0A" });
    parsePartitionLabel.mockResolvedValue(10);
  });

  it("parses a bank and a hex offset", async () => {
    const { args, errors } = await validate("05:+$0100");

    expect(errors).toEqual([]);
    expect(args.bank).toEqual(5);
    expect(args.bankOffset).toEqual(0x0100);
    // --- Not an absolute breakpoint: no address, and no partition either
    expect(args.address).toEqual(undefined);
    expect(args.partition).toEqual(undefined);
  });

  it("reads the bank as hex, not decimal", async () => {
    // --- The bank is a 16K bank number rendered as plain hex, matching the display key.
    const { args } = await validate("20:+$0000");
    expect(args.bank).toEqual(0x20);
  });

  it("accepts decimal and binary offsets, like every other address literal", async () => {
    expect((await validate("05:+256")).args.bankOffset).toEqual(256);
    expect((await validate("05:+%100000000")).args.bankOffset).toEqual(256);
  });

  it("accepts both ends of the offset range", async () => {
    expect((await validate("00:+$0000")).args.bankOffset).toEqual(0);
    expect((await validate("6F:+$3FFF")).args.bankOffset).toEqual(0x3fff);
  });

  it("does not disturb the absolute partition form", async () => {
    // --- `<partition>:<address>` still means what it always did, and still goes through the
    // --- partition label map.
    const { args, errors } = await validate("0A:$C000");

    expect(errors).toEqual([]);
    expect(args.partition).toEqual(10);
    expect(args.address).toEqual(0xc000);
    expect(args.bank).toEqual(undefined);
    expect(parsePartitionLabel).toHaveBeenCalled();
  });

  it("does not route the bank through the partition label map", async () => {
    // --- A bank is 16K; a partition index is an 8K page. Routing one through the other's names is
    // --- how the two index spaces got confused. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
    await validate("05:+$0100");
    expect(parsePartitionLabel).not.toHaveBeenCalled();
  });

  it("rejects an offset beyond the end of a 16K bank", async () => {
    const { errors } = await validate("05:+$4000");
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toContain("$0000 and $3FFF");
  });

  it("rejects a bank above the NEX maximum", async () => {
    const { errors } = await validate("70:+$0000");
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toContain("Invalid bank");
  });

  it("rejects a malformed offset", async () => {
    const { errors } = await validate("05:+zz");
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toContain("Invalid bank offset");
  });

  it("is refused on machines other than the ZX Spectrum Next", async () => {
    const { errors } = await validate("05:+$0100", "sp128");
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toContain("ZX Spectrum Next only");
  });

  it("is refused for I/O breakpoints, which watch a port and have no bank", async () => {
    const { errors } = await validate("05:+$0100", MI_ZXNEXT, { "-i": true });
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toContain("bank offset with I/O breakpoints");
  });
});
