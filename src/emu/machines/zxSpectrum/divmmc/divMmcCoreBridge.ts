/*
 * The TypeScript side of the classic cores' DivMMC (`zx-spectrum-divmmc-classic.c`,
 * `.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md` C4). The 48K, 128K and +2A/+3 cores export the same
 * functions under their own prefix (`sp48DivMmcSetPresent`, ...), as the RZX module does;
 * `scripts/divmmc-classic-exports.cjs` keeps the build side of the list.
 *
 * `DivMmcSupport` is what a machine class delegates to: it connects the interface with the user's
 * esxDOS ROM, turns the SD card's sector requests into frame commands (the core stops its frame while
 * one waits, as the Next's does), answers them through the main process - the same `readSdCardSector`
 * / `writeSdCardSector` the Next uses, so the card is the one the SD card menu names - and keeps the
 * reverse-debugging undo log of the sectors it writes (REVERSE_DEBUGGING_PLAN D14).
 */

import type { MessengerBase } from "@common/messaging/MessengerBase";
import { createMainApi } from "@common/messaging/MainApi";
import { writeCoreBytes } from "@emu/machines/reverse/coreMemoryWrites";
import { revertSdWrites, type SdRevertResult, type SdUndoEntry, type SdUndoLog } from "@emu/machines/reverse/SdUndoLog";

/** The export names without the core's prefix */
export const DIVMMC_EXPORT_SUFFIXES = [
  "DivMmcSetPresent",
  "DivMmcGetPresent",
  "DivMmcMemoryPtr",
  "DivMmcMemorySize",
  "DivMmcPressNmi",
  "DivMmcGetPortE3",
  "DivMmcGetMapped",
  "DivMmcGetAutoMapActive",
  "DivMmcGetPageSource",
  "GetSdHostCommand",
  "GetSdHostSector",
  "GetSdWriteBufferPtr",
  "GetSdWriteBufferLength",
  "ClearSdHostCommand",
  "SetSdReadResponse",
  "SetSdWriteResponse",
  "SetSdCardInfo"
] as const;

export type DivMmcExportSuffix = (typeof DIVMMC_EXPORT_SUFFIXES)[number];

/** The DivMMC exports of a core with the given prefix */
export type DivMmcCoreExports<P extends string> = {
  [K in DivMmcExportSuffix as `${P}${K}`]: (...args: number[]) => number;
};

/** The DivMMC export names of a core, for its loader's required-export list */
export function divMmcCoreExportNames<P extends string>(prefix: P): `${P}${DivMmcExportSuffix}`[] {
  return DIVMMC_EXPORT_SUFFIXES.map((suffix) => `${prefix}${suffix}` as `${P}${DivMmcExportSuffix}`);
}

export type DivMmcCorePrefix = "sp48" | "sp128" | "spp3e";

/** The interface's ROM (esxDOS) */
export const DIVMMC_ROM_SIZE = 0x2000;
/** The ROM and its 16 RAM banks of 8K */
export const DIVMMC_MEMORY_SIZE = DIVMMC_ROM_SIZE + 16 * 0x2000;
export const DIVMMC_SECTOR_SIZE = 512;

/** The SD card's host commands (`zx-spectrum-sd.h`) */
const SD_HOST_READ = 1;
const SD_HOST_WRITE = 2;

/** A sector request the core waits for (the frame command the controller hands back) */
export type DivMmcFrameCommand =
  | { command: "divmmc-sd-read"; sector: number }
  | { command: "divmmc-sd-write"; sector: number; data: Uint8Array };

/** The partition labels of the DivMMC's memory while it is mapped (`DivMmcSupport.pagePartitions`) */
export const DIVMMC_ROM_PARTITION = -16;
export const DIVMMC_RAM_PARTITION_BASE = -32;

export function divMmcPartitionLabels(): Record<number, string> {
  const labels: Record<number, string> = { [DIVMMC_ROM_PARTITION]: "DR" };
  for (let bank = 0; bank < 16; bank++) labels[DIVMMC_RAM_PARTITION_BASE - bank] = `D${bank.toString(16).toUpperCase()}`;
  return labels;
}

type CoreFunctions = Record<string, (...args: number[]) => number>;

/** What the support needs from the machine */
export interface DivMmcMachineHost {
  /** The machine's core: its exports (undefined before `setup`) */
  getDivMmcRuntime(): { exports: object } | undefined;
  /** Reads a ROM file the user named (`loadRomFromResource`) */
  loadDivMmcRom(path: string): Promise<Uint8Array>;
  /** The card changed under every checkpoint the machine keeps (the Next drops them; optional) */
  invalidateCheckpoints?(): void;
}

export class DivMmcSupport {
  private frameCommand: DivMmcFrameCommand | undefined;
  private cardInfoLoaded = false;
  private undoLog?: SdUndoLog;
  /** Why the interface is not connected although the machine has it configured */
  problem?: string;

