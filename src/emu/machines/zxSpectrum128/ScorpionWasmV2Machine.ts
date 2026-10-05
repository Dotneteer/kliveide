import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { Sp128WasmV2LoaderOptions, Sp128WasmV2Runtime } from "./wasm/Sp128WasmV2Loader";

import { MI_SCORPION } from "@common/machines/constants";
import { SCORPION_ROM_FILE } from "../machine-props";
import { ZxSpectrum128WasmV2Machine } from "./ZxSpectrum128WasmV2Machine";
import { SCORPION_MODELS } from "./sp128Timings";

/** The Scorpion's ROM file: 64K, four 16K pages */
export const SCORPION_ROM_SIZE = 0x10000;

/*
 * The Scorpion's partitions (`.plans/TIMEX_SCORPION_PLAN.md` G9.4c): ROMs R0 (the 128K editor) -1,
 * R1 (48K BASIC) -2, R2 (the service monitor) -3, R3 (TR-DOS) -4; RAM banks B0-B15 0-15
 */
const ROM_LABELS: Record<number, string> = { [-1]: "R0", [-2]: "R1", [-3]: "R2", [-4]: "R3" };
const ROM_DESCRIPTIONS: Record<number, string> = {
  [-1]: "128K editor ROM",
  [-2]: "48K BASIC ROM",
  [-3]: "Service monitor ROM",
  [-4]: "TR-DOS ROM"
};

/**
 * The Scorpion ZS-256 (`.plans/TIMEX_SCORPION_PLAN.md` G9.4c): its own machine on the 128K core,
 * which the Scorpion's timing profile switches to the Scorpion: 256K of RAM in sixteen banks, the
 * second paging port $1FFD (RAM bank 0 or the service ROM at $0000, bank bit 3), the 48K's raster
 * without contention, and the Beta 128 built in.
 *
 * Its 64K ROM holds the 128K editor, 48K BASIC, the service monitor and TR-DOS. Klive cannot ship it
 * (plan P5): with the user's copy the machine boots it; without, it boots the 128K ROMs, reads $FF
 * where the service ROM would be, and takes TR-DOS from the TR-DOS ROM setting, as the Pentagon does.
 */
export class ScorpionWasmV2Machine extends ZxSpectrum128WasmV2Machine {
  public override readonly machineId: string = MI_SCORPION;
  /** Which ROMs the machine booted */
  romInUse: "scorpion" | "sp128" = "sp128";
  /** Why the Scorpion ROM named in the settings is not in use */
  scorpionRomProblem?: string;
  /** The Scorpion ROM's TR-DOS page, when the user's ROM is in use */
  private ownTrdos?: Uint8Array;
  /**
   * The tape device traps the 48K BASIC ROM's LD-BYTES and SA-BYTES. The Scorpion's 48K page is a
   * patched 48K ROM: the traps stay on only when its tape routines are byte for byte those of the
   * 48K BASIC ROM Klive ships ($04C2-$0604)
   */
  private tapeTrapsUsable = true;

  constructor(modelInfo?: MachineModel, config?: MachineConfigSet, loaderOptions?: Sp128WasmV2LoaderOptions) {
    super(modelInfo ?? SCORPION_MODELS[0], config, loaderOptions);
  }

  protected override async loadMachineRoms(): Promise<{
    rom0: Uint8Array;
    rom1: Uint8Array;
    service?: Uint8Array;
  }> {
    this.romInUse = "sp128";
    this.ownTrdos = undefined;
    this.scorpionRomProblem = undefined;
    const path = this.getMachineProperty(SCORPION_ROM_FILE) as string | undefined;
    if (path) {
      try {
        const rom = await this.loadRomFromResource(path);
        if (rom.length === SCORPION_ROM_SIZE) {
          this.romInUse = "scorpion";
          this.ownTrdos = rom.slice(0xc000, 0x10000);
          const basic48 = await this.loadRomFromResource("sp128", 1);
          this.tapeTrapsUsable = basic48
            .subarray(0x04c2, 0x0605)
            .every((b, i) => b === rom[0x4000 + 0x04c2 + i]);
          return { rom0: rom.slice(0, 0x4000), rom1: rom.slice(0x4000, 0x8000), service: rom.slice(0x8000, 0xc000) };
        }
        this.scorpionRomProblem = `The Scorpion ROM must be ${SCORPION_ROM_SIZE} bytes; ${path} has ${rom.length}`;
      } catch (err) {
        this.scorpionRomProblem = `Cannot read the Scorpion ROM ${path}: ${(err as Error)?.message ?? err}`;
      }
    }
    this.tapeTrapsUsable = true;
    // --- No service monitor without the Scorpion ROM: its page reads $FF
    return { ...(await super.loadMachineRoms()), service: new Uint8Array(0x4000).fill(0xff) };
  }

