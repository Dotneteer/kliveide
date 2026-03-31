import type { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { calculateCRC7, calculateCRC16 } from "@emu/utils/crc";
import { BYTES_PER_SECTOR } from "@main/fat32/Fat32Types";
import type { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

const READ_DELAY = 56;

// SD card state machine — matches SD Physical Layer Spec Table 4-1
const enum SdState {
  IDLE,
  READY,
  TRAN,
  DATA,
  WRITE_WAITFE, // waiting for 0xFE data-start token from host
  WRITE_DATA    // receiving data block bytes + 2 CRC bytes
}

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
  private _state: SdState;
  private _blockToWrite: Uint8Array;
  private _dataIndex: number;
  private _bACMD: boolean;
  // Tracks whether an IPC-backed response is ready to be read by the Z80
  private _responseReady: boolean;

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
    this._responseReady = false;
    this._ocr = new Uint8Array([0x00, 0xc0, 0xff, 0x80, 0x00]);
    this._commandParams = [];
    this._state = SdState.IDLE;
    this._blockToWrite = new Uint8Array(0);
    this._dataIndex = 0;
    this._bACMD = false;
  }

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
    // Every incoming byte interrupts any pending response read
    this._responseIndex = -1;
    this._responseReady = false;

    if (this._selectedCard) {
      // We can use only card 0
      return;
    }

    this._lastByteReceived = this.machine.tacts;

    // --- WRITE_WAITFE: waiting for the 0xFE data-start token from the host
    if (this._state === SdState.WRITE_WAITFE) {
      if (data === 0xfe) {
        this._state = SdState.WRITE_DATA;
        // Receive 512 data bytes + 2 CRC bytes
        this._blockToWrite = new Uint8Array(BYTES_PER_SECTOR + 2);
        this._dataIndex = 0;
      }
      // Ignore any byte other than the start token
      return;
    }

    // --- WRITE_DATA: accumulating sector data + CRC
    if (this._state === SdState.WRITE_DATA) {
      this._blockToWrite[this._dataIndex++] = data;
      if (this._dataIndex === this._blockToWrite.length) {
        this._state = SdState.TRAN;
        const sectorIndex =
          (this._commandParams[0] << 24) |
          (this._commandParams[1] << 16) |
          (this._commandParams[2] << 8) |
          this._commandParams[3];
        // Send only the 512 data bytes (not the 2 trailing CRC bytes) to storage
        this.machine.setFrameCommand({
          command: "sd-write",
          sector: sectorIndex,
          data: this._blockToWrite.slice(0, BYTES_PER_SECTOR)
        });
        // Response not ready yet — waiting for IPC round-trip
        this._responseReady = false;
      }
      return;
    }

    // --- Command byte reception
    if (this._commandIndex === 0) {
      this._lastCommand = data;
      this._commandParams = [];
      this._commandIndex = 1;
      return;
    }

    // --- Subsequent command bytes (arg[0..3] + CRC)
    switch (this._lastCommand) {
      case 0x40:
        // CMD0: GO_IDLE_STATE — R1 = 0x01 (idle)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._state = SdState.IDLE;
          this.setMmcResponse(new Uint8Array([0x01]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x41:
        // CMD1: SEND_OP_COND — R1 = 0x00 (ready)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._state = SdState.READY;
          this.setMmcResponse(new Uint8Array([0x00]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x48:
        // CMD8: SEND_IF_COND — R7 (voltage + check pattern echo)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(new Uint8Array([0x01, 0x00, 0x00, 0x01, 0xaa]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x49:
        // CMD9: SEND_CSD — R1 + token + 16-byte CSD + 2 dummy CRC bytes
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(
            new Uint8Array([
              0x00, 0xfe, 0x40, 0x00, 0x00, 0x5b, 0x50, 0x09, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
              0x00, 0x00, 0x00, 0xff, 0xff, 0xff
            ])
          );
        } else {
          this._commandIndex++;
        }
        break;

      case 0x4c:
        // CMD12: STOP_TRANSMISSION — R1 = 0x00
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(new Uint8Array([0x00]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x4d:
        // CMD13: SEND_STATUS — R2 = [0x00, 0x00] (no errors)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(new Uint8Array([0x00, 0x00]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x51:
        // CMD17: READ_SINGLE_BLOCK — sector index in arg[0..3]; response via IPC
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          this._state = SdState.DATA;
          const sectorIndex =
            (this._commandParams[0] << 24) |
            (this._commandParams[1] << 16) |
            (this._commandParams[2] << 8) |
            this._commandParams[3];
          this.machine.setFrameCommand({
            command: "sd-read",
            sector: sectorIndex
          });
          // Response not ready yet — waiting for IPC round-trip
          this._responseReady = false;
        }
        break;

      case 0x58:
        // CMD24: WRITE_BLOCK — returns R1=0x00, then waits for 0xFE + data + CRC
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          this._state = SdState.WRITE_WAITFE;
          // Immediate R1 acknowledgment — readable but not IPC-backed
          this.setMmcResponseIntermediate(new Uint8Array([0x00]));
        }
        break;

      case 0x69:
        // CMD41 / ACMD41: SEND_OP_COND
        // Only valid as ACMD41 (following CMD55). Bare CMD41 returns illegal-command.
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          if (this._bACMD) {
            this._state = SdState.READY;
            this.setMmcResponse(new Uint8Array([0x00]));
          } else {
            this.setMmcResponse(new Uint8Array([0xff]));
          }
        } else {
          this._commandIndex++;
        }
        break;

      case 0x77:
        // CMD55: APP_CMD — prefix for the next ACMD; R1 = 0x01 (idle)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(new Uint8Array([0x01]));
        } else {
          this._commandIndex++;
        }
        break;

      case 0x7a:
        // CMD58: READ_OCR — returns OCR register
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this.setMmcResponse(this._ocr.slice());
        } else {
          this._commandIndex++;
        }
        break;

      default:
        this._commandIndex = 0;
        break;
    }

    // Mirror MAME bACMD logic: flag is true only immediately after CMD55 completes
    if (this._commandIndex === 0) {
      this._bACMD = this._lastCommand === 0x77;
    }
  }

  readMmcData(): number {
    if (this._selectedCard !== 0) {
      // We can use only card 0
      return 0xff;
    }

    const now = this.machine.tacts;
    if (!this._responseReady) {
      // Response from main process is not yet available
      if (this._responseIndex === -1 && now - this._lastByteReceived < READ_DELAY) {
        // Still within the read-delay window
        return 0xff;
      }
    }

    if (this._responseIndex >= 0 && this._responseIndex < this._response.length) {
      return this._response[this._responseIndex++];
    }

    switch (this._lastCommand) {
      case 0x51:
      case 0x77:
        return 0xff;
    }

    // No result
    return 0x00;
  }

  setMmcResponse(response: Uint8Array): void {
    this._response = response;
    this._responseIndex = 0;
    this._responseReady = true;
  }

  // Set a response that is readable immediately (responseIndex=0) but is not
  // IPC-backed (responseReady stays false). Used for CMD24 R1 acknowledgment.
  private setMmcResponseIntermediate(response: Uint8Array): void {
    this._response = response;
    this._responseIndex = 0;
    // Do NOT set responseReady — no IPC round-trip is involved
  }

  setWriteResponse(): void {
    this.setMmcResponse(new Uint8Array([0x05, 0xff, 0xfe]));
  }

  setWriteErrorResponse(_errorMessage?: string): void {
    // 0x0D = write error token per SD card data-response format
    this.setMmcResponse(new Uint8Array([0x0d, 0xff, 0xff]));
  }

  setReadResponse(sectorData: Uint8Array): void {
    // Response layout: R1(0x00) + dummy(0xff) + token(0xfe) + 512 data bytes + CRC16(2 bytes)
    const response = new Uint8Array(3 + BYTES_PER_SECTOR + 2);
    response[0] = 0x00;
    response[1] = 0xff;
    response[2] = 0xfe;

    let data: Uint8Array;
    if (sectorData instanceof Uint8Array) {
      data = sectorData;
    } else if (Array.isArray(sectorData)) {
      // IPC serialisation edge case: Uint8Array may arrive as plain Array
      data = new Uint8Array(sectorData);
    } else {
      console.warn("setReadResponse: Unexpected response data type", typeof sectorData);
      data = new Uint8Array(sectorData as any);
    }
    response.set(data, 3);

    const crc = calculateCRC16(data);
    response[3 + BYTES_PER_SECTOR] = (crc >> 8) & 0xff;
    response[3 + BYTES_PER_SECTOR + 1] = crc & 0xff;

    this.setMmcResponse(response);
  }
}