  constructor(
    readonly prefix: DivMmcCorePrefix,
    private readonly host: DivMmcMachineHost
  ) {}

  private get fns(): CoreFunctions | undefined {
    return this.host.getDivMmcRuntime()?.exports as CoreFunctions | undefined;
  }

  private call(suffix: DivMmcExportSuffix, ...args: number[]): number {
    const fn = this.fns?.[this.prefix + suffix];
    return typeof fn === "function" ? ((fn(...args) as number) ?? 0) : 0;
  }

  /** Does the core have the DivMMC at all (the Timex build of the 48K core has none)? */
  get available(): boolean {
    return typeof this.fns?.[`${this.prefix}DivMmcSetPresent`] === "function";
  }

  /** Is the interface connected? */
  get present(): boolean {
    return this.call("DivMmcGetPresent") !== 0;
  }

  /** Is its memory what the CPU sees at $0000-$3FFF now? */
  get mapped(): boolean {
    return this.call("DivMmcGetMapped") !== 0;
  }

  get portE3(): number {
    return this.call("DivMmcGetPortE3") & 0xff;
  }

  /** The core's DivMMC memory: the 8K ROM, then the 16 RAM banks */
  get memory(): Uint8Array | undefined {
    const runtime = this.host.getDivMmcRuntime() as { exports: { memory?: WebAssembly.Memory } } | undefined;
    const buffer = runtime?.exports.memory?.buffer;
    if (!buffer || !this.available) return undefined;
    return new Uint8Array(buffer, this.call("DivMmcMemoryPtr"), DIVMMC_MEMORY_SIZE);
  }

  /**
   * Connects the interface with the esxDOS ROM at `romPath` - or disconnects it (no path). A ROM that
   * cannot be read leaves it disconnected, with the reason in `problem`.
   */
  async connect(romPath: string | undefined): Promise<boolean> {
    this.problem = undefined;
    if (!this.available) return false;
    if (!romPath) {
      this.call("DivMmcSetPresent", 0);
      return false;
    }
    let rom: Uint8Array;
    try {
      rom = await this.host.loadDivMmcRom(romPath);
    } catch (err) {
      this.problem = `Cannot read the DivMMC ROM ${romPath}: ${(err as Error)?.message ?? err}`;
      this.call("DivMmcSetPresent", 0);
      return false;
    }
    if (rom.length !== DIVMMC_ROM_SIZE) {
      this.problem = `The DivMMC ROM must be ${DIVMMC_ROM_SIZE} bytes; ${romPath} has ${rom.length}`;
      this.call("DivMmcSetPresent", 0);
      return false;
    }
    this.uploadRom(rom);
    this.call("DivMmcSetPresent", 1);
    this.cardInfoLoaded = false;
    return true;
  }

  /** Puts the ROM into the core (also before a test connects it) */
  uploadRom(rom: Uint8Array): void {
    const memory = this.memory;
    if (!memory) return;
    memory.set(rom.subarray(0, DIVMMC_ROM_SIZE), 0);
  }

  /** The interface's button: an NMI, and the automap at $0066 */
  pressNmi(): void {
    this.call("DivMmcPressNmi");
  }

  /**
   * What the CPU sees in each 8K page of $0000-$3FFF while the DivMMC is mapped, as partitions
   * (`DIVMMC_ROM_PARTITION`, `DIVMMC_RAM_PARTITION_BASE - bank`); undefined for a page it does not map
   */
  pagePartitions(): [number | undefined, number | undefined] {
    const partitionOf = (page: number) => {
      const source = this.call("DivMmcGetPageSource", page);
      if (source === 0) return undefined;
      return source === 1 ? DIVMMC_ROM_PARTITION : DIVMMC_RAM_PARTITION_BASE - (source - 2);
    };
    return [partitionOf(0), partitionOf(1)];
  }

  /** A DivMMC partition's 8K, or undefined for another partition */
  partitionMemory(partition: number): Uint8Array | undefined {
    const memory = this.memory;
    if (!memory) return undefined;
    if (partition === DIVMMC_ROM_PARTITION) return memory.subarray(0, DIVMMC_ROM_SIZE);
    const bank = DIVMMC_RAM_PARTITION_BASE - partition;
    if (bank < 0 || bank > 15) return undefined;
    const start = DIVMMC_ROM_SIZE + bank * 0x2000;
    return memory.subarray(start, start + 0x2000);
  }

  // ----------------------------------------------------------------------------------------------
  // The SD card's sectors, as frame commands

  getFrameCommand(): DivMmcFrameCommand | undefined {
    return this.frameCommand;
  }

  setFrameCommand(command: unknown): void {
    this.frameCommand = (command ?? undefined) as DivMmcFrameCommand | undefined;
  }

  /** Is the core waiting for the host to answer the card? */
  get hostWaiting(): boolean {
    return this.present && this.call("GetSdHostCommand") !== 0;
  }

