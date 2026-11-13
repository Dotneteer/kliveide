import { MessengerBase } from "@messaging/MessengerBase";
import type { Channel, RequestMessage } from "@messaging/messages-core";

/*
 * An SD card - a flat image in memory, or any other `SdCardBacking` such as a CIM file - answering the
 * main-process API calls the machines make from `processFrameCommand` - `getSdCardInfo`, `readSdCardSector`, `writeSdCardSector` - the way
 * `RendererToMainProcessor` answers them from the CIM file in the app, and `server/sd-session.ts` from a
 * cloned card in the browser tier. The machine's own frame-command code runs unchanged against it.
 */

export const SD_SECTOR_BYTES = 512;

/** What an SD card needs to be: a sector count and sector access. */
export interface SdCardBacking {
  readonly totalSectors: number;
  readSector(sector: number): Uint8Array;
  writeSector(sector: number, data: Uint8Array): void;
}

/** A flat image in memory: a whole number of 512-byte sectors. */
export class MemorySdCard implements SdCardBacking {
  constructor(readonly image: Uint8Array) {
    if (image.length % SD_SECTOR_BYTES !== 0) throw new Error("An SD image is a whole number of 512-byte sectors.");
  }

  get totalSectors(): number {
    return this.image.length / SD_SECTOR_BYTES;
  }

  readSector(sector: number): Uint8Array {
    const out = new Uint8Array(SD_SECTOR_BYTES);
    if (sector < this.totalSectors) out.set(this.image.subarray(sector * SD_SECTOR_BYTES, (sector + 1) * SD_SECTOR_BYTES));
    return out;
  }

  writeSector(sector: number, data: Uint8Array): void {
    if (sector < this.totalSectors) this.image.set(data.subarray(0, SD_SECTOR_BYTES), sector * SD_SECTOR_BYTES);
  }
}

export class InMemorySdMessenger extends MessengerBase {
  /** Main-API calls made, by method. */
  readonly calls: Record<string, number> = {};

  /** The second card (card 1, a KS3's second reader); undefined is an empty slot */
  card2?: SdCardBacking;

  constructor(readonly card: SdCardBacking) {
    super();
  }

  /** The card a call names (its `card` argument, 0 when absent), or undefined for an empty slot 1 */
  private cardOf(index: unknown): SdCardBacking | undefined {
    return index === 1 ? this.card2 : this.card;
  }

  override async sendMessage(message: RequestMessage): Promise<any> {
    if (message.type !== "ApiMethodRequest") {
      return { type: "ErrorResponse", message: `InMemorySdMessenger only answers API calls (got ${message.type})` };
    }
    const { method, args } = message as unknown as { method: string; args: unknown[] };
    this.calls[method] = (this.calls[method] ?? 0) + 1;
    switch (method) {
      case "getSdCardInfo":
        return { type: "ApiMethodResponse", result: { totalSectors: this.cardOf(args[0])?.totalSectors ?? 0 } };
      case "readSdCardSector": {
        const card = this.cardOf(args[1]);
        return { type: "ApiMethodResponse", result: card ? card.readSector(args[0] as number) : new Uint8Array(SD_SECTOR_BYTES) };
      }
      case "writeSdCardSector": {
        const sector = args[0] as number;
        const card = this.cardOf(args[2]);
        if (!card || sector >= card.totalSectors) return { type: "ApiMethodResponse", result: { success: false, persistenceConfirmed: false } };
        card.writeSector(sector, args[1] as Uint8Array);
        return { type: "ApiMethodResponse", result: { success: true, persistenceConfirmed: true } };
      }
      default:
        return { type: "ErrorResponse", message: `InMemorySdMessenger does not answer ${method}` };
    }
  }

  protected send(): void {
    throw new Error("InMemorySdMessenger answers through sendMessage only");
  }

  get requestChannel(): Channel {
    return "harness-sd" as Channel;
  }

  get responseChannel(): Channel {
    return "harness-sd" as Channel;
  }
}
