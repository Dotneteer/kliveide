import type { MessengerBase } from "@common/messaging/MessengerBase";

import { createMainApi } from "@common/messaging/MainApi";
import type { EpHostFileStore } from "./EpHostFs";

/** The FILE: device's folder inside the Klive home folder, when the machine is given none */
export const EP_FILEIO_HOME_FOLDER = "FILEIO";

/**
 * FILE:'s files in a host folder, through the main process (`.plans/ENTERPRISE_PLAN.md` §9.2): the
 * folder the machine names (`EP_FILEIO_FOLDER`), or `FILEIO` in the Klive home folder. A name matches
 * as given, then in lower and in upper case (EXOS passes names as they were typed, and a host file
 * system may tell case apart).
 */
export class EpMainFileStore implements EpHostFileStore {
  constructor(
    private readonly messenger: MessengerBase,
    private readonly folder?: string
  ) {}

  private get api() {
    return createMainApi(this.messenger);
  }

  private async pathOf(name: string): Promise<string> {
    return this.folder ? `${this.folder}/${name}` : this.api.resolveKliveHomePath(`${EP_FILEIO_HOME_FOLDER}/${name}`);
  }

  private candidates(name: string): string[] {
    return [...new Set([name, name.toLowerCase(), name.toUpperCase()])];
  }

  async read(name: string): Promise<Uint8Array | undefined> {
    for (const candidate of this.candidates(name)) {
      try {
        return await this.api.readBinaryFile(await this.pathOf(candidate));
      } catch {
        /* the next spelling */
      }
    }
    return undefined;
  }

  async write(name: string, data: Uint8Array): Promise<void> {
    await this.api.saveBinaryFile(await this.pathOf(name), data);
  }

  async remove(name: string): Promise<boolean> {
    for (const candidate of this.candidates(name)) {
      try {
        await this.api.deleteFileEntry(false, await this.pathOf(candidate));
        return true;
      } catch {
        /* the next spelling */
      }
    }
    return false;
  }
}