  /**
   * After the core ran: the request it stopped for, as the frame command (a copy the core no longer
   * waits for goes - a replay answered it from the journal)
   */
  syncFrameCommand(): DivMmcFrameCommand | undefined {
    const hostCommand = this.present ? this.call("GetSdHostCommand") : 0;
    if (hostCommand === 0) {
      this.frameCommand = undefined;
      return undefined;
    }
    if (this.frameCommand) return this.frameCommand;
    const sector = this.call("GetSdHostSector") >>> 0;
    if (hostCommand === SD_HOST_READ) {
      this.frameCommand = { command: "divmmc-sd-read", sector };
    } else if (hostCommand === SD_HOST_WRITE) {
      const runtime = this.host.getDivMmcRuntime() as { exports: { memory: WebAssembly.Memory } };
      const ptr = this.call("GetSdWriteBufferPtr");
      const length = this.call("GetSdWriteBufferLength");
      this.frameCommand = {
        command: "divmmc-sd-write",
        sector,
        data: new Uint8Array(runtime.exports.memory.buffer).slice(ptr, ptr + length)
      };
    }
    return this.frameCommand;
  }

  /** Does this command belong here? */
  handles(command: unknown): command is DivMmcFrameCommand {
    const name = (command as { command?: string } | undefined)?.command;
    return name === "divmmc-sd-read" || name === "divmmc-sd-write";
  }

  /** Answers the core's request through the main process */
  async processFrameCommand(messenger: MessengerBase): Promise<void> {
    const command = this.frameCommand;
    if (!command) return;
    const api = createMainApi(messenger);
    await this.ensureCardInfo(api);
    if (command.command === "divmmc-sd-read") {
      try {
        const data = await api.readSdCardSector(command.sector);
        this.answerRead(data instanceof Uint8Array ? data : new Uint8Array(data));
      } catch (err) {
        console.log("DivMMC SD card sector read error", err);
        this.answerRead(undefined);
      }
    } else {
      // --- The card is a host file: once written, no checkpoint taken before matches it (as the Next)
      this.host.invalidateCheckpoints?.();
      let success = false;
      try {
        if (this.undoLog) {
          let before: Uint8Array | undefined;
          try {
            const old = await api.readSdCardSector(command.sector);
            before = old instanceof Uint8Array ? old : new Uint8Array(old);
          } catch {
            before = undefined;
          }
          this.undoLog.record(0, command.sector, before);
        }
        const result = await api.writeSdCardSector(command.sector, command.data);
        success = !!result?.persistenceConfirmed;
      } catch (err) {
        console.log("DivMMC SD card sector write error", err);
      }
      this.answerWrite(success);
    }
    this.frameCommand = undefined;
  }

  /** The card's sector: data (journaled into the core) and the response; undefined answers an error */
  answerRead(data: Uint8Array | undefined): void {
    const runtime = this.host.getDivMmcRuntime() as { exports: { memory: WebAssembly.Memory } } | undefined;
    if (!runtime) return;
    const ptr = this.call("GetSdWriteBufferPtr");
    const view = new Uint8Array(runtime.exports.memory.buffer);
    const bytes = data ? data.slice(0, DIVMMC_SECTOR_SIZE) : Uint8Array.from([0x0d, 0xff, 0xff]);
    writeCoreBytes(runtime, view, bytes, ptr);
    this.call("SetSdReadResponse", ptr, bytes.length);
    this.call("ClearSdHostCommand");
  }

  answerWrite(success: boolean): void {
    this.call("SetSdWriteResponse", success ? 1 : 0);
    this.call("ClearSdHostCommand");
  }

  /** Tells the card its size once (the CSD the guest reads) */
  private async ensureCardInfo(api: ReturnType<typeof createMainApi>): Promise<void> {
    if (this.cardInfoLoaded) return;
    try {
      const info = await api.getSdCardInfo();
      this.call("SetSdCardInfo", info.totalSectors);
      this.cardInfoLoaded = true;
    } catch (err) {
      // --- No card (the image is missing or unreadable): the slot is empty, the bus reads $FF
      console.warn("DivMMC: no SD card image", err);
      this.call("SetSdCardInfo", 0);
      this.cardInfoLoaded = true;
    }
  }

  /** The card was swapped: its size is asked for again */
  cardChanged(): void {
    this.cardInfoLoaded = false;
  }

  // ----------------------------------------------------------------------------------------------
  // Reverse debugging (REVERSE_DEBUGGING_PLAN D14)

  attachSdUndoLog(log: SdUndoLog | undefined): void {
    this.undoLog = log;
  }

  async revertSdWrites(entries: readonly SdUndoEntry[], messenger: MessengerBase): Promise<SdRevertResult> {
    if (entries.length === 0) return { reverted: 0, failed: [] };
    this.host.invalidateCheckpoints?.();
    const api = createMainApi(messenger);
    return revertSdWrites(entries, {
      writeSector: async (_card, sector, data) => !!(await api.writeSdCardSector(sector, data))?.success
    });
  }
}
