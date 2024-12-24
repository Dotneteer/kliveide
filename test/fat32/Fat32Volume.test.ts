import { describe, it, expect, assert } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import { CimFileManager } from "@main/fat32/CimFileManager";
import { ERROR_FAT_ENTRY_OUT_OF_RANGE, Fat32Volume } from "@main/fat32/Fat32Volume";
import {
  FAT_NAME_DELETED,
  FS_ATTR_ARCHIVE,
  FS_ATTR_DIRECTORY,
  FS_ATTR_LABEL,
  FS_ATTR_ROOT32,
  O_ACCMODE,
  O_RDONLY
} from "@main/fat32/Fat32Types";
import { FatLongFileName } from "@main/fat32/FatLongFileName";
import { FILE } from "dns";
import { FatDirEntry } from "@main/fat32/FatDirEntry";

const TEST_DIR = "testFat32";
const TEST_FILE = "test.cim";
const TEST_IMAGE_FILE = "testImage.img";
const SIZE_IN_MB = 64;

describe("FatVolume", () => {
  it("format works #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);

    // --- Act
    vol.format("MY VOLUME");

    // --- Assert
    vol.init();
    const root = vol.openRootDirectory();
    expect(root).not.toBeNull();
    expect(root.attributes).toBe(FS_ATTR_ROOT32 | FS_ATTR_DIRECTORY);
    expect(root.nameEntries.length).toBe(0);
    expect(root.sfnEntry).toBeNull();
    const entries = root.getDirectoryEntries();
    expect(entries.length).toBe(1);
    const entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_ARCHIVE | FS_ATTR_LABEL);
    expect(entry.DIR_Name).toBe("MY VOLUME  ");
  });

  it("Invalid FAT index fails #1", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act/Assert
    expect(() => vol.getFatEntry(1)).toThrowError(ERROR_FAT_ENTRY_OUT_OF_RANGE);
  });

  it("Invalid FAT index fails #2", () => {
    // --- Arrange
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act/Assert
    expect(() => vol.getFatEntry(vol.countOfFatEntries)).toThrowError(ERROR_FAT_ENTRY_OUT_OF_RANGE);
  });

  it("mkdir works #1", () => {
    // --- Arrange
    const FILENAME = "testDir";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(FILENAME);
    const imgFilePath = createImageFile();
    cfm.convertToImageFile(file, imgFilePath);

    // --- Assert
    const dir = vol.open(FILENAME, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(2);
    const name1 = new FatLongFileName(dir.nameEntries[0].buffer);
    expect(name1.LDIR_Name1[0]).toBe(FILENAME.charCodeAt(0)); // "t"
    expect(name1.LDIR_Name1[1]).toBe(FILENAME.charCodeAt(1)); // "e"
    expect(name1.LDIR_Name1[2]).toBe(FILENAME.charCodeAt(2)); // "s"
    expect(name1.LDIR_Name1[3]).toBe(FILENAME.charCodeAt(3)); // "t"
    expect(name1.LDIR_Name1[4]).toBe(FILENAME.charCodeAt(4)); // "D"
    expect(name1.LDIR_Name2[0]).toBe(FILENAME.charCodeAt(5)); // "i"
    expect(name1.LDIR_Name2[1]).toBe(FILENAME.charCodeAt(6)); // "r"
    expect(name1.LDIR_Name2[2]).toBe(0x00);
    expect(name1.LDIR_Name2[3]).toBe(0xffff);
    expect(name1.LDIR_Name2[4]).toBe(0xffff);
    expect(name1.LDIR_Name2[5]).toBe(0xffff);
    expect(name1.LDIR_Name3[0]).toBe(0xffff);
    expect(name1.LDIR_Name3[1]).toBe(0xffff);
    expect(name1.LDIR_Type).toBe(0x00);
    expect(name1.LDIR_Attr).toBe(0x0f);
    expect(name1.LDIR_FstClusLO).toBe(0x0000);

    const sfn = dir.sfnEntry;
    expect(sfn).not.toBeNull();
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("TESTDIR    ");
    expect(sfn.DIR_NTRes).toBe(0x00);
    expect(sfn.DIR_FstClusLO).toBe(0x03);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #2", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME = "inner1";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(1);
    const sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("INNER1     ");
    expect(sfn.DIR_NTRes).toBe(0x08);
    expect(sfn.DIR_FstClusLO).toBe(0x04);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #3", () => {
    // --- Arrange
    const DIR = "testDir/inner1";
    const FILENAME = "inner2";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(1);
    const sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("INNER2     ");
    expect(sfn.DIR_NTRes).toBe(0x08);
    expect(sfn.DIR_FstClusLO).toBe(0x05);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #4", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME = "inner1";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(DIR);
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(1);
    const sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("INNER1     ");
    expect(sfn.DIR_NTRes).toBe(0x08);
    expect(sfn.DIR_FstClusLO).toBe(0x04);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #5", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME1 = "inner1";
    const FILENAME2 = "inner2";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(DIR);
    vol.mkdir(`${DIR}/${FILENAME1}`);
    vol.mkdir(`${DIR}/${FILENAME1}/${FILENAME2}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME1}/${FILENAME2}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(1);
    const sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("INNER2     ");
    expect(sfn.DIR_NTRes).toBe(0x08);
    expect(sfn.DIR_FstClusLO).toBe(0x05);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #6", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME1 = "longinner1";
    const FILENAME2 = "longinner2";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(DIR);
    vol.mkdir(`${DIR}/${FILENAME1}`);
    vol.mkdir(`${DIR}/${FILENAME2}`);

    // --- Assert
    // --- "longinner1"
    let dir = vol.open(`${DIR}/${FILENAME1}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(2);

    let name1 = new FatLongFileName(dir.nameEntries[0].buffer);
    expect(name1.LDIR_Name1[0]).toBe(FILENAME1.charCodeAt(0)); // "l"
    expect(name1.LDIR_Name1[1]).toBe(FILENAME1.charCodeAt(1)); // "o"
    expect(name1.LDIR_Name1[2]).toBe(FILENAME1.charCodeAt(2)); // "n"
    expect(name1.LDIR_Name1[3]).toBe(FILENAME1.charCodeAt(3)); // "g"
    expect(name1.LDIR_Name1[4]).toBe(FILENAME1.charCodeAt(4)); // "i"
    expect(name1.LDIR_Name2[0]).toBe(FILENAME1.charCodeAt(5)); // "n"
    expect(name1.LDIR_Name2[1]).toBe(FILENAME1.charCodeAt(6)); // "n"
    expect(name1.LDIR_Name2[2]).toBe(FILENAME1.charCodeAt(7)); // "e"
    expect(name1.LDIR_Name2[3]).toBe(FILENAME1.charCodeAt(8)); // "r"
    expect(name1.LDIR_Name2[4]).toBe(FILENAME1.charCodeAt(9)); // "1"
    expect(name1.LDIR_Name2[5]).toBe(0x0000);
    expect(name1.LDIR_Name3[0]).toBe(0xffff);
    expect(name1.LDIR_Name3[1]).toBe(0xffff);
    expect(name1.LDIR_Type).toBe(0x00);
    expect(name1.LDIR_Attr).toBe(0x0f);
    expect(name1.LDIR_FstClusLO).toBe(0x0000);

    let sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("LONGIN~1   ");
    expect(sfn.DIR_NTRes).toBe(0x00);
    expect(sfn.DIR_FstClusLO).toBe(0x04);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    let entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");

    // --- "longinner2"
    dir = vol.open(`${DIR}/${FILENAME2}`, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(2);

    name1 = new FatLongFileName(dir.nameEntries[0].buffer);
    expect(name1.LDIR_Name1[0]).toBe(FILENAME2.charCodeAt(0)); // "l"
    expect(name1.LDIR_Name1[1]).toBe(FILENAME2.charCodeAt(1)); // "o"
    expect(name1.LDIR_Name1[2]).toBe(FILENAME2.charCodeAt(2)); // "n"
    expect(name1.LDIR_Name1[3]).toBe(FILENAME2.charCodeAt(3)); // "g"
    expect(name1.LDIR_Name1[4]).toBe(FILENAME2.charCodeAt(4)); // "i"
    expect(name1.LDIR_Name2[0]).toBe(FILENAME2.charCodeAt(5)); // "n"
    expect(name1.LDIR_Name2[1]).toBe(FILENAME2.charCodeAt(6)); // "n"
    expect(name1.LDIR_Name2[2]).toBe(FILENAME2.charCodeAt(7)); // "e"
    expect(name1.LDIR_Name2[3]).toBe(FILENAME2.charCodeAt(8)); // "r"
    expect(name1.LDIR_Name2[4]).toBe(FILENAME2.charCodeAt(9)); // "2"
    expect(name1.LDIR_Name2[5]).toBe(0x0000);
    expect(name1.LDIR_Name3[0]).toBe(0xffff);
    expect(name1.LDIR_Name3[1]).toBe(0xffff);
    expect(name1.LDIR_Type).toBe(0x00);
    expect(name1.LDIR_Attr).toBe(0x0f);
    expect(name1.LDIR_FstClusLO).toBe(0x0000);

    sfn = dir.sfnEntry;
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("LONGIN~2   ");
    expect(sfn.DIR_NTRes).toBe(0x00);
    expect(sfn.DIR_FstClusLO).toBe(0x05);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("mkdir works #7", () => {
    // --- Arrange
    const FILENAME = "TEST";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    vol.mkdir(FILENAME);

    // --- Assert
    const dir = vol.open(FILENAME, O_RDONLY);
    expect(dir).not.toBeNull();
    expect(dir.attributes).toBe(FS_ATTR_DIRECTORY);
    expect(dir.nameEntries.length).toBe(1);

    const sfn = dir.sfnEntry;
    expect(sfn).not.toBeNull();
    expect(sfn.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(sfn.DIR_Name).toBe("TEST       ");
    expect(sfn.DIR_NTRes).toBe(0x00);
    expect(sfn.DIR_FstClusLO).toBe(0x03);
    expect(sfn.DIR_FstClusHI).toBe(0x00);

    const entries = dir.getDirectoryEntries();
    expect(entries.length).toBe(2);
    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
  });

  it("rmDir works #1", () => {
    // --- Arrange
    const FILENAME = "testDir";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();
    vol.mkdir(FILENAME);

    // --- Act
    vol.rmDir(FILENAME);

    // --- Assert
    const dir = vol.open(FILENAME, O_RDONLY);
    expect(dir).toBeNull();
    const root = vol.openRootDirectory();
    expect(root).not.toBeNull();
    const entries = root.getDirectoryEntries();
    expect(entries.length).toBe(3);

    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_ARCHIVE | FS_ATTR_LABEL);
    expect(entry.DIR_Name).toBe("NO NAME    ");
    expect(entries[1].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });

  it("rmDir works #2", () => {
    // --- Arrange
    const FILENAME = "testDir with long file name";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();
    vol.mkdir(FILENAME);

    // --- Act
    vol.rmDir(FILENAME);

    // --- Assert
    const dir = vol.open(FILENAME, O_RDONLY);
    expect(dir).toBeNull();
    const root = vol.openRootDirectory();
    expect(root).not.toBeNull();
    const entries = root.getDirectoryEntries();
    expect(entries.length).toBe(5);

    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_ARCHIVE | FS_ATTR_LABEL);
    expect(entry.DIR_Name).toBe("NO NAME    ");
    expect(entries[1].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[3].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[4].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });

  it("rmDir works #3", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME = "inner1";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Act
    vol.rmDir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).toBeNull();
    const parent = vol.open(`${DIR}`, O_RDONLY);
    expect(parent).not.toBeNull();
    const entries = parent.getDirectoryEntries();
    expect(entries.length).toBe(3);

    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
    expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });

  it("rmDir works #4", () => {
    // --- Arrange
    const DIR = "testDir with long file name";
    const FILENAME = "inner1";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Act
    vol.rmDir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).toBeNull();
    const parent = vol.open(`${DIR}`, O_RDONLY);
    expect(parent).not.toBeNull();
    const entries = parent.getDirectoryEntries();
    expect(entries.length).toBe(3);

    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
    expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });

  it("rmDir works #5", () => {
    // --- Arrange
    const DIR = "testDir";
    const FILENAME = "this is a long file name";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();
    vol.mkdir(`${DIR}/${FILENAME}`);

    // --- Act
    vol.rmDir(`${DIR}/${FILENAME}`);

    // --- Assert
    const dir = vol.open(`${DIR}/${FILENAME}`, O_RDONLY);
    expect(dir).toBeNull();
    const parent = vol.open(`${DIR}`, O_RDONLY);
    expect(parent).not.toBeNull();
    const entries = parent.getDirectoryEntries();
    expect(entries.length).toBe(5);

    let entry = entries[0];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe(".          ");
    entry = entries[1];
    expect(entry.DIR_Attr).toBe(FS_ATTR_DIRECTORY);
    expect(entry.DIR_Name).toBe("..         ");
    expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[3].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    expect(entries[4].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });

  it("createFile works #1", () => {
    // --- Arrange
    const FILENAME = "testFile.txt";
    const filePath = createTestFile();
    const cfm = new CimFileManager();
    const file = cfm.createFile(filePath, SIZE_IN_MB);
    const vol = new Fat32Volume(file);
    vol.format();
    vol.init();

    // --- Act
    const newFile = vol.createFile(FILENAME);
    const myString = "Hello, world!";
    const encoder = new TextEncoder();
    const uint8array = encoder.encode(myString);
    newFile.writeFileData(uint8array);
    newFile.close();
    const imgFilePath = createImageFile();
    cfm.convertToImageFile(file, imgFilePath);

    // --- Assert
    // const dir = vol.open(FILENAME, O_RDONLY);
    // expect(dir).toBeNull();
    // const root = vol.openRootDirectory();
    // expect(root).not.toBeNull();
    // const entries = root.getDirectoryEntries();
    // expect(entries.length).toBe(3);

    // let entry = entries[0];
    // expect(entry.DIR_Attr).toBe(FS_ATTR_ARCHIVE | FS_ATTR_LABEL);
    // expect(entry.DIR_Name).toBe("NO NAME    ");
    // expect(entries[1].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
    // expect(entries[2].DIR_Name.charCodeAt(0)).toBe(FAT_NAME_DELETED);
  });
});

function createTestFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, TEST_FILE);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}

function createImageFile(): string {
  const homeDir = os.homedir();
  const testDir = path.join(homeDir, TEST_DIR);
  const filePath = path.join(testDir, TEST_IMAGE_FILE);

  // Ensure the test directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
  }
  return filePath;
}
