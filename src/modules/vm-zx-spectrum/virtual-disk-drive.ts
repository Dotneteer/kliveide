import { stringContaining } from "expect";

/**
 *    This class represents a disk drive. It decodes a disk image file and
 *   stores the disk data in different arrays for easy access.
 *    It has methods for reading from the image data which are
 *   called from the disk controller.
 *
 *   Standard and extended disk images are handled.
 *   Here follows a specification for the extended disk image format.
 *   Source: http://www.cpcwiki.eu/index.php/Format:DSK_disk_image_file_format
 *   ===========================================================================
 *   The first 256 bytes of the image data is the Disk Information Block:
 *
 *   Offset Description                                   Bytes
 *   (HEX)                                                (Decimal)
 *   ---------------------------------------------------------------------------
 *   00 - 21 "EXTENDED CPC DSK File\r\nDisk-Info\r\n"     34
 *   22 - 2F name of creator(utility emulator)            14
 *   30      number of tracks                             1
 *   31      number of sides                              1
 *   32 - 33 unused                                       2
 *   34 - xx track size table                             number of tracks x
 *                                                        number of sides
 *   ===========================================================================
 *   After the Disk Information Block follows the track data.
 *   Each track starts with a Track Information Block:
 *
 *   Offset Description                                   Bytes
 *   (HEX)                                                (Decimal)
 *   ---------------------------------------------------------------------------
 *   00 - 0B "Track-Info\r\n"                             12
 *   0C - 0F unused                                       4
 *   10      track number                                 1
 *   11      side number                                  1
 *   12 - 13 unused                                       2
 *   14      sector size                                  1
 *   15      number of sectors                            1
 *   16      GAP#3 length                                 1
 *   17      filler byte                                  1
 *   18 - xx Sector Information List                      number of sectors x 8
 *
 *   The Sector Information Lists have the following content:
 *
 *   Offset Description                                                      Bytes
 *   (HEX)                                                                   (Decimal)
 *   -----------------------------------------------------------------------------------
 *   00      track(equivalent to C parameter in NEC765 commands)              1
 *   01      side(equivalent to H parameter in NEC765 commands)               1
 *   02      sector ID(equivalent to R parameter in NEC765 commands)          1
 *   03      sector size(equivalent to N parameter in NEC765 commands)        1
 *   04      FDC status register 1(equivalent to NEC765 ST1 status register)  1
 *   05      FDC status register 2(equivalent to NEC765 ST2 status register)  1
 *   06 - 07 actual data length in bytes 2
 *
 *   After the Sector Information Lists follows the sector data in the same order.
 */
export class VirtualDiskDrive {
  private _numberOfTracks: number;
  private _standardImageTrackSize: number;
  private _trackInformationBlock: Uint8Array[];
  private _diskInformationBlock: Uint8Array;
  private _sectorInformationList: Uint8Array[][];
  private _numberOfSectors: number[];
  private _sectorData: Uint8Array[][];
  private _trackIdIndex: number[];
  private _sectorIdIndex: number[][];

  // --- Flags to control reading and writing of data.
  private _currentSectorIndex: number;
  private _terminateAfterSector: boolean;
  private _currentR: number;
  private _readPos: number;
  private _writePos: number;
  private _offset: number;

  /**
   * Creates a disk drive object with no disk loaded.
   */
  constructor() {
    this.noDisk();
  }

  // --- Status register values.
  interruptCodeST0: number;
  notReadyST0: number;
  noDataST1: number;
  endOfCylinderST1: number;
  dataErrorST1: number;
  notWriteableST1: number;
  controlMarkST2: number;
  dataErrorInDataField_ST2: number;
  track0ST3: number;
  readySignalST3: number;

  // --- Other status information.
  diskLoaded: boolean;
  currentCylinder: number;
  diskImageType: number;

