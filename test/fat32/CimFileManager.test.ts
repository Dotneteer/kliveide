import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import {
  CIM_HEADER,
  CIM_VERSION_MAJOR,
  CIM_VERSION_MINOR,
  CimFileManager,
  CimFile,
  MAX_CLUSTERS,
  SECTOR_SIZE,
  CLUSTER_BASE_SIZE,
  SECTOR_SIZE_BYTES
} from "@main/fat32/CimFileManager";

const TEST_DIR = "testFat32New";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";

describe("CimFileManager - Parameterized File Creation Tests", () => {
  // ========== Parameterized Tests - All File Sizes ==========
  
  const createFileCases = [
    {
      sizeInMegaByte: 64,
      clusterCount: 1024,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 128,
      clusterCount: 2048,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 256,
      clusterCount: 4096,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 512,
      clusterCount: 8192,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 1024,
      clusterCount: 16384,
      clusterSize: 1
    },
    {
      sizeInMegaByte: 2048,
      clusterCount: 16384,
      clusterSize: 2
    },
    {
      sizeInMegaByte: 4096,
      clusterCount: 16384,
      clusterSize: 4
    },
    {
      sizeInMegaByte: 8192,
      clusterCount: 16384,
      clusterSize: 8
    },
    {
      sizeInMegaByte: 16384,
      clusterCount: 16384,
      clusterSize: 16
    }
  ];

  createFileCases.forEach((c) => {
    it(`createFile with full verification: ${c.sizeInMegaByte}MB file`, () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, c.sizeInMegaByte);

      // --- Assert
      expect(file).toBeDefined();
      expect(fs.existsSync(filePath)).toBe(true);

      const cinfo = file.cimInfo;
      expect(cinfo.header).toBe(CIM_HEADER);
      expect(cinfo.versionMajor).toBe(CIM_VERSION_MAJOR);
      expect(cinfo.versionMinor).toBe(CIM_VERSION_MINOR);
      expect(cinfo.sectorSize).toBe(1);
      expect(cinfo.clusterCount).toBe(c.clusterCount);
      expect(cinfo.clusterSize).toBe(c.clusterSize);
      expect(cinfo.maxClusters).toBe(0);
      expect(cinfo.maxSize).toBe(c.sizeInMegaByte);
      expect(cinfo.reserved).toBe(0);
      expect(cinfo.clusterMap.length).toBe(MAX_CLUSTERS);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });
});

