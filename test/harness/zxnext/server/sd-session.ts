import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { nexSdCardTarget } from "@common/utils/nex-launch-paths";
import { CimFile } from "@main/fat32/CimFileManager";
import { CimHandler } from "@main/fat32/CimHandlers";
import { O_RDONLY } from "@main/fat32/Fat32Types";
import { Fat32Volume } from "@main/fat32/Fat32Volume";
import { FileManager } from "@main/fat32/FileManager";

/**
 * One emulated SD card for one browser run: a clone of the developer's `~/Klive/ks2.cim`.
 *
 * The page's machine reads and writes sectors (NextZXOS does write), and `.nex` files are copied onto
 * it, so it must never be the real image. Each session clones it (copy-on-write where the file system
 * supports it: the image is ~80 MB) into a temp folder that `dispose()` removes.
 *
 * The methods mirror `RendererToMainProcessor` - `readSdCardSector`, `writeSdCardSector`,
 * `getSdCardInfo`, `hasNextAutoExec`, `copyToSdCard` - using the same FAT32/CIM classes, so the
 * machine's own `processFrameCommand` and the app's launch flow run unchanged against it.
 */
export class SdSession {
  readonly id = randomUUID();
  readonly folder: string;
  readonly cardPath: string;
  private handler?: CimHandler;

  static readonly realCardPath = join(homedir(), "Klive", "ks2.cim");

  constructor() {
    if (!existsSync(SdSession.realCardPath)) {
      throw new Error(`No SD card image at ${SdSession.realCardPath}. Start the ZX Spectrum Next once in Klive to create it.`);
    }
    this.folder = mkdtempSync(join(tmpdir(), "klive-visual-sd-"));
    this.cardPath = join(this.folder, "ks2.cim");
    copyFileSync(SdSession.realCardPath, this.cardPath, constants.COPYFILE_FICLONE);
  }

  private get card(): CimHandler {
    this.handler ??= new CimHandler(this.cardPath);
    return this.handler;
  }

  private invalidate(): void {
    this.handler?.close();
    this.handler = undefined;
  }

  // --- The main-process API surface the machine and the launch flow call ---------------------------

  async readSdCardSector(sectorIndex: number): Promise<Uint8Array> {
    return this.card.readSector(sectorIndex);
  }

  async writeSdCardSector(sectorIndex: number, data: Uint8Array): Promise<{ success: boolean; persistenceConfirmed: boolean }> {
    this.card.writeSector(sectorIndex, data);
    return { success: true, persistenceConfirmed: true };
  }

  async getSdCardInfo(): Promise<{ totalSectors: number }> {
    const info = this.card.cimInfo;
    return { totalSectors: (info.maxSize * 2048) / info.sectorSize };
  }

  async hasNextAutoExec(): Promise<boolean> {
    return this.withVolume((vol) => vol.open("nextzxos/autoexec.1st", O_RDONLY) !== null);
  }

  /** Copies host bytes onto the card as `sdPath` (the `copyToSdCard` code path). */
  async copyBytesToSdCard(fileName: string, bytes: Uint8Array): Promise<string> {
    const staging = join(this.folder, "staging");
    mkdirSync(staging, { recursive: true });
    const hostPath = join(staging, fileName);
    writeFileSync(hostPath, bytes);
    const sdPath = nexSdCardTarget(hostPath);
    this.invalidate();
    const cim = new CimFile(this.cardPath);
    try {
      const vol = new Fat32Volume(cim);
      vol.init();
      await new FileManager(vol).copyFile(hostPath, sdPath);
    } finally {
      cim.close();
    }
    return sdPath;
  }

  private withVolume<T>(fn: (vol: Fat32Volume) => T): T {
    this.invalidate();
    const cim = new CimFile(this.cardPath);
    try {
      const vol = new Fat32Volume(cim);
      vol.init();
      return fn(vol);
    } finally {
      cim.close();
    }
  }

  dispose(): void {
    this.invalidate();
    rmSync(this.folder, { recursive: true, force: true });
  }

  static realCardMtime(): number {
    return statSync(SdSession.realCardPath).mtimeMs;
  }
}

/** Methods the page may call through the HTTP messenger; anything else is refused. */
export const MAIN_METHODS = new Set(["readSdCardSector", "writeSdCardSector", "getSdCardInfo", "hasNextAutoExec"]);