  /**
   * Get the #of cyclinders
   */
  get cImage(): number {
    return this.diskLoaded
      ? this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][0]
      : 0;
  }

  /**
   * Get the #of heads
   */
  get hImage(): number {
    return this.diskLoaded
      ? this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][1]
      : 0;
  }

  /**
   * Get the #of sectors
   */
  get rImage(): number {
    return this.diskLoaded
      ? this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][2]
      : 0;
  }

  /**
   * Get data length
   */
  get nImage(): number {
    return this.diskLoaded
      ? this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][3]
      : 0;
  }

  loadDiskImage(diskImageArray: Uint8Array): void {
    // --- Store some metadata for later use.
    this._diskInformationBlock = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      this._diskInformationBlock[i] = diskImageArray[i];
    }

    // Find out what kind of disk image this is.
    let description = "";
    this.diskImageType = 99;
    for (let i = 0; i < 34; i++) {
      description += String.fromCharCode(this._diskInformationBlock[i]);
    }
    if (description.startsWith("MV - CPC")) {
      this.diskImageType = 0;
    } else if (description.startsWith("EXTENDED CPC")) {
      this.diskImageType = 1;
    }

    if (this.diskImageType == 99) {
      throw new Error("Invalid image format.");
    } else {
      // ---Get some data out of the disk information block.
      this._numberOfTracks = this._diskInformationBlock[0x30];
      const numberOfSides = this._diskInformationBlock[0x31];
      this._standardImageTrackSize =
        this._diskInformationBlock[0x32] +
        256 * this._diskInformationBlock[0x33];
      const totalNumberOfTracks = this._numberOfTracks * numberOfSides;

      // --- Create a two-dimensional array for the track data.
      this._trackInformationBlock = [];
      const trackData: Uint8Array[] = [];

      // --- Create arrays for the sector data and sector meta data.
      this._numberOfSectors = [];
      this._sectorData = [];
      this._sectorInformationList = [];

      // --- Create a two-dimensional array for storing a cross-reference between
      // --- the index of each sector array and the sector ID.
      // --- Example: "sectorIDIndex[1][5] = 2" means that a sector with ID = 5 on
      // --- track 1 is found in the sector array at index = 2;
      // --- This is used by the Plus3DiskController class to find sector data based
      // --- on a known sector ID.
      this._sectorIdIndex = [];
      this._trackIdIndex = [];

      // Populate the track and sector arrays.
      let trackStartOffset = 256;
      let sectorDataPos = 256;
      for (let track = 0; track < totalNumberOfTracks; track++) {
        // --- Extract track n from the raw disk image array into the trackData array.
        // --- For standard disk images, the track size is fixed, but for extended images
        // --- the size is fetched from the track size table starting at 0x34.
        const trackSize =
          this.diskImageType === 0
            ? this._standardImageTrackSize
            : 256 * diskImageArray[0x34 + track];

        if (trackSize > 0) {
          // --- Prepare the track data array.
          trackData[track] = new Uint8Array(trackSize);
          for (let i = 0; i < trackSize; i++) {
            trackData[track][i] = diskImageArray[trackStartOffset + i];
          }
          this._trackInformationBlock[track] = new Uint8Array(256);
          for (let i = 0; i < 265; i++) {
            this._trackInformationBlock[track][i] = trackData[track][i];
          }
          trackStartOffset += trackSize;
          sectorDataPos += 256;

          // --- If the track is not empty, gather the sector data into separate arrays.
          if (trackData[track].length > 0) {
            // --- Create the second dimension of the sector ID - sector index array.
            // --- Make space for a maximum of 256 ID values.
            this._sectorIdIndex[track] = [];

            // --- Fill the index array with the value 255 so that unused slots can be identified
            // --- later.
            for (let i = 0; i < 256; i++) {
              this._sectorIdIndex[track][i] = 255;
            }

            // --- Find out how many sectors there are on the track.
            this._numberOfSectors[track] = trackData[track][0x15];

            // --- Then prepare arrays for the sector information and data.
            this._sectorInformationList[track] = [];
            this._sectorData[track] = [];

            const trackID = trackData[track][16];
            this._trackIdIndex[trackID] = track;

            // --- Populate the sector data arrays.
            for (
              let sector = 0;
              sector < this._numberOfSectors[track];
              sector++
            ) {
              // Get the sector information list data.
              this._sectorInformationList[track][sector] = new Uint8Array(8);
              for (let position = 0; position < 8; position++) {
                this._sectorInformationList[track][sector][position] =
                  trackData[track][0x18 + 8 * sector + position];
              }

              // --- Extract some information from the sector information list.
              // --- For standard images, the sector length is decided by the N value, but for
              // --- extended images, the actual data length can be differend.
              const sectorID = this._sectorInformationList[track][sector][2];
              const sectorN = this._sectorInformationList[track][sector][3];
              const sectorLength = Math.pow(2, sectorN + 7);
              const actualDataLength =
                this.diskImageType === 0
                  ? sectorLength
                  : this._sectorInformationList[track][sector][7] * 256 +
                    this._sectorInformationList[track][sector][6];
              this._sectorIdIndex[track][sectorID] = sector;

              // --- Store the sector data. The emulator handles two cases; if the sector size parameter (N) equals 6 or 7,
              // --- the actual sector size will be 0x2000 or 0x4000 bytes respectively, but the sector data is overlapping
              // --- in the disk image array. In the other case, the sector size is found in the Actual Length bytes of the
              // --- sector information.
              if (sectorN == 6 || sectorN == 7) {
                this._sectorData[track][sector] = new Uint8Array(sectorLength);

                // --- Loop through the disk image array to fill the sector data, but note that if the last
                // --- track on the image contains an 8K sector, it can only load 6144 bytes (I just let
                // --- it run until the end of the disk image array is reached).
                for (
                  let position = 0;
                  position < sectorLength &&
                  !(sectorDataPos == diskImageArray.length);
                  position++
                ) {
                  // --- Check if we have passed the end of the current track, in which case we need to skip the 256 byte track information
                  // --- on the next sector.
                  if (
                    sector === this._numberOfSectors[track] - 1 &&
                    position == actualDataLength
                  ) {
                    sectorDataPos += 256;
                  }

                  this._sectorData[track][sector][position] =
                    diskImageArray[sectorDataPos];
                  sectorDataPos += 1;
                }

                // --- "Rewind" to the start of the next sector.
                sectorDataPos -= sectorLength - actualDataLength;

                // --- If this is the last sector we need to rewind 256 bytes more to get to start of the track.
                // --- This is because 256 bytes were added to the the sectorDataPosition when reading the last sector.
                if (sector === this._numberOfSectors[track] - 1) {
                  sectorDataPos -= 256;
                }
              } else {
                // --- Store the sector data.
                this._sectorData[track][sector] = new Uint8Array(
                  actualDataLength
                );
                for (
                  let position = 0;
                  position < actualDataLength;
                  position++
                ) {
                  this._sectorData[track][sector][position] =
                    diskImageArray[sectorDataPos];
                  sectorDataPos += 1;
                }

                // --- A sector can't be shorter than 256 bytes, but sometimes (sector 8 on track 0 on Tai Pan)
                // --- a shorter sector is stored in the image, and this needs to be compensated.
                if (actualDataLength < 256) {
                  sectorDataPos += 256 - actualDataLength;
                }
              }
            }
          }
        }
      }

      // --- Set some attributes after loading a disk image.
      this.currentCylinder = 0;
      this._currentSectorIndex = 0;
      this.track0ST3 = 0;
      this.notReadyST0 = 0;
      this.readySignalST3 = 1;
      this.diskLoaded = true;
    }
  }

  /// <summary>
  /// Saves a disk image after any write operation.
  /// </summary>
  saveImage(): Uint8Array {
    // --- Create a byte array representing the disk image.
    const imageSize = 256 + this._numberOfTracks * this._standardImageTrackSize;
    const diskImageArray = new Uint8Array(imageSize);

    // --- Save the Disk Information Block.
    for (let i = 0; i < 256; i++) {
      diskImageArray[i] = this._diskInformationBlock[i];
    }

    // --- Populate the array.
    let writePos = 256;
    for (let track = 0; track < this._numberOfTracks; track++) {
      for (let i = 0; i < 24; i++) {
        diskImageArray[writePos + i] = this._trackInformationBlock[track][i];
      }
      writePos += 24;

      for (
        let sectorIndex = 0;
        sectorIndex < this._numberOfSectors[track];
        sectorIndex++
      ) {
        for (let i = 0; i < 8; i++) {
          diskImageArray[writePos + 8 * sectorIndex + i] =
            this._sectorInformationList[track][sectorIndex][i];
        }
      }
      writePos += 232;
      const sectorSize = Math.pow(
        2,
        this._trackInformationBlock[track][20] + 7
      );
      for (
        let sectorIndex = 0;
        sectorIndex < this._numberOfSectors[track];
        sectorIndex++
      ) {
        for (let arrayIndex = 0; arrayIndex < sectorSize; arrayIndex++) {
          diskImageArray[writePos] =
            this._sectorData[track][sectorIndex][arrayIndex];
          writePos += 1;
        }
      }
    }

    // --- Save to disk.
    return diskImageArray;
  }

  /**
   * Ejects a loaded disk.
   */
  ejectDisk(): void {
    this.noDisk();
  }

  /**
   * Executes the Seek command. The head is moved to the specified cylinder.
   * @param c Cylinder number
   */
  seek(c: number): void {
    if (this.diskLoaded) {
      this._currentSectorIndex = 0;
      this.currentCylinder = c;
      this.track0ST3 = this.currentCylinder === 0 ? 1 : 0;
    } else {
      this.currentCylinder = 0;
      this._currentSectorIndex = 0;
    }
  }

  /// <summary>
  /// Executes the Read command. The disk is rotated to the next sector.
  /// </summary>
  readID(): void {
    // --- Reset some status information.
    this.dataErrorST1 = 0;
    this.dataErrorInDataField_ST2 = 0;
    this.endOfCylinderST1 = 0;

    // --- Check if there is data on the current track.
    if (
      !this.diskLoaded ||
      (this.diskLoaded && this._sectorData[this.currentCylinder] === null)
    )
      this.noDataST1 = 1;
    else {
      this.noDataST1 = 0;

      // Find the next sector.
      this._currentSectorIndex += 1;
      if (
        this._currentSectorIndex >= this.numberOfSectors(this.currentCylinder)
      )
        this._currentSectorIndex = 0;
    }
  }

  /// <summary>
  ///
  /// </summary>
  /// <param name="c"></param>
  /// <param name="r"></param>
  /**
   * Prepares for Read Data or Read Deleted Data by setting the FDD to the correct
   * starting position.
   * Also, checks for any missing Data Address Mark.
   * @param c Cylinder number
   * @param r Sector number
   * @param skipDeletedDataAddressMark
   * @param readDeletedData
   * @param readTrack
   */
  prepareForReadData(
    c: number,
    r: number,
    skipDeletedDataAddressMark: number,
    readDeletedData: boolean,
    readTrack: boolean
  ): void {
    // --- Reset the Control Mark.
    this.controlMarkST2 = 0;

    if (readTrack) this._currentSectorIndex = 0;
    else {
      // --- Find the index of the current sector id in the sector array.
      // --- An index value of 255 means that the sector id could not be found.
      this._currentSectorIndex = this.findSectorIndex(this.currentCylinder, r);
    }

    if (this._currentSectorIndex !== 255) {
      // --- A sector has been found.
      this._currentR = r;
      this._readPos = 0;
      this.endOfCylinderST1 = 0;
      this.readySignalST3 = 0;
      this.noDataST1 = 0;

      // --- If we must skip this sector, find the next valid sector.
      while (this.skipSector(skipDeletedDataAddressMark, readDeletedData)) {
        do {
          this._currentR += 1;
          this._currentSectorIndex = this.findSectorIndex(
            this.currentCylinder,
            this._currentR
          );
        } while (this._currentSectorIndex === 255);
      }
    } else {
      // --- No sector is found and the command must be aborted.
      this.interruptCodeST0 = 1;
      this.noDataST1 = 1;

      // --- Revert to the first sector.
      this._currentSectorIndex = 0;
      this._currentR =
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][2];
    }
  }

  /**
   * Checks if the current sector is deleted or not and take this into account
   * when reading data / deleted data.
   * @param skipDeletedDataAddressMark The SK parameter.
   * @param readDeletedData A flag which is true when the command is Read Deleted Data.
   *
   * On a floppy disk a sector can be deleted. This can be found by checking
   * the content of the so called Data Address Mark, a byte which preceeds the
   * sector. However, in the disk image file, the information is instead stored
   * in bit 6 of the ST2 byte in the sector information list (CM bit).
   * The information is handled in the following way:
   * If, during Read Data a deleted sector is found, or during Read Deleted Data a non-
   * deleted sector is found.
   *   + If SK = 0, read the data in the current sector and then abort. Set CM in ST2 to 1.
   *   + If SK = 1, skip to the next sector.
   */
  skipSector(
    skipDeletedDataAddressMark: number,
    readDeletedData: boolean
  ): boolean {
    let skip = false;
    this._terminateAfterSector = false;

    if (
      (readDeletedData &&
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][5] &
          (1 << 6)) ||
      (!readDeletedData &&
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][5] &
          (1 << 6))
    ) {
      if (skipDeletedDataAddressMark == 0) {
        // --- Read this sector, then terminate.
        this._terminateAfterSector = true;
      } else {
        // --- Skip this sector.
        skip = true;
      }
    }
    return skip;
  }

  /**
   * Reads data.
   * @param n Length of sector caclulated as 2 to the power of (N + 7).
   * @param endOfTrack EOT, final sector number on track.
   * @param skipDeletedDataAddressMark
   * @param readDeletedData The first sector to read from.
   * @param readTrack
   * @returns Data byte read
   *
   * Called both from the Read Data and from the Read Deleted Data commands.
   */
  readData(
    n: number,
    endOfTrack: number,
    skipDeletedDataAddressMark: number,
    readDeletedData: boolean,
    readTrack: boolean
  ): number {
    // --- TODO:
    // --- When N=0, then DTL defines the data length which the FDC must treat as a sector.
    // --- If DTL is smaller than the actual data length in a sector, the data beyond DTL
    // --- in the sector is not sent to the Data Bus. The FDC reads (internally) the complete
    // --- sector performing the CRC check and, depending upon the manner of command termination,
    // --- may perform a Multi-Sector Read Operation. When N is non-zero, then DTL has no meaning and should be set to FFh.
    if (n == 0) {
      console.log("N = 0, Not implemented!");
    }

    const sectorLength = Math.pow(2, n + 7);
    const actualSectorLength =
      this._sectorInformationList[this.currentCylinder][
        this._currentSectorIndex
      ][7] *
        256 +
      this._sectorInformationList[this.currentCylinder][
        this._currentSectorIndex
      ][6];

    // --- If this is a new sector, do some stuff
    if (this._readPos === 0) {
      // --- Handle weak sectors (choose one of 3 versions of the sector randomly).
      if (sectorLength < actualSectorLength) {
        const factor = Math.floor(actualSectorLength / sectorLength);
        this._offset = Math.floor(Math.random() * factor);
      } else this._offset = 0;
    }

    // --- Read a data byte.
    let data: number;
    if (
      this.diskLoaded &&
      this.currentCylinder <= this._numberOfTracks &&
      this._sectorData[this.currentCylinder] !== null &&
      n ===
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][3]
    ) {
      data =
        this._sectorData[this.currentCylinder][this._currentSectorIndex][
          this._offset * sectorLength + this._readPos
        ];

      // --- Handle Speedlock +3, assuming that we have CRC errors and that we are on the last byte of sector id 2.
      // --- Change the data byte to a random number to simulate a weak sector.
      if (
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][4] &
          (1 << 5) &&
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][5] &
          (1 << 5) &&
        this.rImage === 2 &&
        this._readPos === sectorLength - 1
      )
        data = Math.floor(Math.random() * 255);

      // --- Move the reading position forward.
      this._readPos += 1;

      // --- Check if we have reached the end of the sector.
      if (this._readPos >= sectorLength) {
        if (readTrack) {
          // The current command is Read Track, which means that the whole track is read
          // sector by sector in index order.
          // Check if the whole track has been read. In that case, abort the command.
          if (
            this._currentSectorIndex ==
            this._numberOfSectors[this.currentCylinder] - 1
          ) {
            this.interruptCodeST0 = 1; // Command aborted
            this.readySignalST3 = 1;
            this.endOfCylinderST1 = 1;
          } else {
            this._currentSectorIndex += 1;
            this._currentR =
              this._sectorInformationList[this.currentCylinder][
                this._currentSectorIndex
              ][2];
            this._readPos = 0;
          }
        } else {
          // --- The current command is not Read Track, so the sectors are read in order of logical
          // --- sector id.
          // --- Check if all sectors that should be processed have been processed. In that case, abort the command.
          if (
            this._sectorInformationList[this.currentCylinder][
              this._currentSectorIndex
            ][2] >= endOfTrack ||
            this._terminateAfterSector
          ) {
            this.interruptCodeST0 = 1; // Command aborted
            this.readySignalST3 = 1;
            this.endOfCylinderST1 = 1;

            if (this._terminateAfterSector) {
              this._terminateAfterSector = false;
              this.controlMarkST2 = 1;
            }
          } else {
            // Find the next valid Sector ID
            do {
              this._currentR += 1;
              this._currentSectorIndex = this.findSectorIndex(
                this.currentCylinder,
                this._currentR
              );
              // Repeat this process if the next sector ID is not valid or if it should be skipped, but only until
              // the sector ID reaches the maximum value 255.
            } while (
              (this._currentSectorIndex === 255 ||
                this.skipSector(skipDeletedDataAddressMark, readDeletedData)) &&
              this._currentR < 255
            );

            if (this._currentSectorIndex == 255) {
              // A valid Sector ID could not be found.
              this.interruptCodeST0 = 1; // Command aborted
              this.readySignalST3 = 1;
              this.endOfCylinderST1 = 1;
            }

            // Since we are on a new sector, the reading position must be reset.
            this._readPos = 0;
          }
        }
      }
    } else {
      this.noDataST1 = 1;
      this.interruptCodeST0 = 1; // Command aborted
      data = 0;
    }

    this.dataErrorST1 =
      (this._sectorInformationList[this.currentCylinder][
        this._currentSectorIndex
      ][4] >>
        5) &
      1;
    this.dataErrorInDataField_ST2 =
      (this._sectorInformationList[this.currentCylinder][
        this._currentSectorIndex
      ][5] >>
        5) &
      1;
    return data;
  }

  /**
   * Sets status flags to indicate that Read Data has been aborted.
   */
  abortRead(): void {
    this.interruptCodeST0 = 1;
    this.readySignalST3 = 1;
  }

  /// <summary>
  /// Prepares for Write Data by setting the FDD to the correct starting position.
  /// </summary>
  /// <param name="c"></param>
  /// <param name="r"></param>
  prepareForWriteData(c: number, r: number, toDelete: boolean): void {
    // --- Find the index of the current sector id in the sector array.
    // --- An index value of 255 means that the sector id could not be found.
    this._currentSectorIndex = this.findSectorIndex(this.currentCylinder, r);

    if (this._currentSectorIndex != 255) {
      // --- A sector has been found.
      this._currentR = r;
      this._writePos = 0;
      this.endOfCylinderST1 = 0;
      this.readySignalST3 = 0;
      this.noDataST1 = 0;

      // --- Set the Control Mark according to if this is a write or delete operation.
      if (!toDelete)
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][5] = 0;
      else
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][5] = 64;
    } else {
      // --- No sector is found and the command must be aborted.
      this.interruptCodeST0 = 1;
      this.noDataST1 = 1;
    }
  }

  /**
   * Writes or deletes data.
   * @param n
   * @param endOfTrack
   * @param value
   * @param toDelete
   */
  writeData(
    n: number,
    endOfTrack: number,
    value: number,
    toDelete: boolean
  ): void {
    const sectorLength = Math.pow(2, n + 7);

    // --- Write a data byte.
    if (
      this.diskLoaded &&
      this.currentCylinder <= this._numberOfTracks &&
      this._sectorData[this.currentCylinder] !== null &&
      n ===
        this._sectorInformationList[this.currentCylinder][
          this._currentSectorIndex
        ][3]
    ) {
      this._sectorData[this.currentCylinder][this._currentSectorIndex][
        this._offset * sectorLength + this._writePos
      ] = value;

      // --- Move the write position forward.
      this._writePos += 1;

      // --- Check if we have reached the end of the sector.
      if (this._writePos >= sectorLength) {
        // --- Have we processed all sectors that we wanted? In that case, abort the Write command now.
        if (
          this._sectorInformationList[this.currentCylinder][
            this._currentSectorIndex
          ][2] >= endOfTrack ||
          this._terminateAfterSector
        ) {
          this.interruptCodeST0 = 1; // Command aborted
          this.readySignalST3 = 1;
          this.endOfCylinderST1 = 1;
        } else {
          // Find the next valid Sector ID.
          do {
            this._currentR += 1;
            this._currentSectorIndex = this.findSectorIndex(
              this.currentCylinder,
              this._currentR
            );
          } while (this._currentSectorIndex == 255 && this._currentR < 255);

          if (this._currentSectorIndex == 255) {
            // A valid Sector ID could not be found.
            this.interruptCodeST0 = 1; // Command aborted
            this.readySignalST3 = 1;
            this.endOfCylinderST1 = 1;
          }

          // Since we are on a new sector, the writing position must be reset.
          this._writePos = 0;

          // Set the Control Mark according to if this is a write or delete operation.
          if (!toDelete)
            this._sectorInformationList[this.currentCylinder][
              this._currentSectorIndex
            ][5] = 0;
          else
            this._sectorInformationList[this.currentCylinder][
              this._currentSectorIndex
            ][5] = 64;
        }
      }
    } else {
      this.noDataST1 = 1;
      this.interruptCodeST0 = 1;
    }
  }

  /**
   * Formats a track.
   * @param _parameterH
   * @param _parameterN
   * @param _parameterSC
   * @param _parameterGPL
   * @param _parameterD
   * This is only possible for standard disk images. Sector numbering is always sequential.
   */
  formatTrack(
    _parameterH: number,
    _parameterN: number,
    _parameterSC: number,
    _parameterGPL: number,
    _parameterD: number
  ): void {
    if (this.diskImageType === 0) {
      const sectorLength = Math.pow(2, _parameterN + 7);

      // --- Reset the sector id index array.
      for (let i = 0; i < 256; i++) {
        this._sectorIdIndex[this.currentCylinder][i] = 255;
      }

      // Set up new sector information lists for the track.
      this._sectorInformationList[this.currentCylinder] = [];
      this._sectorData[this.currentCylinder] = [];
      for (let i = 0; i < _parameterSC; i++) {
        this._sectorInformationList[this.currentCylinder][i] = new Uint8Array(
          8
        );
        this._sectorData[this.currentCylinder][i] = new Uint8Array(
          sectorLength
        );

        // --- Update the sector id index array.
        this._sectorIdIndex[this.currentCylinder][i] = i;

        // --- Fill the sector data with filler bytes.
        for (let j = 0; j < sectorLength; j++) {
          this._sectorData[this.currentCylinder][i][j] = _parameterD & 0xff;
        }

        // --- Populate the sector information lists.
        const sector = this._sectorInformationList[this.currentCylinder][i];
        sector[0] = this.currentCylinder & 0xff;
        sector[1] = _parameterH & 0xff;
        sector[2] = (i + 1) & 0xff;
        sector[3] = _parameterN & 0xff;
        sector[4] = 0;
        sector[5] = 0;
      }
    } else {
      this.notWriteableST1 = 1;
    }
  }

  /**
   * Returns the number of sectors on a track according to the Track Information Block.
   * @param track The track to query
   */
  public numberOfSectors(track: number): number {
    return this._numberOfSectors[track];
  }

  // --------------------------------------------------------------------------
  // Helpers

  /**
   * Sets the status flags to indicate that no disk is present.
   */
  private noDisk(): void {
    this.diskLoaded = false;
    this.notReadyST0 = 1;
    this.noDataST1 = 0;
    this.readySignalST3 = 0;
    this.endOfCylinderST1 = 0;
    this.diskImageType = 99;
    this.track0ST3 = 1;
  }

  /**
   * Returns the sector array index for a sector ID.
   *
   * The sector data is stored in the _sectorData[track][sector] array.
   * This method returns the [sector] index for a sector with a given ID.
   */
  private findSectorIndex(cyl: number, sectorID: number): number {
    return this._sectorIdIndex[cyl][sectorID];
  }
}