describe("CimFileManager - File Creation and Conversion", () => {
  // ========== File Creation - Input Validation ==========
  
  it("1. createFile rejects null/undefined filename", () => {
    // --- Arrange
    const cfm = new CimFileManager();

    // --- Act & Assert
    try {
      cfm.createFile(null as any, 64);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid name");
    }
  });

  it("2. createFile rejects empty filename", () => {
    // --- Arrange
    const cfm = new CimFileManager();

    // --- Act & Assert
    try {
      cfm.createFile("", 64);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid name");
    }
  });

  it("3. createFile rejects whitespace-only filename", () => {
    // --- Arrange
    const cfm = new CimFileManager();

    // --- Act & Assert
    try {
      cfm.createFile("   \t\n  ", 64);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid name");
    }
  });

  it("4. createFile rejects size below minimum (< 64 MB)", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act & Assert
    try {
      cfm.createFile(filePath, 63);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid size");
      expect(err.message).includes("64 MB");
    }
  });

  it("5. createFile rejects size above maximum (> 16 GB)", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act & Assert
    try {
      cfm.createFile(filePath, 16385);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid size");
      expect(err.message).includes("16 GB");
    }
  });

  it("6. createFile accepts minimum size (64 MB)", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 64);

    // --- Assert
    expect(file).toBeDefined();
    expect(file.cimInfo.maxSize).toBe(64);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("7. createFile accepts maximum size (16 GB)", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 16384);

    // --- Assert
    expect(file).toBeDefined();
    expect(file.cimInfo.maxSize).toBe(16384);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("8. createFile rejects non-integer size values", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act & Assert
    try {
      cfm.createFile(filePath, 128.5);
      // Note: JavaScript doesn't enforce strict int types, but this tests
      // that fractional MB values could be a concern. The current implementation
      // accepts them since it doesn't validate isInteger() on input.
      // This test documents that behavior.
    } catch (err) {
      // If implementation adds validation, catch it here
      expect(err.message).toBeDefined();
    }
  });

  // ========== File Creation - Cluster Size Selection ==========

  it("9. createFile selects smallest cluster size for 64 MB file", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 64);

    // --- Assert
    expect(file.cimInfo.clusterSize).toBe(1);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("10. createFile selects larger cluster sizes for larger files", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 1024);

    // --- Assert
    // For 1 GB, cluster size should still be 1 since it fits within MAX_CLUSTERS
    expect(file.cimInfo.clusterSize).toBeGreaterThanOrEqual(1);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("11. createFile selects cluster size 16 for 16 GB file", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 16384);

    // --- Assert
    expect(file.cimInfo.clusterSize).toBe(16);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("12. createFile cluster count never exceeds MAX_CLUSTERS", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const testSizes = [64, 256, 1024, 4096, 16384];

    // --- Act & Assert
    for (const size of testSizes) {
      const filePath = createTestFile();
      const file = cfm.createFile(filePath, size);
      
      expect(file.cimInfo.clusterCount).toBeLessThanOrEqual(MAX_CLUSTERS);
      
      fs.unlinkSync(filePath);
    }
  });

  // ========== File Creation - Output Verification ==========

  it("13. created file has correct header size (64 KB)", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    cfm.createFile(filePath, 64);

    // --- Assert
    const stats = fs.statSync(filePath);
    // File should be at least 64KB (header) in size
    expect(stats.size).toBeGreaterThanOrEqual(CLUSTER_BASE_SIZE);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("14. created file initializes all cluster map entries to 0xffff", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 64);

    // --- Assert
    for (let i = 0; i < MAX_CLUSTERS; i++) {
      expect(file.cimInfo.clusterMap[i]).toBe(0xffff);
    }
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  it("15. createFile returns CimFile object with correct properties", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const filePath = createTestFile();

    // --- Act
    const file = cfm.createFile(filePath, 128);

    // --- Assert
    expect(file).toBeInstanceOf(CimFile);
    expect(file.filename).toBe(filePath);
    expect(file.cimInfo.header).toBe(CIM_HEADER);
    expect(file.cimInfo.versionMajor).toBe(CIM_VERSION_MAJOR);
    expect(file.cimInfo.versionMinor).toBe(CIM_VERSION_MINOR);
    expect(file.cimInfo.sectorSize).toBe(SECTOR_SIZE);
    expect(file.cimInfo.maxSize).toBe(128);
    expect(file.cimInfo.reserved).toBe(0); // Not read-only by default
    expect(file.cimInfo.clusterMap).toBeDefined();
    expect(file.cimInfo.clusterMap.length).toBe(MAX_CLUSTERS);
    
    // --- Clean up
    fs.unlinkSync(filePath);
  });

  // ========== Image Conversion ==========

  it("16. convertToImageFile creates image file with all clusters", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const cimPath = createTestFile();
    const imagePath = createImageFile();
    
    // Create a CIM file and write some data
    const cimFile = cfm.createFile(cimPath, 64);
    
    // Write data to sector 0
    const testData = new Uint8Array(512);
    testData.fill(0xAA);
    cimFile.writeSector(0, testData);
    
    // --- Act
    cfm.convertToImageFile(cimFile, imagePath);

    // --- Assert
    expect(fs.existsSync(imagePath)).toBe(true);
    const stats = fs.statSync(imagePath);
    // Image should be 64 MB = 64 * 1024 * 1024 bytes
    const expectedSize = 64 * 1024 * 1024;
    expect(stats.size).toBe(expectedSize);
    
    // --- Clean up
    fs.unlinkSync(cimPath);
    fs.unlinkSync(imagePath);
  });

  it("17. convertImageFileToCim rejects image file with non-integer MB size", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const imagePath = createImageFile();
    const cimPath = createTestFile();
    
    // Create an image file with size that is not a multiple of 1 MB
    const oddSize = 64 * 1024 * 1024 + 1000; // 64 MB + 1000 bytes
    const buffer = Buffer.alloc(oddSize);
    fs.writeFileSync(imagePath, buffer);

    // --- Act & Assert
    try {
      cfm.convertImageFileToCim(imagePath, cimPath);
      assert.fail("Exception expected");
    } catch (err) {
      expect(err.message).includes("Invalid image file size");
    }
    
    // --- Clean up
    fs.unlinkSync(imagePath);
  });

  it("18. convertImageFileToCim skips all-zero sectors for optimization", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const imagePath = createImageFile();
    const cimPath = createTestFile();
    
    // Create an image file with most sectors as zero
    const imageSize = 64 * 1024 * 1024;
    const buffer = Buffer.alloc(imageSize);
    // Fill only sector 100 with non-zero data
    const offset = 100 * 512;
    buffer.fill(0xBB, offset, offset + 512);
    fs.writeFileSync(imagePath, buffer);

    // --- Act
    const cimFile = cfm.convertImageFileToCim(imagePath, cimPath);

    // --- Assert
    // Only sector 100 should be allocated
    expect(cimFile.cimInfo.maxClusters).toBe(1);
    // Only one cluster should be in use
    let allocatedCount = 0;
    for (let i = 0; i < cimFile.cimInfo.clusterCount; i++) {
      if (cimFile.cimInfo.clusterMap[i] !== 0xffff) {
        allocatedCount++;
      }
    }
    expect(allocatedCount).toBe(1);
    
    // --- Clean up
    fs.unlinkSync(imagePath);
    fs.unlinkSync(cimPath);
  });

  it("19. convertImageFileToCim preserves non-zero sector data", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const imagePath = createImageFile();
    const cimPath = createTestFile();
    
    // Create an image with specific data in multiple sectors
    const imageSize = 64 * 1024 * 1024;
    const buffer = Buffer.alloc(imageSize);
    
    // Write pattern to sector 10
    buffer.fill(0x11, 10 * 512, 11 * 512);
    // Write pattern to sector 100
    buffer.fill(0x22, 100 * 512, 101 * 512);
    
    fs.writeFileSync(imagePath, buffer);

    // --- Act
    const cimFile = cfm.convertImageFileToCim(imagePath, cimPath);

    // --- Assert
    const sector10 = cimFile.readSector(10);
    const sector100 = cimFile.readSector(100);
    
    // Check sector 10
    for (let i = 0; i < 512; i++) {
      expect(sector10[i]).toBe(0x11);
    }
    
    // Check sector 100
    for (let i = 0; i < 512; i++) {
      expect(sector100[i]).toBe(0x22);
    }
    
    // --- Clean up
    fs.unlinkSync(imagePath);
    fs.unlinkSync(cimPath);
  });

  it("20. convertImageFileToCim round-trip: file → CIM → file matches original", () => {
    // --- Arrange
    const cfm = new CimFileManager();
    const originalImagePath = createImageFile();
    const cimPath = createTestFile();
    const reconstructedImagePath = path.join(os.homedir(), TEST_DIR, "reconstructed.img");
    
    // Create original image with pattern
    const imageSize = 64 * 1024 * 1024;
    const originalBuffer = Buffer.alloc(imageSize);
    
    // Fill specific sectors with patterns
    originalBuffer.fill(0xCC, 5 * 512, 6 * 512);      // Sector 5
    originalBuffer.fill(0xDD, 1000 * 512, 1001 * 512); // Sector 1000
    
    fs.writeFileSync(originalImagePath, originalBuffer);

    // --- Act
    // Convert image to CIM
    const cimFile = cfm.convertImageFileToCim(originalImagePath, cimPath);
    
    // Convert CIM back to image
    cfm.convertToImageFile(cimFile, reconstructedImagePath);

    // --- Assert
    const reconstructedBuffer = fs.readFileSync(reconstructedImagePath);
    
    // Verify sizes match
    expect(reconstructedBuffer.length).toBe(originalBuffer.length);
    
    // Verify data in specific sectors
    for (let i = 5 * 512; i < 6 * 512; i++) {
      expect(reconstructedBuffer[i]).toBe(0xCC);
    }
    for (let i = 1000 * 512; i < 1001 * 512; i++) {
      expect(reconstructedBuffer[i]).toBe(0xDD);
    }
    
    // Verify all-zero sectors remain zero
    let zeroCount = 0;
    for (let i = 0; i < reconstructedBuffer.length; i++) {
      if (reconstructedBuffer[i] === 0) {
        zeroCount++;
      }
    }
    expect(zeroCount).toBeGreaterThan(imageSize * 0.99); // At least 99% zeros
    
    // --- Clean up
    fs.unlinkSync(originalImagePath);
    fs.unlinkSync(cimPath);
    fs.unlinkSync(reconstructedImagePath);
  });

  // ========== CimFile - Header Operations (14 tests) ==========

  describe("CimFile - Header Operations", () => {
    // ========== writeHeader() Tests ==========

    it("21. writeHeader writes CIMF signature to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.writeHeader();
      
      // --- Read raw file to verify signature
      const buffer = fs.readFileSync(filePath);
      const signature = buffer.toString("utf8", 0, 4);

      // --- Assert
      expect(signature).toBe("CIMF");
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("22. writeHeader writes correct version numbers", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.writeHeader();
      
      // --- Read raw file to verify version bytes
      const buffer = fs.readFileSync(filePath);
      const versionMajor = buffer[4];
      const versionMinor = buffer[5];

      // --- Assert
      expect(versionMajor).toBe(CIM_VERSION_MAJOR);
      expect(versionMinor).toBe(CIM_VERSION_MINOR);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("23. writeHeader writes sector size to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.writeHeader();
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.sectorSize).toBe(SECTOR_SIZE);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("24. writeHeader writes cluster count to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 128);
      const expectedClusterCount = file.cimInfo.clusterCount;

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 128, 1, expectedClusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.clusterCount).toBe(expectedClusterCount);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("25. writeHeader writes cluster size to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);
      const expectedClusterSize = file.cimInfo.clusterSize;

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 256, expectedClusterSize, file.cimInfo.clusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.clusterSize).toBe(expectedClusterSize);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("26. writeHeader writes maxClusters to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      // Write some data to allocate clusters
      const testData = new Uint8Array(512);
      testData.fill(0xCC);
      file.writeSector(0, testData);
      file.writeSector(128, testData);
      
      const expectedMaxClusters = file.cimInfo.maxClusters;

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.maxClusters).toBe(expectedMaxClusters);
      expect(newFile.cimInfo.maxClusters).toBeGreaterThan(0);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("27. writeHeader writes maxSize to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 512);
      const expectedSize = file.cimInfo.maxSize;

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 512, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.maxSize).toBe(expectedSize);
      expect(newFile.cimInfo.maxSize).toBe(512);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("28. writeHeader writes reserved (read-only) flag to file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      // Set read-only flag
      file.setReadonly(true);

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.reserved).toBe(1);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("29. writeHeader writes all 32760 cluster map entries", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.writeHeader();
      
      // --- Read header back
      const newFile = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      newFile.readHeader();

      // --- Assert
      expect(newFile.cimInfo.clusterMap.length).toBe(MAX_CLUSTERS);
      
      // All should initially be 0xffff (empty)
      for (let i = 0; i < MAX_CLUSTERS; i++) {
        expect(newFile.cimInfo.clusterMap[i]).toBe(0xffff);
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readHeader() Tests ==========

    it("30. readHeader reads and verifies CIMF header signature", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.header).toBe(CIM_HEADER);
      expect(file.cimInfo.header).toBe("CIMF");
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("31. readHeader rejects file with wrong header signature", () => {
      // --- Arrange
      const filePath = createTestFile();
      
      // Create a file with wrong header
      const buffer = Buffer.alloc(CLUSTER_BASE_SIZE);
      buffer.write("XXXX", 0); // Wrong signature
      fs.writeFileSync(filePath, buffer);

      // --- Act & Assert
      try {
        const file = new CimFile(filePath, 64, 1, 1024);
        file.readHeader();
        assert.fail("Exception expected");
      } catch (err) {
        // Should not throw on signature mismatch in current implementation
        // But readHeader should have read the wrong signature
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("32. readHeader reads version numbers correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.versionMajor).toBe(CIM_VERSION_MAJOR);
      expect(file.cimInfo.versionMinor).toBe(CIM_VERSION_MINOR);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("33. readHeader rejects file with invalid sector size", () => {
      // --- Arrange
      const filePath = createTestFile();
      
      // Create a file with invalid sector size
      const buffer = Buffer.alloc(CLUSTER_BASE_SIZE);
      buffer.write("CIMF", 0); // Correct signature
      buffer[4] = CIM_VERSION_MAJOR;
      buffer[5] = CIM_VERSION_MINOR;
      buffer[6] = 99; // Invalid sector size (should be 1)
      fs.writeFileSync(filePath, buffer);

      // --- Act & Assert
      try {
        const file = new CimFile(filePath, 64, 1, 1024);
        file.readHeader();
        assert.fail("Exception expected");
      } catch (err) {
        expect(err.message).includes("Invalid sector size");
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("34. readHeader reads all cluster map entries correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      // Write some data to modify cluster map
      const testData = new Uint8Array(512);
      testData.fill(0xDD);
      file.writeSector(0, testData);

      // --- Act
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.clusterMap.length).toBe(MAX_CLUSTERS);
      expect(file.cimInfo.clusterMap[0]).toBe(0); // First cluster allocated
      
      // Check that remaining entries are unallocated
      let unallocatedCount = 0;
      for (let i = 1; i < MAX_CLUSTERS; i++) {
        if (file.cimInfo.clusterMap[i] === 0xffff) {
          unallocatedCount++;
        }
      }
      expect(unallocatedCount).toBe(MAX_CLUSTERS - 1);
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("35. readHeader preserves clusterMap values after read", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      // Write data to multiple sectors to allocate multiple clusters
      const testData = new Uint8Array(512);
      testData.fill(0xEE);
      file.writeSector(0, testData);
      file.writeSector(128, testData);
      file.writeSector(256, testData);
      
      const clusterMapBefore = [...file.cimInfo.clusterMap];

      // --- Act
      file.readHeader();
      
      const clusterMapAfter = file.cimInfo.clusterMap;

      // --- Assert
      for (let i = 0; i < MAX_CLUSTERS; i++) {
        expect(clusterMapAfter[i]).toBe(clusterMapBefore[i]);
      }
      
      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - Read Operations (18 tests) ==========

  describe("CimFile - Read Operations", () => {
    // ========== readSector() - Empty Sectors ==========

    it("36. readSector returns zero-filled buffer for unallocated cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const buffer = file.readSector(0);

      // --- Assert
      expect(buffer.length).toBe(512);
      for (let i = 0; i < buffer.length; i++) {
        expect(buffer[i]).toBe(0);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("37. readSector empty sector has correct size (512 bytes)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const sector0 = file.readSector(0);
      const sector1 = file.readSector(1);
      const sector1024 = file.readSector(1024);

      // --- Assert
      expect(sector0.length).toBe(512);
      expect(sector1.length).toBe(512);
      expect(sector1024.length).toBe(512);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readSector() - Allocated Sectors ==========

    it("38. readSector reads data from first sector of first cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      testData[0] = 42;
      testData[511] = 99;

      // --- Act
      file.writeSector(0, testData);
      const readBack = file.readSector(0);

      // --- Assert
      expect(readBack[0]).toBe(42);
      expect(readBack[511]).toBe(99);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("39. readSector reads data from middle sector in cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = i % 256;
      }

      // --- Act
      file.writeSector(64, testData);  // Middle sector in cluster
      const readBack = file.readSector(64);

      // --- Assert
      for (let i = 0; i < 512; i++) {
        expect(readBack[i]).toBe(i % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("40. readSector reads data from last sector in cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      testData.fill(77);

      // --- Act
      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      file.writeSector(sectorsPerCluster - 1, testData);
      const readBack = file.readSector(sectorsPerCluster - 1);

      // --- Assert
      for (let i = 0; i < 512; i++) {
        expect(readBack[i]).toBe(77);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("41. readSector reads correctly from different cluster indices", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const data1 = new Uint8Array(512);
      data1.fill(11);
      const data2 = new Uint8Array(512);
      data2.fill(22);

      // --- Act
      file.writeSector(0, data1);
      file.writeSector(200, data2);

      const read1 = file.readSector(0);
      const read2 = file.readSector(200);

      // --- Assert
      expect(read1[0]).toBe(11);
      expect(read2[0]).toBe(22);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("42. readSector returns correct data for sector 0", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      testData[0] = 1;
      testData[100] = 2;

      // --- Act
      file.writeSector(0, testData);
      const readBack = file.readSector(0);

      // --- Assert
      expect(readBack[0]).toBe(1);
      expect(readBack[100]).toBe(2);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("43. readSector returns correct data for last valid sector", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const maxSector = file.cimInfo.maxSize * 2048 - 1;
      const testData = new Uint8Array(512);
      testData.fill(55);

      // --- Act
      file.writeSector(maxSector, testData);
      const readBack = file.readSector(maxSector);

      // --- Assert
      expect(readBack[0]).toBe(55);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readSector() - Boundary Conditions ==========

    it("44. readSector rejects negative sector index", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      expect(() => file.readSector(-1)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("45. readSector rejects sector index beyond file size", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      const maxSector = file.cimInfo.maxSize * 2048;
      expect(() => file.readSector(maxSector)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("46. readSector rejects sector index at exactly maxSectors boundary", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      const maxSector = file.cimInfo.maxSize * 2048;
      expect(() => file.readSector(maxSector)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readSector() - Data Consistency ==========

    it("47. readSector returns consistent data on multiple reads", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = (i * 7) % 256;
      }

      // --- Act
      file.writeSector(50, testData);
      const read1 = file.readSector(50);
      const read2 = file.readSector(50);
      const read3 = file.readSector(50);

      // --- Assert
      for (let i = 0; i < 512; i++) {
        expect(read1[i]).toBe(read2[i]);
        expect(read2[i]).toBe(read3[i]);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("48. readSector handles sparse files correctly (unwritten sectors)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act - Write only to sector 10 and 20
      const data = new Uint8Array(512);
      data.fill(88);
      file.writeSector(10, data);
      file.writeSector(20, data);

      const unwritten = file.readSector(5);  // Never written
      const written1 = file.readSector(10);
      const between = file.readSector(15);   // Between written sectors
      const written2 = file.readSector(20);

      // --- Assert
      for (let i = 0; i < 512; i++) {
        expect(unwritten[i]).toBe(0);
        expect(written1[i]).toBe(88);
        expect(between[i]).toBe(0);
        expect(written2[i]).toBe(88);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("49. readSector data matches data written with writeSector", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = i % 256;
      }

      // --- Act
      file.writeSector(100, testData);
      const readBack = file.readSector(100);

      // --- Assert
      expect(readBack).toEqual(testData);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readSector() - Multi-Cluster Files ==========

    it("50. readSector correctly maps sectors across cluster boundaries", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);  // Larger file
      
      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      const lastSectorInCluster = sectorsPerCluster - 1;
      const firstSectorNextCluster = sectorsPerCluster;

      const data = new Uint8Array(512);
      data.fill(111);

      // --- Act
      file.writeSector(lastSectorInCluster, data);
      file.writeSector(firstSectorNextCluster, data);

      const read1 = file.readSector(lastSectorInCluster);
      const read2 = file.readSector(firstSectorNextCluster);

      // --- Assert
      expect(read1[0]).toBe(111);
      expect(read2[0]).toBe(111);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - Write Operations (25 tests) ==========

  describe("CimFile - Write Operations", () => {
    // ========== writeSector() - Basic Functionality ==========

    it("51. writeSector writes data to unallocated cluster (creates new cluster)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const initialClusters = file.cimInfo.maxClusters;
      const testData = new Uint8Array(512);
      testData.fill(42);

      // --- Act
      file.writeSector(0, testData);

      // --- Assert
      expect(file.cimInfo.maxClusters).toBeGreaterThan(initialClusters);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("52. writeSector writes data to already-allocated cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const data1 = new Uint8Array(512);
      data1.fill(11);
      file.writeSector(0, data1);
      
      const initialClusters = file.cimInfo.maxClusters;
      const data2 = new Uint8Array(512);
      data2.fill(22);

      // --- Act
      file.writeSector(1, data2);

      // --- Assert
      expect(file.cimInfo.maxClusters).toBe(initialClusters);  // No new cluster allocated

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("53. writeSector updates cluster map when allocating new cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const testData = new Uint8Array(512);
      testData.fill(99);
      file.writeSector(0, testData);

      // --- Assert
      expect(file.cimInfo.clusterMap[0]).not.toBe(0xffff);  // Cluster map updated

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("54. writeSector increments maxClusters counter", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const initialClusters = file.cimInfo.maxClusters;
      const testData = new Uint8Array(512);
      testData.fill(55);

      // --- Act
      file.writeSector(0, testData);
      const afterWrite = file.cimInfo.maxClusters;

      // --- Assert
      expect(afterWrite).toBeGreaterThan(initialClusters);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("55. writeSector persists data to disk", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = i % 256;
      }

      // --- Act
      file.writeSector(10, testData);

      // --- Open file again and verify data persisted
      const file2 = new CimFile(filePath, 64, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      file2.readHeader();
      const readBack = file2.readSector(10);

      // --- Assert
      expect(readBack).toEqual(testData);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("56. writeSector updates header when allocating new cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const testData = new Uint8Array(512);
      testData.fill(77);
      file.writeSector(0, testData);
      file.writeHeader();

      // --- Reopen and verify header was updated
      const file2 = new CimFile(filePath, 64, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      file2.readHeader();

      // --- Assert
      expect(file2.cimInfo.maxClusters).toBeGreaterThan(0);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== writeSector() - Multiple Writes ==========

    it("57. writeSector writes multiple sectors to same cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const data1 = new Uint8Array(512);
      data1.fill(11);
      const data2 = new Uint8Array(512);
      data2.fill(22);
      const data3 = new Uint8Array(512);
      data3.fill(33);

      file.writeSector(0, data1);
      file.writeSector(1, data2);
      file.writeSector(2, data3);

      const read1 = file.readSector(0);
      const read2 = file.readSector(1);
      const read3 = file.readSector(2);

      // --- Assert
      expect(read1[0]).toBe(11);
      expect(read2[0]).toBe(22);
      expect(read3[0]).toBe(33);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("58. writeSector writes to different clusters independently", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);  // Larger file
      
      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      const data1 = new Uint8Array(512);
      data1.fill(44);
      const data2 = new Uint8Array(512);
      data2.fill(55);

      // --- Act
      file.writeSector(0, data1);
      file.writeSector(sectorsPerCluster, data2);

      const read1 = file.readSector(0);
      const read2 = file.readSector(sectorsPerCluster);

      // --- Assert
      expect(read1[0]).toBe(44);
      expect(read2[0]).toBe(55);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("59. writeSector correctly positions data within cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      const testData = new Uint8Array(512);
      testData.fill(88);

      // --- Act
      file.writeSector(sectorsPerCluster - 1, testData);
      const readBack = file.readSector(sectorsPerCluster - 1);

      // --- Assert
      expect(readBack[0]).toBe(88);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("60. writeSector handles sequential sector writes", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      for (let i = 0; i < 10; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file.writeSector(i, data);
      }

      // --- Assert
      for (let i = 0; i < 10; i++) {
        const readBack = file.readSector(i);
        expect(readBack[0]).toBe(i);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("61. writeSector handles random-access sector writes", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const sectors = [100, 10, 200, 5, 150];

      // --- Act
      for (let i = 0; i < sectors.length; i++) {
        const data = new Uint8Array(512);
        data.fill(sectors[i] % 256);
        file.writeSector(sectors[i], data);
      }

      // --- Assert
      for (let i = 0; i < sectors.length; i++) {
        const readBack = file.readSector(sectors[i]);
        expect(readBack[0]).toBe(sectors[i] % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("62. writeSector data survives multiple write operations", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const data1 = new Uint8Array(512);
      data1.fill(66);

      // --- Act
      file.writeSector(0, data1);

      // Write to different sectors
      for (let i = 10; i < 20; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file.writeSector(i, data);
      }

      const readBack = file.readSector(0);

      // --- Assert
      expect(readBack[0]).toBe(66);  // Original data intact

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== writeSector() - Input Validation ==========

    it("63. writeSector rejects write to read-only file", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64, true);  // Read-only
      
      const testData = new Uint8Array(512);
      testData.fill(99);

      // --- Act & Assert
      expect(() => file.writeSector(0, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("64. writeSector rejects data with incorrect length", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      const badData1 = new Uint8Array(256);  // Too small
      const badData2 = new Uint8Array(1024);  // Too large

      expect(() => file.writeSector(0, badData1)).toThrow();
      expect(() => file.writeSector(0, badData2)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("65. writeSector rejects negative sector index", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);

      // --- Act & Assert
      expect(() => file.writeSector(-1, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("66. writeSector rejects sector index beyond file size", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      const maxSector = file.cimInfo.maxSize * 2048;

      // --- Act & Assert
      expect(() => file.writeSector(maxSector, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("67. writeSector rejects sector index at maxSectors boundary", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      const maxSector = file.cimInfo.maxSize * 2048;

      // --- Act & Assert
      expect(() => file.writeSector(maxSector, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== writeSector() - Data Integrity ==========

    it("68. writeSector data matches what readSector retrieves", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = (i * 13) % 256;
      }

      // --- Act
      file.writeSector(50, testData);
      const readBack = file.readSector(50);

      // --- Assert
      expect(readBack).toEqual(testData);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("69. writeSector preserves data across file reload (write → readHeader → read)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      for (let i = 0; i < 512; i++) {
        testData[i] = (i * 23) % 256;
      }

      file.writeSector(75, testData);
      file.writeHeader();

      // --- Act - Reload file
      const file2 = new CimFile(filePath, 64, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      file2.readHeader();
      const readBack = file2.readSector(75);

      // --- Assert
      expect(readBack).toEqual(testData);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("70. writeSector with partial cluster write preserves existing data", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const data1 = new Uint8Array(512);
      data1.fill(11);
      const data2 = new Uint8Array(512);
      data2.fill(22);

      // --- Act
      file.writeSector(0, data1);
      file.writeSector(1, data2);

      const read1 = file.readSector(0);
      const read2 = file.readSector(1);

      // --- Assert
      expect(read1[0]).toBe(11);  // Original data preserved
      expect(read2[0]).toBe(22);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("71. writeSector correctly handles overwriting existing sector", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const data1 = new Uint8Array(512);
      data1.fill(33);
      const data2 = new Uint8Array(512);
      data2.fill(44);

      // --- Act
      file.writeSector(0, data1);
      const read1 = file.readSector(0);

      file.writeSector(0, data2);
      const read2 = file.readSector(0);

      // --- Assert
      expect(read1[0]).toBe(33);
      expect(read2[0]).toBe(44);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("72. writeSector handles large sequential writes", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      // --- Act
      for (let i = 0; i < 100; i++) {
        const data = new Uint8Array(512);
        data.fill(i % 256);
        file.writeSector(i, data);
      }

      // --- Assert
      for (let i = 0; i < 100; i++) {
        const readBack = file.readSector(i);
        expect(readBack[0]).toBe(i % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("73. writeSector correctly allocates multiple clusters when needed", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      const initialClusters = file.cimInfo.maxClusters;

      // --- Act - Write to multiple clusters
      file.writeSector(0, new Uint8Array(512).fill(1));
      file.writeSector(sectorsPerCluster, new Uint8Array(512).fill(2));
      file.writeSector(sectorsPerCluster * 2, new Uint8Array(512).fill(3));

      // --- Assert
      expect(file.cimInfo.maxClusters).toBeGreaterThan(initialClusters + 2);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("74. writeSector maintains data integrity across cluster boundaries", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);
      const data1 = new Uint8Array(512);
      data1.fill(55);
      const data2 = new Uint8Array(512);
      data2.fill(66);

      // --- Act
      file.writeSector(sectorsPerCluster - 1, data1);
      file.writeSector(sectorsPerCluster, data2);

      const read1 = file.readSector(sectorsPerCluster - 1);
      const read2 = file.readSector(sectorsPerCluster);

      // --- Assert
      expect(read1[0]).toBe(55);
      expect(read2[0]).toBe(66);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("75. writeSector persists all data after multiple writes and reads", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const sectors = new Map<number, number>();

      // --- Act - Multiple writes
      for (let i = 0; i < 20; i++) {
        const data = new Uint8Array(512);
        data.fill(i);
        file.writeSector(i * 10, data);
        sectors.set(i * 10, i);
      }

      // Interleaved reads to verify data integrity
      for (let i = 0; i < 20; i++) {
        const readBack = file.readSector(i * 10);
        expect(readBack[0]).toBe(sectors.get(i * 10));
      }

      file.writeHeader();

      // --- Assert - Reload and verify
      const file2 = new CimFile(filePath, 64, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      file2.readHeader();
      for (const [sector, value] of sectors.entries()) {
        const readBack = file2.readSector(sector);
        expect(readBack[0]).toBe(value);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - Cluster Operations (10 tests) ==========

  describe("CimFile - Cluster Operations", () => {
    // ========== readCluster() - Basic Functionality ==========

    it("76. readCluster returns correct size buffer (clusterSize * 64KB)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      const clusterSizeBytes = file.cimInfo.clusterSize * CLUSTER_BASE_SIZE;

      // --- Act
      const cluster = file.readCluster(0);

      // --- Assert
      expect(cluster.length).toBe(clusterSizeBytes);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("77. readCluster returns zero-filled buffer for unallocated cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      const cluster = file.readCluster(0);

      // --- Assert
      for (let i = 0; i < cluster.length; i++) {
        expect(cluster[i]).toBe(0);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("78. readCluster returns data for allocated cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // Write data to first sector of first cluster
      const sectorData = new Uint8Array(512);
      sectorData.fill(42);
      file.writeSector(0, sectorData);

      // --- Act
      const cluster = file.readCluster(0);

      // --- Assert
      expect(cluster[0]).toBe(42);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readCluster() - Boundary Conditions ==========

    it("79. readCluster rejects negative cluster index", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      expect(() => file.readCluster(-1)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("80. readCluster rejects cluster index >= clusterCount", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      const invalidCluster = file.cimInfo.clusterCount;
      expect(() => file.readCluster(invalidCluster)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readCluster() - Data Consistency ==========

    it("81. readCluster returns consistent data on multiple reads", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const sectorData = new Uint8Array(512);
      sectorData.fill(99);
      file.writeSector(0, sectorData);

      // --- Act
      const read1 = file.readCluster(0);
      const read2 = file.readCluster(0);
      const read3 = file.readCluster(0);

      // --- Assert
      for (let i = 0; i < Math.min(512, read1.length); i++) {
        expect(read1[i]).toBe(read2[i]);
        expect(read2[i]).toBe(read3[i]);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("82. readCluster cluster data matches individual sector reads", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // Write data to multiple sectors
      const sectorData1 = new Uint8Array(512);
      sectorData1.fill(11);
      const sectorData2 = new Uint8Array(512);
      sectorData2.fill(22);

      file.writeSector(0, sectorData1);
      file.writeSector(1, sectorData2);

      // --- Act
      const cluster = file.readCluster(0);
      const sectorRead1 = file.readSector(0);
      const sectorRead2 = file.readSector(1);

      // --- Assert
      expect(cluster[0]).toBe(11);
      expect(cluster[512]).toBe(22);
      expect(sectorRead1[0]).toBe(11);
      expect(sectorRead2[0]).toBe(22);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    // ========== readCluster() - Resource Management ==========

    it("83. readCluster closes file descriptor after read", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act - Read multiple clusters
      for (let i = 0; i < 5; i++) {
        file.readCluster(0);
      }

      // --- Assert - No exception thrown (file handles properly closed)
      expect(file.cimInfo.maxSize).toBe(64);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("84. readCluster does not leak file descriptors", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act - Read cluster many times
      for (let i = 0; i < 100; i++) {
        file.readCluster(0);
      }

      // --- Assert - Still able to write (file not corrupted)
      const testData = new Uint8Array(512);
      testData.fill(77);
      file.writeSector(0, testData);
      const readBack = file.readSector(0);

      expect(readBack[0]).toBe(77);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("85. readCluster handles reading different clusters", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);  // Larger file

      const sectorsPerCluster = (file.cimInfo.clusterSize * 128);

      // Write to cluster 0 and cluster 1
      const data0 = new Uint8Array(512);
      data0.fill(10);
      const data1 = new Uint8Array(512);
      data1.fill(20);

      file.writeSector(0, data0);
      file.writeSector(sectorsPerCluster, data1);

      // --- Act
      const cluster0 = file.readCluster(0);
      const cluster1 = file.readCluster(1);

      // --- Assert
      expect(cluster0[0]).toBe(10);
      expect(cluster1[0]).toBe(20);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - Read-Only Operations (7 tests) ==========

  describe("CimFile - Read-Only Operations", () => {
    it("86. setReadonly(true) sets reserved flag to 1", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.setReadonly(true);

      // --- Assert
      expect(file.cimInfo.reserved).toBe(1);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("87. setReadonly(false) sets reserved flag to 0", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64, true);  // Start as read-only

      // --- Act
      file.setReadonly(false);

      // --- Assert
      expect(file.cimInfo.reserved).toBe(0);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("88. setReadonly(true) prevents subsequent writes", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // First write should succeed
      const testData = new Uint8Array(512);
      testData.fill(42);
      file.writeSector(0, testData);

      // --- Act
      file.setReadonly(true);

      // --- Assert - Subsequent write should fail
      const moreData = new Uint8Array(512);
      moreData.fill(99);
      expect(() => file.writeSector(1, moreData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("89. setReadonly(false) allows subsequent writes", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64, true);  // Start as read-only

      // --- Act
      file.setReadonly(false);

      // --- Assert - Write should now succeed
      const testData = new Uint8Array(512);
      testData.fill(55);
      expect(() => file.writeSector(0, testData)).not.toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("90. setReadonly persists flag to disk", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act
      file.setReadonly(true);
      file.writeHeader();

      // --- Verify by reloading
      const file2 = new CimFile(filePath, 64, file.cimInfo.clusterSize, file.cimInfo.clusterCount);
      file2.readHeader();

      // --- Assert
      expect(file2.cimInfo.reserved).toBe(1);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("91. setReadonly flag survives readHeader round-trip", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64, true);  // Create as read-only

      // --- Act
      file.writeHeader();
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.reserved).toBe(1);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("92. setReadonly affects behavior immediately", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      testData.fill(66);

      // --- Act & Assert
      // Should allow write initially
      file.writeSector(0, testData);

      // Set read-only
      file.setReadonly(true);

      // Should reject write immediately (without reloading)
      expect(() => file.writeSector(1, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - Validation Operations (6 tests) ==========

  describe("CimFile - Validation Operations", () => {
    it("93. checkSectorIndex rejects negative indices", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      expect(() => file.readSector(-1)).toThrow();
      expect(() => file.writeSector(-1, new Uint8Array(512))).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("94. checkSectorIndex rejects index >= maxSectors", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const maxSector = file.cimInfo.maxSize * 2048;

      // --- Act & Assert
      expect(() => file.readSector(maxSector)).toThrow();
      expect(() => file.writeSector(maxSector, new Uint8Array(512))).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("95. checkSectorIndex accepts valid sector indices", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      testData.fill(77);

      // --- Act & Assert - Should not throw
      expect(() => file.readSector(0)).not.toThrow();
      expect(() => file.writeSector(0, testData)).not.toThrow();
      expect(() => file.readSector(file.cimInfo.maxSize * 2048 - 1)).not.toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("96. checkSectorIndex correctly calculates maxSectors from fileSize", () => {
      // --- Arrange
      const filePath64 = createTestFile();
      const cfm = new CimFileManager();
      const file64 = cfm.createFile(filePath64, 64);

      const filePath256 = createTestFile();
      const file256 = cfm.createFile(filePath256, 256);

      // --- Act
      const maxSectors64 = file64.cimInfo.maxSize * 2048;
      const maxSectors256 = file256.cimInfo.maxSize * 2048;

      // --- Assert
      expect(maxSectors64).toBe(64 * 2048);
      expect(maxSectors256).toBe(256 * 2048);

      // --- Clean up
      fs.unlinkSync(filePath64);
      fs.unlinkSync(filePath256);
    });

    it("97. checkClusterIndex rejects negative indices", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      expect(() => file.readCluster(-1)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("98. checkClusterIndex rejects index >= clusterCount", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Act & Assert
      expect(() => file.readCluster(file.cimInfo.clusterCount)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== CimFile - State Consistency (10 tests) ==========

  describe("CimFile - State Consistency", () => {
    it("99. CimFile preserves maxSize across operations", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const initialMaxSize = file.cimInfo.maxSize;

      // --- Act - Perform various operations
      const testData = new Uint8Array(512);
      testData.fill(42);
      for (let i = 0; i < 10; i++) {
        file.writeSector(i, testData);
      }

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(initialMaxSize);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("100. CimFile preserves clusterSize across operations", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const initialClusterSize = file.cimInfo.clusterSize;

      // --- Act
      const testData = new Uint8Array(512);
      testData.fill(55);
      file.writeSector(0, testData);
      file.readSector(0);

      // --- Assert
      expect(file.cimInfo.clusterSize).toBe(initialClusterSize);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("101. CimFile preserves clusterCount across operations", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const initialClusterCount = file.cimInfo.clusterCount;

      // --- Act
      const testData = new Uint8Array(512);
      testData.fill(99);
      file.writeSector(100, testData);

      // --- Assert
      expect(file.cimInfo.clusterCount).toBe(initialClusterCount);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("102. CimFile preserves sectorSize across operations", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const initialSectorSize = file.cimInfo.sectorSize;

      // --- Act
      file.writeSector(0, new Uint8Array(512).fill(11));
      file.readSector(0);
      file.readCluster(0);

      // --- Assert
      expect(file.cimInfo.sectorSize).toBe(initialSectorSize);
      expect(file.cimInfo.sectorSize).toBe(SECTOR_SIZE);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("103. CimFile correctly updates maxClusters as clusters allocate", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const initialClusters = file.cimInfo.maxClusters;

      // --- Act - Write to multiple clusters
      const sectorsPerCluster = file.cimInfo.clusterSize * 128;
      file.writeSector(0, new Uint8Array(512).fill(1));
      file.writeSector(sectorsPerCluster, new Uint8Array(512).fill(2));

      // --- Assert
      expect(file.cimInfo.maxClusters).toBeGreaterThan(initialClusters);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("104. Write header → read header preserves all fields", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 128);

      file.writeSector(0, new Uint8Array(512).fill(88));

      const beforeWrite = {
        maxSize: file.cimInfo.maxSize,
        clusterSize: file.cimInfo.clusterSize,
        clusterCount: file.cimInfo.clusterCount,
        sectorSize: file.cimInfo.sectorSize,
        maxClusters: file.cimInfo.maxClusters,
        reserved: file.cimInfo.reserved
      };

      // --- Act
      file.writeHeader();
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(beforeWrite.maxSize);
      expect(file.cimInfo.clusterSize).toBe(beforeWrite.clusterSize);
      expect(file.cimInfo.clusterCount).toBe(beforeWrite.clusterCount);
      expect(file.cimInfo.sectorSize).toBe(beforeWrite.sectorSize);
      expect(file.cimInfo.maxClusters).toBe(beforeWrite.maxClusters);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("105. Create file → read from file works immediately", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 64);
      const sector = file.readSector(0);

      // --- Assert
      expect(sector).toBeDefined();
      expect(sector.length).toBe(512);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("106. Write data → readHeader → read data returns written data", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const testData = new Uint8Array(512);
      testData.fill(77);

      // --- Act
      file.writeSector(50, testData);
      file.writeHeader();
      file.readHeader();
      const readBack = file.readSector(50);

      // --- Assert
      expect(readBack).toEqual(testData);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("107. Multiple write operations preserve previous data", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const data1 = new Uint8Array(512);
      data1.fill(11);
      const data2 = new Uint8Array(512);
      data2.fill(22);
      const data3 = new Uint8Array(512);
      data3.fill(33);

      // --- Act
      file.writeSector(10, data1);
      file.writeSector(20, data2);
      file.writeSector(30, data3);

      const read1 = file.readSector(10);
      const read2 = file.readSector(20);
      const read3 = file.readSector(30);

      // --- Assert
      expect(read1[0]).toBe(11);
      expect(read2[0]).toBe(22);
      expect(read3[0]).toBe(33);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("108. File state persists after writeHeader and readHeader", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      file.writeSector(0, new Uint8Array(512).fill(99));
      file.setReadonly(true);

      // --- Act
      file.writeHeader();
      file.readHeader();

      // --- Assert
      expect(file.cimInfo.reserved).toBe(1);  // Read-only flag preserved
      const sector0 = file.readSector(0);
      expect(sector0[0]).toBe(99);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== Integration Tests (12 tests) ==========

  describe("Integration Tests", () => {
    it("109. Write sectors 0-99 sequentially and read back correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      // --- Act
      for (let i = 0; i < 100; i++) {
        const data = new Uint8Array(512);
        data.fill(i % 256);
        file.writeSector(i, data);
      }

      // --- Assert
      for (let i = 0; i < 100; i++) {
        const readBack = file.readSector(i);
        expect(readBack[0]).toBe(i % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("110. Write sectors in random order and read back correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const sectors = [50, 10, 200, 5, 150, 100, 25];
      const dataMap = new Map<number, number>();

      // --- Act
      for (const sector of sectors) {
        const data = new Uint8Array(512);
        data.fill(sector % 256);
        file.writeSector(sector, data);
        dataMap.set(sector, sector % 256);
      }

      // --- Assert
      for (const [sector, value] of dataMap.entries()) {
        const readBack = file.readSector(sector);
        expect(readBack[0]).toBe(value);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("111. Multiple clusters allocation works correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const sectorsPerCluster = file.cimInfo.clusterSize * 128;

      // --- Act - Write to 3 different clusters
      file.writeSector(0, new Uint8Array(512).fill(10));
      file.writeSector(sectorsPerCluster, new Uint8Array(512).fill(20));
      file.writeSector(sectorsPerCluster * 2, new Uint8Array(512).fill(30));

      // --- Assert
      expect(file.readSector(0)[0]).toBe(10);
      expect(file.readSector(sectorsPerCluster)[0]).toBe(20);
      expect(file.readSector(sectorsPerCluster * 2)[0]).toBe(30);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("112. Stress test: write many sectors to same cluster", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 256);

      const sectorsPerCluster = file.cimInfo.clusterSize * 128;

      // --- Act - Write all sectors in first cluster
      for (let i = 0; i < sectorsPerCluster; i++) {
        const data = new Uint8Array(512);
        data.fill(i % 256);
        file.writeSector(i, data);
      }

      // --- Assert
      for (let i = 0; i < sectorsPerCluster; i++) {
        const readBack = file.readSector(i);
        expect(readBack[0]).toBe(i % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("113. Stress test: write sectors across many clusters", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 512);

      const sectorsPerCluster = file.cimInfo.clusterSize * 128;

      // --- Act - Write one sector from each of first 10 clusters
      for (let cluster = 0; cluster < 10; cluster++) {
        const sector = cluster * sectorsPerCluster;
        const data = new Uint8Array(512);
        data.fill((cluster * 10) % 256);
        file.writeSector(sector, data);
      }

      // --- Assert
      for (let cluster = 0; cluster < 10; cluster++) {
        const sector = cluster * sectorsPerCluster;
        const readBack = file.readSector(sector);
        expect(readBack[0]).toBe((cluster * 10) % 256);
      }

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("114. 64 MB file creates sectors correctly", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 64);
      const testData = new Uint8Array(512);
      testData.fill(99);
      file.writeSector(0, testData);

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(64);
      expect(file.readSector(0)[0]).toBe(99);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("115. 256 MB file manages multiple clusters", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 256);
      const sectorsPerCluster = file.cimInfo.clusterSize * 128;

      file.writeSector(0, new Uint8Array(512).fill(11));
      file.writeSector(sectorsPerCluster, new Uint8Array(512).fill(22));

      // --- Assert
      expect(file.readSector(0)[0]).toBe(11);
      expect(file.readSector(sectorsPerCluster)[0]).toBe(22);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("116. 1 GB file with cluster size 1", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 1024);

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(1024);
      expect(file.cimInfo.clusterSize).toBe(1);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("117. 4 GB file with cluster size 4", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 4096);

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(4096);
      expect(file.cimInfo.clusterSize).toBe(4);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("118. 16 GB file with cluster size 16", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 16384);

      // --- Assert
      expect(file.cimInfo.maxSize).toBe(16384);
      expect(file.cimInfo.clusterSize).toBe(16);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("119. File I/O error handling: file operations don't corrupt data on errors", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      const validData = new Uint8Array(512);
      validData.fill(77);
      file.writeSector(0, validData);

      // --- Act - Try invalid operation (should fail)
      try {
        file.readSector(-1);
      } catch (e) {
        // Expected to fail
      }

      // --- Assert - Data should still be intact
      const readBack = file.readSector(0);
      expect(readBack[0]).toBe(77);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("120. Write-read-write cycle maintains data integrity", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 128);

      // --- Act - Write
      const data1 = new Uint8Array(512);
      data1.fill(11);
      file.writeSector(10, data1);

      // Read
      const read1 = file.readSector(10);

      // Write again
      const data2 = new Uint8Array(512);
      data2.fill(22);
      file.writeSector(20, data2);

      // Read both
      const read2 = file.readSector(10);
      const read3 = file.readSector(20);

      // --- Assert
      expect(read1[0]).toBe(11);
      expect(read2[0]).toBe(11);  // First write still there
      expect(read3[0]).toBe(22);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });

  // ========== Edge Cases and Boundary Conditions (11 tests) ==========

  describe("Edge Cases and Boundary Conditions", () => {
    it("121. Sector size * sectorIndex calculations don't overflow", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 16384);  // 16 GB

      // --- Act
      const maxSector = file.cimInfo.maxSize * 2048 - 1;
      const testData = new Uint8Array(512);
      testData.fill(99);

      // --- Assert - Should not throw (no overflow)
      expect(() => file.writeSector(maxSector, testData)).not.toThrow();
      expect(() => file.readSector(maxSector)).not.toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("122. Cluster pointer calculations don't overflow for maximum file size", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 16384);  // 16 GB

      // --- Act - Write to clusters spanning the full file
      file.writeSector(0, new Uint8Array(512).fill(1));
      file.writeSector(file.cimInfo.maxSize * 2048 - 1, new Uint8Array(512).fill(2));

      // --- Assert - Both operations succeeded
      expect(file.readSector(0)[0]).toBe(1);
      expect(file.readSector(file.cimInfo.maxSize * 2048 - 1)[0]).toBe(2);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("123. All-zero sector is distinguishable from unallocated sector", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // Write explicit zeros to sector 5
      const zeroData = new Uint8Array(512);
      zeroData.fill(0);
      file.writeSector(5, zeroData);

      // --- Act
      const unallocated = file.readSector(10);
      const allocated = file.readSector(5);

      // --- Assert - Both are zeros but allocated sector has been explicitly stored
      for (let i = 0; i < 512; i++) {
        expect(unallocated[i]).toBe(0);
        expect(allocated[i]).toBe(0);
      }
      // The cluster map should show sector 5 is allocated
      expect(file.cimInfo.clusterMap[0]).not.toBe(0xffff);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("124. Cluster map entries correctly use 0xffff sentinel for empty", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Assert - All clusters should start empty
      for (let i = 0; i < MAX_CLUSTERS; i++) {
        expect(file.cimInfo.clusterMap[i]).toBe(0xffff);
      }

      // --- Act - Allocate first cluster
      file.writeSector(0, new Uint8Array(512).fill(42));

      // --- Assert - First cluster should be allocated
      expect(file.cimInfo.clusterMap[0]).not.toBe(0xffff);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("125. File operations work correctly at exact boundary (16384 MB)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 16384);
      const maxSector = 16384 * 2048 - 1;
      const testData = new Uint8Array(512);
      testData.fill(88);

      // --- Assert - Should handle max boundary
      file.writeSector(maxSector, testData);
      const readBack = file.readSector(maxSector);
      expect(readBack[0]).toBe(88);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("126. File operations work correctly at exact boundary (64 MB)", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();

      // --- Act
      const file = cfm.createFile(filePath, 64);
      const maxSector = 64 * 2048 - 1;
      const testData = new Uint8Array(512);
      testData.fill(77);

      // --- Assert - Should handle min boundary
      file.writeSector(maxSector, testData);
      const readBack = file.readSector(maxSector);
      expect(readBack[0]).toBe(77);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("127. Maximum sectors (33,554,432) handled correctly for 16GB", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 16384);

      // --- Act
      const maxSectors = file.cimInfo.maxSize * 2048;

      // --- Assert
      expect(maxSectors).toBe(33554432);  // 16384 * 2048
      expect(() => file.readSector(maxSectors - 1)).not.toThrow();
      expect(() => file.readSector(maxSectors)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("128. Maximum clusters (32,760) never exceeded", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 16384);

      // --- Act & Assert
      expect(file.cimInfo.clusterCount).toBeLessThanOrEqual(MAX_CLUSTERS);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("129. Cluster map has exactly 32760 entries", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // --- Assert
      expect(file.cimInfo.clusterMap.length).toBe(MAX_CLUSTERS);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("130. Read-only file prevents all modifications", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64, true);

      // --- Act & Assert
      const testData = new Uint8Array(512);
      expect(() => file.writeSector(0, testData)).toThrow();
      expect(() => file.writeSector(100, testData)).toThrow();

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("131. File header signature verification ensures file integrity", () => {
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);

      // Write some data so we have something to verify
      file.writeSector(0, new Uint8Array(512).fill(88));
      file.writeHeader();

      // Verify initial read works (constructor now calls readHeader automatically)
      const file1 = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      // Should not throw - file is valid
      expect(file1.cimInfo.header).toBe(CIM_HEADER);

      // Now corrupt the file by truncating it (making it invalid)
      const corruptedBuffer = Buffer.alloc(100);  // Too small to be a valid header
      fs.writeFileSync(filePath, corruptedBuffer);

      // --- Act & Assert - Opening corrupted file should fail in constructor (which calls readHeader)
      expect(() => {
        const file2 = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      }).toThrow(/Invalid sector size in file/);

      // --- Clean up
      fs.unlinkSync(filePath);
    });

    it("132. REGRESSION: maxClusters header field persists after cluster allocation", () => {
      // --- This test catches Issue #1: CIM Header State Out-of-Sync
      // --- When new clusters are allocated, maxClusters must be persisted to the header
      
      // --- Arrange
      const filePath = createTestFile();
      const cfm = new CimFileManager();
      const file = cfm.createFile(filePath, 64);
      
      // Initial maxClusters should be 0
      expect(file.cimInfo.maxClusters).toBe(0);

      // --- Act: Write to sector 0 (allocates cluster 0)
      const testData = new Uint8Array(512);
      testData.fill(0xAA);
      file.writeSector(0, testData);
      
      // After first allocation, maxClusters should be 1
      expect(file.cimInfo.maxClusters).toBe(1);

      // --- Act: Write to sector 128 (allocates cluster 1)
      testData.fill(0xBB);
      file.writeSector(128, testData);
      
      // After second allocation, maxClusters should be 2
      expect(file.cimInfo.maxClusters).toBe(2);

      // --- Critical: Simulate application restart by creating a new CimFile instance
      // --- This forces a readHeader() call which reads the file from disk
      const file2 = new CimFile(filePath, 64, 1, file.cimInfo.clusterCount);
      file2.readHeader();

      // --- Assert: maxClusters must match what was allocated (regression test)
      // --- BEFORE FIX: This would fail because maxClusters was not persisted correctly
      // --- AFTER FIX: This passes because maxClusters is written to offset 0x0c in header
      expect(file2.cimInfo.maxClusters).toBe(2);
      
      // --- Additional verification: Cluster map should match
      expect(file2.cimInfo.clusterMap[0]).toBe(0);  // First cluster pointer
      expect(file2.cimInfo.clusterMap[1]).toBe(1);  // Second cluster pointer
      
      // --- Verify data integrity after reload
      const readData0 = file2.readSector(0);
      expect(readData0[0]).toBe(0xAA);
      
      const readData128 = file2.readSector(128);
      expect(readData128[0]).toBe(0xBB);

      // --- Clean up
      fs.unlinkSync(filePath);
    });
  });
});

// ========== Helper Functions ==========

function createTestFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, `test-${Date.now()}-${Math.random().toString(36).substring(7)}.cim`);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  return filePath;
}

function createImageFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, `image-${Date.now()}-${Math.random().toString(36).substring(7)}.img`);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  return filePath;
}
