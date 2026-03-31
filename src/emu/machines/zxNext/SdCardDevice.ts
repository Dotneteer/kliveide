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
  DATA_MULTI,   // multi-block read streaming
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
  private _xferblk: number;
  private _totalSectors: number;
  private _blknext: number;
  private _crcOff: boolean;
  // Tracks whether an IPC-backed response is ready to be read by the Z80
  private _responseReady: boolean;

  // --- Card 1 independent state machine
  private _cid1: Uint8Array;
  private _commandIndex1: number;
  private _lastCommand1: number;
  private _commandParams1: number[];
  private _state1: SdState;
  private _bACMD1: boolean;
  private _response1: Uint8Array;
  private _responseIndex1: number;
  private _totalSectors1: number;
  private _lastByteReceived1: number;
  private _responseReady1: boolean;
  private _xferblk1: number;
  private _blockToWrite1: Uint8Array;
  private _dataIndex1: number;
  private _crcOff1: boolean;
  private _blknext1: number;

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
    this._xferblk = BYTES_PER_SECTOR;
    this._totalSectors = 0;
    this._blknext = 0;
    this._crcOff = true;

    // --- Card 1 state reset
    this._cid1 = Uint8Array.from([
      0x02, // Manufacturer ID (different from card 0)
      "K".charCodeAt(0), // Application ID (0)
      "l".charCodeAt(0), // Application ID (1)
      "i".charCodeAt(0), // Card name (0)
      "v".charCodeAt(0), // Card name (1)
      "e".charCodeAt(0), // Card name (2)
      "I".charCodeAt(0), // Card name (3)
      "D".charCodeAt(0), // Card name (4)
      "1".charCodeAt(0), // Card name (5) — slot 1
      1, // Revision
      5, // Serial number
      6,
      7,
      8,
      127, // Manufacture date
      128  // CRC7
    ]);
    this._cid1[15] = ((calculateCRC7(this._cid1.slice(0, 15)) << 1) | 0x01) & 0xff;
    this._commandIndex1 = 0;
    this._lastCommand1 = 0;
    this._commandParams1 = [];
    this._state1 = SdState.IDLE;
    this._bACMD1 = false;
    this._response1 = new Uint8Array(0);
    this._responseIndex1 = -1;
    this._totalSectors1 = 0;
    this._lastByteReceived1 = 0;
    this._responseReady1 = false;
    this._xferblk1 = BYTES_PER_SECTOR;
    this._blockToWrite1 = new Uint8Array(0);
    this._dataIndex1 = 0;
    this._crcOff1 = true;
    this._blknext1 = 0;
  }

  get selectedCard(): number {
    return this._selectedCard;
  }

  set selectedCard(value: number) {
    this._selectedCard = value === 0xfe ? 0 : 1;
  }

  /**
   * Implements the port 0xE7 chip-select decode matching MAME's port_e7_reg_w.
   *
   * Bit layout of the shadow register (m_port_e7_reg):
   *   bit 7 = FPGA flash CS  (active-low)
   *   bit 3 = RPi CS1        (active-low)
   *   bit 2 = RPi CS0        (active-low)
   *   bit 1 = SD card 1 SS   (active-low)
   *   bit 0 = SD card 0 SS   (active-low)
   *
   * A card is selected when its bit in the shadow register is 0.
   */
  spiCsWrite(data: number): void {
    const swap = this.machine.nextRegDevice.sdSwap;
    const configMode = this.machine.nextRegDevice.configMode;

    let reg: number;
    if ((data & 3) === 0b10) {
      // Select primary SD card: default → SD0 (bit 0 low); if swapped → SD1 (bit 1 low)
      // MAME: reg = 0b11111100 | (!swap << 1) | swap
      reg = 0b11111100 | (swap ? 1 : 2);
    } else if ((data & 3) === 0b01) {
      // Select secondary SD card: default → SD1 (bit 1 low); if swapped → SD0 (bit 0 low)
      // MAME: reg = 0b11111100 | (swap << 1) | !swap
      reg = 0b11111100 | (swap ? 2 : 1);
    } else if (data === 0xfb || data === 0xf7) {
      // RPi chip-select lines; both SD cards deselected
      reg = data;
    } else if (data === 0x7f && configMode) {
      // FPGA flash CS; only allowed in config mode
      reg = 0x7f;
    } else {
      // Deselect all
      reg = 0xff;
    }

    // Card is selected when its SS bit (active-low) is 0 in the shadow register.
    this._selectedCard = (reg & 1) === 0 ? 0 : ((reg & 2) === 0 ? 1 : 0xff);
  }

  get cid(): Uint8Array {
    return this._cid;
  }

  /** Notify the device of the total number of 512-byte sectors on the SD image (card 0). */
  setCardInfo(totalSectors: number): void {
    this._totalSectors = totalSectors;
  }

  /** True once setCardInfo has been called with a valid sector count. */
  get hasCardInfo(): boolean {
    return this._totalSectors > 0;
  }

  /** Notify the device of the total number of 512-byte sectors on card 1's SD image. */
  setCard1Info(totalSectors: number): void {
    this._totalSectors1 = totalSectors;
  }

  /**
   * Build a 16-byte SDHC CSD v2.0 register dynamically from the mounted image size.
   * Uses _totalSectors if known; falls back to 4 GB.
   */
  private buildCsd(): Uint8Array {
    const csd = new Uint8Array(16);
    // SDHC always uses 512-byte blocks (block_size_exp = 9)
    // c_size = (totalSectors / 1024) - 1  (CSD v2.0, bits 69:48)
    const totalSectors = this._totalSectors > 0 ? this._totalSectors : 8 * 1024 * 1024; // default 4 GB
    const cSize = (totalSectors >>> 10) - 1;
    csd[0]  = 0x40;                      // CSD_STRUCTURE=1 (v2.0), reserved=0
    csd[1]  = 0x0e;                      // TAAC = 1ms
    csd[2]  = 0x00;                      // NSAC = 0
    csd[3]  = 0x32;                      // TRAN_SPEED = 25 MHz
    csd[4]  = 0x5b;                      // CCC[11:4]
    csd[5]  = 0x59;                      // CCC[3:0] | READ_BL_LEN=9 (512 bytes)
    csd[6]  = 0x00;                      // READ_BL_PARTIAL=0 etc.
    csd[7]  = (cSize >>> 16) & 0x3f;    // C_SIZE bits 21:16
    csd[8]  = (cSize >>> 8)  & 0xff;    // C_SIZE bits 15:8
    csd[9]  = cSize & 0xff;             // C_SIZE bits 7:0
    csd[10] = 0x3f;                      // ERASE_BLK_EN=1, SECTOR_SIZE=0x1f
    csd[11] = 0x80;                      // WP_GRP_SIZE=0
    csd[12] = 0x06;                      // R2W_FACTOR=1, WRITE_BL_LEN bits 3:2 = 0b10
    csd[13] = 0x40;                      // WRITE_BL_LEN bits 1:0 = 0b01
    csd[14] = 0x00;
    csd[15] = 0x01;                      // CRC7 | 1 (not computed per MAME)
    return csd;
  }

  writeMmcData(data: number): void {
    // Dispatch to the appropriate card's state machine
    if (this._selectedCard === 1) {
      this.writeMmcDataCard1(data);
      return;
    }

    // Every incoming byte interrupts any pending card-0 response read
    this._responseIndex = -1;
    this._responseReady = false;

    if (this._selectedCard !== 0) {
      // Unknown card index — ignore
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
        // CMD9: SEND_CSD — R1 + dummy + token + 16-byte CSD (per MAME: no trailing CRC16)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          const csdData = this.buildCsd();
          const csdResponse = new Uint8Array(19); // 3 header + 16 CSD
          csdResponse[0] = 0x00;
          csdResponse[1] = 0xff;
          csdResponse[2] = 0xfe;
          csdResponse.set(csdData, 3);
          this.setMmcResponse(csdResponse);
        } else {
          this._commandIndex++;
        }
        break;

      case 0x4a:
        // CMD10: SEND_CID — R1 + dummy + token + 16-byte CID + CRC16 (21 bytes)
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          const cidResponse = new Uint8Array(21); // 3 header + 16 CID + 2 CRC16
          cidResponse[0] = 0x00;
          cidResponse[1] = 0xff;
          cidResponse[2] = 0xfe;
          cidResponse.set(this._cid, 3);
          const cidCrc = calculateCRC16(this._cid);
          cidResponse[19] = (cidCrc >> 8) & 0xff;
          cidResponse[20] = cidCrc & 0xff;
          this.setMmcResponse(cidResponse);
        } else {
          this._commandIndex++;
        }
        break;

      case 0x4c:
        // CMD12: STOP_TRANSMISSION — R1 = 0x00; stops multi-block reads
        if (this._commandIndex === 5) {
          this._commandIndex = 0;
          this._state = SdState.TRAN;
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

      case 0x50:
        // CMD16: SET_BLOCKLEN — for SDHC fixed at 512; accept 512, reject others
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          const blockLen =
            ((this._commandParams[0] & 0xff) << 24) |
            ((this._commandParams[1] & 0xff) << 16) |
            ((this._commandParams[2] & 0xff) << 8)  |
             (this._commandParams[3] & 0xff);
          if (blockLen === BYTES_PER_SECTOR) {
            this._xferblk = blockLen;
            this.setMmcResponse(new Uint8Array([0x00])); // OK
          } else {
            this.setMmcResponse(new Uint8Array([0x40])); // parameter error
          }
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

      case 0x52:
        // CMD18: READ_MULTIPLE_BLOCK — sector index in arg[0..3]; streams blocks until CMD12
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          this._blknext =
            (this._commandParams[0] << 24) |
            (this._commandParams[1] << 16) |
            (this._commandParams[2] << 8) |
            this._commandParams[3];
          this._state = SdState.DATA_MULTI;
          // Send R1 immediately, then kick off first sector read
          this.setMmcResponseIntermediate(new Uint8Array([0x00]));
          this.machine.setFrameCommand({
            command: "sd-read",
            sector: this._blknext
          });
          this._blknext++;
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

      case 0x7b:
        // CMD59: CRC_ON_OFF — toggle CRC checking
        this._commandParams.push(data);
        this._commandIndex++;
        if (this._commandIndex === 6) {
          this._commandIndex = 0;
          this._crcOff = (this._commandParams[3] & 1) === 0;
          this.setMmcResponse(new Uint8Array([0x00]));
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
    if (this._selectedCard === 1) {
      return this.readMmcDataCard1();
    }

    if (this._selectedCard !== 0) {
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
      const byte = this._response[this._responseIndex++];

      // When we've just returned the last byte and we're in DATA_MULTI,
      // kick off the next block read automatically.
      if (this._responseIndex === this._response.length && this._state === SdState.DATA_MULTI) {
        this.machine.setFrameCommand({
          command: "sd-read",
          sector: this._blknext
        });
        this._blknext++;
        this._responseReady = false;
        this._responseIndex = -1;
      }

      return byte;
    }

    switch (this._lastCommand) {
      case 0x51:
      case 0x52:
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

    const crc = calculateCRC16(data);

    if (this._state === SdState.DATA_MULTI) {
      // Multi-block: token(0xfe) + data + CRC16 (no R1/dummy prefix)
      const response = new Uint8Array(1 + BYTES_PER_SECTOR + 2);
      response[0] = 0xfe;
      response.set(data, 1);
      response[1 + BYTES_PER_SECTOR] = (crc >> 8) & 0xff;
      response[1 + BYTES_PER_SECTOR + 1] = crc & 0xff;
      this.setMmcResponse(response);
    } else {
      // Single-block: R1(0x00) + dummy(0xff) + token(0xfe) + data + CRC16
      const response = new Uint8Array(3 + BYTES_PER_SECTOR + 2);
      response[0] = 0x00;
      response[1] = 0xff;
      response[2] = 0xfe;
      response.set(data, 3);
      response[3 + BYTES_PER_SECTOR] = (crc >> 8) & 0xff;
      response[3 + BYTES_PER_SECTOR + 1] = crc & 0xff;
      this.setMmcResponse(response);
    }
  }

  /**
   * Card 1 state machine — handles initialization commands and data commands.
   * Data commands issue IPC frame commands (sd-read-card1 / sd-write-card1)
   * mirroring card 0's approach.
   */
  private writeMmcDataCard1(data: number): void {
    // Clear card-1 response on each new incoming byte
    this._responseIndex1 = -1;
    this._responseReady1 = false;

    // --- WRITE_WAITFE: waiting for the 0xFE data-start token from the host
    if (this._state1 === SdState.WRITE_WAITFE) {
      if (data === 0xfe) {
        this._state1 = SdState.WRITE_DATA;
        this._blockToWrite1 = new Uint8Array(BYTES_PER_SECTOR + 2);
        this._dataIndex1 = 0;
      }
      return;
    }

    // --- WRITE_DATA: accumulating sector data + CRC
    if (this._state1 === SdState.WRITE_DATA) {
      this._blockToWrite1[this._dataIndex1++] = data;
      if (this._dataIndex1 === this._blockToWrite1.length) {
        this._state1 = SdState.TRAN;
        const sectorIndex =
          (this._commandParams1[0] << 24) |
          (this._commandParams1[1] << 16) |
          (this._commandParams1[2] << 8) |
          this._commandParams1[3];
        this.machine.setFrameCommand({
          command: "sd-write-card1",
          sector: sectorIndex,
          data: this._blockToWrite1.slice(0, BYTES_PER_SECTOR)
        });
        this._responseReady1 = false;
      }
      return;
    }

    // --- Command byte reception
    if (this._commandIndex1 === 0) {
      this._lastCommand1 = data;
      this._commandParams1 = [];
      this._commandIndex1 = 1;
      this._lastByteReceived1 = this.machine.tacts;
      return;
    }

    switch (this._lastCommand1) {
      case 0x40:
        // CMD0: GO_IDLE_STATE
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this._state1 = SdState.IDLE;
          this.setCard1Response(new Uint8Array([0x01]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x41:
        // CMD1: SEND_OP_COND
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this._state1 = SdState.READY;
          this.setCard1Response(new Uint8Array([0x00]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x48:
        // CMD8: SEND_IF_COND
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this.setCard1Response(new Uint8Array([0x01, 0x00, 0x00, 0x01, 0xaa]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x49:
        // CMD9: SEND_CSD — card 1 has no media, return zeroed CSD
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          const csd1 = new Uint8Array(19);
          csd1[0] = 0x00; csd1[1] = 0xff; csd1[2] = 0xfe;
          this.setCard1Response(csd1);
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x4a:
        // CMD10: SEND_CID
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          const cid1Resp = new Uint8Array(21);
          cid1Resp[0] = 0x00; cid1Resp[1] = 0xff; cid1Resp[2] = 0xfe;
          cid1Resp.set(this._cid1, 3);
          const crc1 = calculateCRC16(this._cid1);
          cid1Resp[19] = (crc1 >> 8) & 0xff;
          cid1Resp[20] = crc1 & 0xff;
          this.setCard1Response(cid1Resp);
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x4c:
        // CMD12: STOP_TRANSMISSION
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this._state1 = SdState.TRAN;
          this.setCard1Response(new Uint8Array([0x00]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x4d:
        // CMD13: SEND_STATUS
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this.setCard1Response(new Uint8Array([0x00, 0x00]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x50:
        // CMD16: SET_BLOCKLEN — SDHC fixed at 512
        this._commandParams1.push(data);
        this._commandIndex1++;
        if (this._commandIndex1 === 6) {
          this._commandIndex1 = 0;
          const blockLen1 =
            ((this._commandParams1[0] & 0xff) << 24) |
            ((this._commandParams1[1] & 0xff) << 16) |
            ((this._commandParams1[2] & 0xff) << 8)  |
             (this._commandParams1[3] & 0xff);
          if (blockLen1 === BYTES_PER_SECTOR) {
            this._xferblk1 = blockLen1;
            this.setCard1Response(new Uint8Array([0x00]));
          } else {
            this.setCard1Response(new Uint8Array([0x40]));
          }
        }
        break;

      case 0x51:
        // CMD17: READ_SINGLE_BLOCK — sector index in arg[0..3]; response via IPC
        this._commandParams1.push(data);
        this._commandIndex1++;
        if (this._commandIndex1 === 6) {
          this._commandIndex1 = 0;
          this._state1 = SdState.DATA;
          const sectorIndex =
            (this._commandParams1[0] << 24) |
            (this._commandParams1[1] << 16) |
            (this._commandParams1[2] << 8) |
            this._commandParams1[3];
          this.machine.setFrameCommand({
            command: "sd-read-card1",
            sector: sectorIndex
          });
          this._responseReady1 = false;
        }
        break;

      case 0x52:
        // CMD18: READ_MULTIPLE_BLOCK — streams blocks until CMD12
        this._commandParams1.push(data);
        this._commandIndex1++;
        if (this._commandIndex1 === 6) {
          this._commandIndex1 = 0;
          this._blknext1 =
            (this._commandParams1[0] << 24) |
            (this._commandParams1[1] << 16) |
            (this._commandParams1[2] << 8) |
            this._commandParams1[3];
          this._state1 = SdState.DATA_MULTI;
          this.setCard1ResponseIntermediate(new Uint8Array([0x00]));
          this.machine.setFrameCommand({
            command: "sd-read-card1",
            sector: this._blknext1
          });
          this._blknext1++;
          this._responseReady1 = false;
        }
        break;

      case 0x58:
        // CMD24: WRITE_BLOCK — returns R1=0x00, then waits for 0xFE + data + CRC
        this._commandParams1.push(data);
        this._commandIndex1++;
        if (this._commandIndex1 === 6) {
          this._commandIndex1 = 0;
          this._state1 = SdState.WRITE_WAITFE;
          this.setCard1ResponseIntermediate(new Uint8Array([0x00]));
        }
        break;

      case 0x69:
        // CMD41 / ACMD41
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          if (this._bACMD1) {
            this._state1 = SdState.READY;
            this.setCard1Response(new Uint8Array([0x00]));
          } else {
            this.setCard1Response(new Uint8Array([0xff]));
          }
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x77:
        // CMD55: APP_CMD
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this.setCard1Response(new Uint8Array([0x01]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x7a:
        // CMD58: READ_OCR
        if (this._commandIndex1 === 5) {
          this._commandIndex1 = 0;
          this.setCard1Response(new Uint8Array([0x00, 0xc0, 0xff, 0x80, 0x00]));
        } else {
          this._commandIndex1++;
        }
        break;

      case 0x7b:
        // CMD59: CRC_ON_OFF
        this._commandParams1.push(data);
        this._commandIndex1++;
        if (this._commandIndex1 === 6) {
          this._commandIndex1 = 0;
          this._crcOff1 = (this._commandParams1[3] & 1) === 0;
          this.setCard1Response(new Uint8Array([0x00]));
        }
        break;

      default:
        this._commandIndex1 = 0;
        break;
    }

    if (this._commandIndex1 === 0) {
      this._bACMD1 = this._lastCommand1 === 0x77;
    }
  }

  private setCard1Response(response: Uint8Array): void {
    this._response1 = response;
    this._responseIndex1 = 0;
    this._responseReady1 = true;
  }

  private setCard1ResponseIntermediate(response: Uint8Array): void {
    this._response1 = response;
    this._responseIndex1 = 0;
  }

  private readMmcDataCard1(): number {
    if (!this._responseReady1) {
      if (this._responseIndex1 === -1 && this.machine.tacts - this._lastByteReceived1 < READ_DELAY) {
        return 0xff;
      }
    }

    if (this._responseIndex1 >= 0 && this._responseIndex1 < this._response1.length) {
      const byte = this._response1[this._responseIndex1++];

      // Multi-block streaming: kick off the next block when the current one is consumed
      if (this._responseIndex1 === this._response1.length && this._state1 === SdState.DATA_MULTI) {
        this.machine.setFrameCommand({
          command: "sd-read-card1",
          sector: this._blknext1
        });
        this._blknext1++;
        this._responseReady1 = false;
        this._responseIndex1 = -1;
      }

      return byte;
    }

    switch (this._lastCommand1) {
      case 0x51:
      case 0x52:
      case 0x77:
        return 0xff;
    }
    return 0x00;
  }

  setCard1ReadResponse(sectorData: Uint8Array): void {
    let data: Uint8Array;
    if (sectorData instanceof Uint8Array) {
      data = sectorData;
    } else if (Array.isArray(sectorData)) {
      data = new Uint8Array(sectorData);
    } else {
      data = new Uint8Array(sectorData as any);
    }

    const crc = calculateCRC16(data);

    if (this._state1 === SdState.DATA_MULTI) {
      const response = new Uint8Array(1 + BYTES_PER_SECTOR + 2);
      response[0] = 0xfe;
      response.set(data, 1);
      response[1 + BYTES_PER_SECTOR] = (crc >> 8) & 0xff;
      response[1 + BYTES_PER_SECTOR + 1] = crc & 0xff;
      this.setCard1Response(response);
    } else {
      const response = new Uint8Array(3 + BYTES_PER_SECTOR + 2);
      response[0] = 0x00;
      response[1] = 0xff;
      response[2] = 0xfe;
      response.set(data, 3);
      response[3 + BYTES_PER_SECTOR] = (crc >> 8) & 0xff;
      response[3 + BYTES_PER_SECTOR + 1] = crc & 0xff;
      this.setCard1Response(response);
    }
  }

  setCard1WriteResponse(): void {
    this.setCard1Response(new Uint8Array([0x05, 0xff, 0xfe]));
  }

  setCard1WriteErrorResponse(_errorMessage?: string): void {
    this.setCard1Response(new Uint8Array([0x0d, 0xff, 0xff]));
  }
}
