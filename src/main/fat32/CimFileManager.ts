/**
 * This class is responsible for managing the file system of the CIM.
 */
export class CimFileManager {
  createFile(name: string, sectorSize: number, sizeInMegaByte: number): CimFile {
    // --- Size must be between 1MB and 16GB
    if (sizeInMegaByte < 1 || sizeInMegaByte > 16384) {
      throw new Error("Invalid size");
    }

    // --- Zero sector size means 512 bytes
    if (!sectorSize) {
      sectorSize = 1;
    }

    // --- Sector size must be multiplied with 512; the calculated size it must be between 512 and 32768
    if (availableSectorSizes.indexOf(sectorSize) === -1) {
      throw new Error("Invalid sector size");
    }

    // --- Calculate the cluster size
    const sectorsInOneMB = 2048 / sectorSize;
    const sectors = sizeInMegaByte * sectorsInOneMB; 
    return new CimFile();
  }
}

const availableSectorSizes = [1, 2, 4, 8, 16, 32, 64];

/**
 * This class represents a CIM file.
 */
export class CimFile {}