  protected override hardResetWasmV2(runtime: Sp128WasmV2Runtime): void {
    super.hardResetWasmV2(runtime);
    runtime.exports.sp128SetTapeTrapsEnabled(this.tapeTrapsUsable ? 1 : 0);
  }

  /** TR-DOS from the Scorpion's own ROM; otherwise from the TR-DOS ROM setting, as on the Pentagon */
  protected override async loadTrdosRomForBeta128(): Promise<void> {
    if (this.ownTrdos) {
      this.trdosRom = this.ownTrdos;
      this.trdosRomProblem = undefined;
      return;
    }
    await super.loadTrdosRomForBeta128();
  }

  // ==============================================================================================
  // Partitions

  override getPartitionLabels(): Record<number, string> {
    const labels: Record<number, string> = { ...ROM_LABELS };
    for (let bank = 0; bank < 16; bank++) labels[bank] = `B${bank}`;
    return labels;
  }

  override getPartitionDescriptions(): Record<number, string> {
    const descriptions: Record<number, string> = { ...ROM_DESCRIPTIONS };
    for (let bank = 0; bank < 16; bank++) descriptions[bank] = `Bank ${bank}`;
    return descriptions;
  }

  override parsePartitionLabel(label: string): number | undefined {
    const wanted = label.trim().toUpperCase();
    const found = Object.entries(this.getPartitionLabels()).find(([, l]) => l === wanted);
    return found ? Number(found[0]) : undefined;
  }

  override getMemoryPartition(index: number): Uint8Array {
    const runtime = this.requireWasmV2Runtime();
    if (index === -4) return this.trdosRom ?? new Uint8Array(0x4000).fill(0xff);
    if (index === -3) return runtime.rom.subarray(0x8000, 0xc000);
    if (index < 0) {
      const rom = index === -2 ? 1 : 0;
      return runtime.rom.subarray(rom * 0x4000, (rom + 1) * 0x4000);
    }
    const bank = index & 0x0f;
    return runtime.ram.subarray(bank * 0x4000, (bank + 1) * 0x4000);
  }

  /** One flag per 8K: ROM unless $1FFD put RAM bank 0 at $0000 */
  override getRomFlags(): boolean[] {
    const ramAtZero = (this.requireWasmV2Runtime().exports.sp128GetPort1ffd() & 0x01) !== 0;
    return [!ramAtZero, !ramAtZero, false, false, false, false, false, false];
  }

  override getSelectedRomPage(): number {
    const partition = this.getCurrentPartitions()[0];
    return partition < 0 ? -partition - 1 : 0;
  }

  /** $1FFD, the second paging port */
  getPort1ffd(): number {
    return this.requireWasmV2Runtime().exports.sp128GetPort1ffd();
  }

  // ==============================================================================================
  // Flows: the 128K's, on the 128K ROMs; the Scorpion ROM's own editor is a different program

  private requireKnownRom(): void {
    if (this.romInUse === "scorpion") {
      throw new Error(
        "Klive does not know the Scorpion ROM's editor, so it cannot start a program or a tape in it; load them by hand."
      );
    }
  }

  override async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    this.requireKnownRom();
    return super.getCodeInjectionFlow(model === MI_SCORPION ? "sp128" : model);
  }

  override getTapeLoadFlow(): CodeInjectionFlow {
    this.requireKnownRom();
    return super.getTapeLoadFlow();
  }

  /** TR-DOS boots the disk; the flow waits on the 128K ROMs' start-up menu */
  override getDiskBootFlow(): CodeInjectionFlow | undefined {
    this.requireKnownRom();
    return super.getDiskBootFlow();
  }
}
