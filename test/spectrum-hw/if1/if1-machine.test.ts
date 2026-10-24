import { describe, expect, it } from "vitest";

import { MC_DIVMMC, MC_INTERFACE1, MI_SPECTRUM_128, MI_SPECTRUM_48 } from "@common/machines/constants";
import { hasInterface1, isInterface1Machine } from "@common/machines/interface1";
import { MEDIA_MICRODRIVE_1, MEDIA_MICRODRIVE_2 } from "@common/structs/project-const";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { IF1_ROM_FILE, MICRODRIVE_1_WP, MICRODRIVE_CHANGES, MICRODRIVE_UNSAVED } from "@emu/machines/machine-props";
import { createFormattedMdr, MDR_SLOT_SIZE, readMdrCatalog } from "@emu/machines/microdrive/mdrImage";
import type { ZxSpectrum48WasmV2Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine";
import type { ZxSpectrum128WasmV2Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine";
import { Sp48TestSession } from "../../harness/sp48";
import { createHarnessSpectrumMachine } from "../../harness/sp128";
import { runBasic, screenLines } from "./if1TestSupport";

/*
 * The Interface 1 on the machine classes (`.plans/MICRODRIVE_PLAN.md` Phase 3): the config connects
 * it with the shipped ROM, the media properties put cartridges into the drives, and the slots the
 * guest writes come back as `MICRODRIVE_CHANGES` for the controller to write to the `.mdr` files.
 */

async function sp48(config: Record<string, unknown> = { [MC_INTERFACE1]: true }) {
  const machine = (await createHarnessSpectrumMachine(MI_SPECTRUM_48, "pal", config)) as ZxSpectrum48WasmV2Machine;
  return { machine, s: new Sp48TestSession(machine) };
}

describe("which machines have the Interface 1", () => {
  it("the 48K and the 128K's own timing; not the Pentagon, the Scorpion, the +3 or the Timex", () => {
    expect(isInterface1Machine(MI_SPECTRUM_48)).toBe(true);
    expect(isInterface1Machine(MI_SPECTRUM_128, "sp128")).toBe(true);
    expect(isInterface1Machine(MI_SPECTRUM_128, "pentagon")).toBe(false);
    expect(isInterface1Machine("scorpion")).toBe(false);
    expect(isInterface1Machine("spp3e", "fdd1")).toBe(false);
    expect(isInterface1Machine("timex")).toBe(false);
    expect(hasInterface1(MI_SPECTRUM_48, "pal", { [MC_INTERFACE1]: true })).toBe(true);
    expect(hasInterface1(MI_SPECTRUM_48, "pal", {})).toBe(false);
  });
});

describe("Interface 1 on the machine classes", () => {
  it("the config connects it with the shipped v2 ROM", async () => {
    const { machine } = await sp48();
    expect(machine.if1.present).toBe(true);
    expect(machine.if1.edition).toBe("v2");
    expect(machine.if1.problem).toBeUndefined();
  }, 60_000);

  it("never together with the DivMMC: the DivMMC wins a config that names both (Q4)", async () => {
    const { machine } = await sp48({ [MC_INTERFACE1]: true, [MC_DIVMMC]: true });
    expect(machine.if1.present).toBe(false);
  }, 60_000);

  it("a user ROM of the wrong size leaves it off, saying why", async () => {
    const machine = (await createHarnessSpectrumMachine(MI_SPECTRUM_48, "pal", { [MC_INTERFACE1]: true })) as ZxSpectrum48WasmV2Machine;
    // --- The harness answers any path with the 16K Spectrum ROM
    machine.setMachineProperty(IF1_ROM_FILE, "/user/roms/not-an-if1.rom");
    await machine.setup();
    expect(machine.if1.present).toBe(false);
    expect(machine.if1.problem).toMatch(/must be 8192 bytes/);
  }, 60_000);

  it("a cartridge in, its writes out as MICRODRIVE_CHANGES, the same file again keeps them", async () => {
    const { machine, s } = await sp48();
    s.bootToBasic();
    const mdr = createFormattedMdr("TEST");
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, mdr);
    expect(machine.if1.bridge.drive(0)).toMatchObject({ inserted: true, slots: 254 });
    runBasic(s, `10 SAVE *"m";1;"prog"`, 600);
    expect(screenLines(s).at(-1)).toBe("0 OK, 10:1");

    const changes = machine.getMachineProperty(MICRODRIVE_CHANGES) as (SectorChanges | undefined)[];
    expect(changes[1]).toBeUndefined();
    const slots = [...changes[0]!.keys()];
    expect(slots.length).toBe(1);
    const cartridge = machine.if1.cartridge(0)!;
    expect(changes[0]!.get(slots[0])).toEqual(cartridge.subarray(slots[0] * MDR_SLOT_SIZE, (slots[0] + 1) * MDR_SLOT_SIZE));
    expect(readMdrCatalog(cartridge).files.map((f) => f.name)).toEqual(["prog"]);

    // --- The controller re-attaches stored media on every start: the same bytes keep the guest's writes
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, mdr);
    expect(readMdrCatalog(machine.if1.cartridge(0)!).files.map((f) => f.name)).toEqual(["prog"]);
    // --- New bytes replace the cartridge
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, createFormattedMdr("OTHER"));
    expect(readMdrCatalog(machine.if1.cartridge(0)!)).toMatchObject({ label: "OTHER", files: [] });
  }, 120_000);

  it("write protection and eject follow the properties", async () => {
    const { machine } = await sp48();
    machine.setMachineProperty(MICRODRIVE_1_WP, true);
    machine.setMachineProperty(MEDIA_MICRODRIVE_2, createFormattedMdr("B"));
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, createFormattedMdr("A"));
    expect(machine.if1.bridge.drive(0).writeProtected).toBe(true);
    expect(machine.if1.bridge.drive(1)).toMatchObject({ inserted: true, writeProtected: false });
    machine.setMachineProperty(MEDIA_MICRODRIVE_2, null);
    expect(machine.if1.bridge.drive(1).inserted).toBe(false);
  }, 60_000);

  it("after a state load the cartridges are detached: the guest's writes are reported unsaved", async () => {
    const { machine, s } = await sp48();
    s.bootToBasic();
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, createFormattedMdr("TEST"));
    const state = machine.saveMachineState();
    machine.loadMachineState(state);
    runBasic(s, `10 SAVE *"m";1;"prog"`, 600);
    expect(machine.getMachineProperty(MICRODRIVE_CHANGES)).toBeUndefined();
    expect(machine.getMachineProperty(MICRODRIVE_UNSAVED)).toEqual([true, false]);
  }, 120_000);

  it("a reverse-debugging fork republishes every slot of the inserted cartridge", async () => {
    const { machine } = await sp48();
    machine.setMachineProperty(MEDIA_MICRODRIVE_1, createFormattedMdr("TEST"));
    expect(machine.republishDisks()).toBe(true);
    const changes = machine.getMachineProperty(MICRODRIVE_CHANGES) as (SectorChanges | undefined)[];
    expect(changes[0]!.size).toBe(254);
  }, 60_000);

  it("the 128K names the paged ROM partition IF", async () => {
    const machine = (await createHarnessSpectrumMachine(MI_SPECTRUM_128, "sp128", { [MC_INTERFACE1]: true })) as ZxSpectrum128WasmV2Machine;
    expect(machine.if1.present).toBe(true);
    expect(machine.getPartitionLabels()[-4]).toBe("IF");
    expect(machine.parsePartitionLabel("if")).toBe(-4);
    machine.if1.bridge.setPaged(true);
    expect(machine.getCurrentPartitions()[0]).toBe(-4);
    expect(machine.getSelectedRomPage()).toBe(3);
    expect(machine.getMemoryPartition(-4)[0x0700]).toBe(0xc9);
    expect(machine.getMemoryPartition(-4)[0x2700]).toBe(0xc9);
  }, 60_000);
});
