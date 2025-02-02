import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { calculateCRC7 } from "@emu/utils/crc";
import { BYTES_PER_SECTOR } from "@main/fat32/Fat32Types";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";

const READ_DELAY = 56;

export class SdCardDevice implements IGenericDevice<IZxNextMachine> {
  private _selectedCard: number;
  private _cid: Uint8Array;
  private _commandIndex: number;
  private _lastCommand: number;
  private _lastByteReceived: number;
  private _response: Uint8Array;
  private _responseIndex: number;
  private _ocr: Uint8Array;
  private _commandParams: number[];
  private _readCount: number;
  private _waitForBlock: boolean;
  private _blockToWrite: Uint8Array;
  private _dataIndex: number;
  constructor(public readonly machine: IZxNextMachine) {
    this.reset();
  }

  reset(): void {
    this._selectedCard = 0;
    this._cid = Uint8Array.from([
      0x01, // Manufacturer ID
      "K".charCodeAt(0), // Application ID (0)
      "l".charCodeAt(0), // Application ID (1)
      "i".charCodeAt(0), // Card name (0)
      "v".charCodeAt(0), // Card name (1)
      "e".charCodeAt(0), // Card name (2)
      "I".charCodeAt(0), // Card name (3)
      "D".charCodeAt(0), // Card name (4)
      "E".charCodeAt(0), // Card name (5)
      1, // Revision
      1, // Serial number
      2,
      3,
      4,
      127, // Manufacture date
      128 // CRC7
    ]);
    this._cid[15] = ((calculateCRC7(this._cid.slice(0, 15)) << 1) | 0x01) & 0xff;
    this._lastByteReceived = 0;
    this._commandIndex = 0;
    this._lastCommand = 0;
    this._response = new Uint8Array(0);
    this._responseIndex = -1;
    this._ocr = new Uint8Array([0x00, 0xc0, 0xff, 0x80, 0x00]);
    this._commandParams = [];
    this._readCount = 0;
    this._waitForBlock = false;
    this._blockToWrite = new Uint8Array(0);
    this._dataIndex = 0;
  }

  dispose(): void {}

  get selectedCard(): number {
    return this._selectedCard;
  }

  set selectedCard(value: number) {
    this._selectedCard = value === 0xfe ? 0 : 1;
  }

  get cid(): Uint8Array {
    return this._cid;
  }

  writeMmcData(data: number): void {
    // --- New command, we ignore the rest of the response
    this._responseIndex = -1;

    if (this._selectedCard) {
      // --- We can use only card 0
      return;
    }

    // --- Note the time of the last byte received
    this._lastByteReceived = this.machine.tacts;

    if (this._waitForBlock) {
      // --- We are waiting for a block to be written
      this._blockToWrite[this._dataIndex++] = data;
      if (this._dataIndex === this._blockToWrite.length) {
        this._waitForBlock = false;
        this._responseIndex = 0;

        // --- Sector to write
        const sectorIndex =
          (this._commandParams[0] << 24) |
          (this._commandParams[1] << 16) |
          (this._commandParams[2] << 8) |
          this._commandParams[3];

        // --- Read the specified sector and prepare the response
        const sectorData = this._blockToWrite.slice(1, 1 + BYTES_PER_SECTOR);
        this.machine.cimHandler.writeSector(sectorIndex, sectorData);
        this._response = new Uint8Array([0x05, 0xff, 0xfe]);
        this._responseIndex = 0;
      }
      return;
    }

    if (this._commandIndex === 0) {
      // --- We have just received the command byte
      this._lastCommand = data;
      this._commandParams = [];
      this._commandIndex = 1;
      return;
    }

    // --- Subsequent command byte
    switch (this._lastCommand) {
      case 0x40:
        // --- CMD0: GO_IDLE_STATE
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._response = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff]);
          this._responseIndex = 0;
        } else {
          this._commandIndex++;
        }
        break;

      case 0x49:
        // --- CMD9: SEND_CSD
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._response = new Uint8Array([
            0x00, 0xfe, 0x40, 0x00, 0x00, 0x5b, 0x50, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0xff, 0xff, 0xff
          ]);
          this._responseIndex = 0;
        } else {
          this._commandIndex++;
        }
        break;

      case 0x4c:
        // --- CMD12: STOP_TRANSMISSION
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._response = new Uint8Array([0x04, 0xff, 0xff, 0xff, 0xff]);
          this._responseIndex = 0;
        } else {
          this._commandIndex++;
        }
        break;

      case 0x48:
        // --- CMD8: SEND_EXT_CSD
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._response = new Uint8Array([0x01, 0x00, 0x00, 0x01, 0xaa]);
          this._responseIndex = 0;
        } else {
          this._commandIndex++;
        }
        break;

      case 0x51:
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;

          // --- Sector to read
          const sectorIndex =
            (this._commandParams[0] << 24) |
            (this._commandParams[1] << 16) |
            (this._commandParams[2] << 8) |
            this._commandParams[3];

          // --- Read the specified sector and prepare the response
          const baseSector = this.machine.cimHandler.readSector(sectorIndex);
          const response = new Uint8Array(3 + BYTES_PER_SECTOR);
          response.set(new Uint8Array([0x00, 0xff, 0xfe]));
          response.set(baseSector, 3);
          this._readCount++;
          this._response = response;
          this._responseIndex = 0;
        }
        break;

      case 0x58:
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          this._waitForBlock = true;
          this._blockToWrite = new Uint8Array(3 + BYTES_PER_SECTOR);
          this._dataIndex = 0;
          this._readCount++;
          this._response = new Uint8Array([0xff, 0x00]);
          this._responseIndex = 0;
        }
        break;

      case 0x69:
        // --- CMD41: Send operation condition
        this._commandIndex = 0;
        break;

      case 0x77:
        // --- CMD55: Application specific command
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._responseIndex = -1;
        } else {
          this._commandIndex++;
        }
        break;

      case 0x7a:
        // --- CMD58: Read OCR
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._response = this._ocr;
          this._responseIndex = 0;
        } else {
          this._commandIndex++;
        }
        break;

      default:
        this._commandIndex = 0;
        console.log(`Unknown MMC command: ${this._lastCommand} at ${toHexa4(this.machine.pc)}`);
        break;
    }
  }

  readMmcData(): number {
    if (this._selectedCard !== 0) {
      // --- We can use only card 0
      return 0xff;
    }

    const now = this.machine.tacts;
    if (now - this._lastByteReceived < READ_DELAY) {
      // --- We are still waiting for result
      return 0xff;
    }

    if (this._responseIndex >= 0 && this._responseIndex < this._response.length) {
      return this._response[this._responseIndex++];
    }

    switch (this._lastCommand) {
      case 0x51:
      case 0x77:
        return 0xff;
    }

    // --- No result
    return 0x00;
  }
}
