import { resolveHomeFilePath } from "../../main/projects";
import { BinaryWriter } from "./BinaryWriter";
import fs from "fs";
import path from "path";

const CPC_HEAD = "MV - CPCEMU Disk-File\r\nDisk-Info\r\n";
const CPC_EXT_HEAD = "EXTENDED CPC DSK File\r\nDisk-Info\r\n";
const TRACK_HEAD = "Track-Info\r\n";
const creator = "Klive IDE".padEnd(14, " ");

export function createDiskFile (
  foldername: string,
  filename: string,
  diskFormat: string
): string {
  const writer = new BinaryWriter();
  createDisk(writer, diskFormat);
  const fileExt = path.extname(filename);
  if (!fileExt) {
    filename += ".dsk";
  }
  const fileWithPath = foldername ? `${foldername}/${filename}` : filename;
  const fullPath = resolveHomeFilePath(fileWithPath);
  fs.writeFileSync(fullPath, writer.buffer);
  return fullPath;
}

function createDisk (writer: BinaryWriter, diskFormat: string): void {
  const isExtended = diskFormat.endsWith("e");
  const isDoubleSided = diskFormat.endsWith("d");

  // --- Write out disk header
  const head = isExtended ? CPC_EXT_HEAD : CPC_HEAD;
  for (let i = 0; i < head.length; i++) {
    writer.writeByte(head.charCodeAt(i));
  }

  // --- Write out disk creator
  for (let i = 0; i < creator.length; i++) {
    writer.writeByte(creator.charCodeAt(i));
  }

  // --- Write out disk geometry
  writer.writeByte(40);
  writer.writeByte(isDoubleSided ? 2 : 1);

  // --- Track size/Unused bytes
  writer.writeUint16(isExtended ? 0x0000 : 0x1300);

  // --- Write out track sizes
  const tracks = isDoubleSided ? 80 : 40;
  for (let i = 0; i < 204; i++) {
    writer.writeByte(isExtended && i < tracks ? 0x13 : 0x00);
  }

  // --- Create an empty buffer of sectors
  const emptySector = new Uint8Array(512);
  for (let i = 0; i < emptySector.length; i++) {
    emptySector[i] = 0xe5;
  }

  // --- Write out track data
  for (let trackIdx = 0; trackIdx < tracks; trackIdx++) {
    // --- Write out track information block
    for (let i = 0; i < TRACK_HEAD.length; i++) {
      writer.writeByte(TRACK_HEAD.charCodeAt(i));
    }

    // --- Write out 4 unused bytes
    writer.writeUint32(0x00);

    // --- Write out track geometry
    writer.writeByte(isDoubleSided ? Math.floor(trackIdx / 2) : trackIdx);
    writer.writeByte(isDoubleSided ? trackIdx % 2 : 0x00);

    // --- Write out 2 unused bytes
    writer.writeUint16(0x0000);

    // --- Write out track info
    writer.writeByte(0x02);
    writer.writeByte(0x09);
    writer.writeByte(0x4e);
    writer.writeByte(0xe5);

    for (let sectorIdx = 1; sectorIdx <= 9; sectorIdx++) {
      // --- Write out sector information block (C, H, R, N)
      writer.writeByte(isDoubleSided ? Math.floor(trackIdx / 2) : trackIdx);
      writer.writeByte(isDoubleSided ? trackIdx % 2 : 0x00);
      writer.writeByte(sectorIdx);
      writer.writeByte(0x02);

      // --- FDC status
      writer.writeUint16(0x0000);

      // --- Actual sector length/Unused bytes
      writer.writeUint16(isExtended ? 0x0200 : 0x0000);
    }

    // --- We have written 96 (24 + 9 * 8) bytes as the track header.
    // --- We should skip (160) 256-96 bytes to reach the sector data
    for (let i = 0; i < 160; i++) {
      writer.writeByte(0x00);
    }

    // --- Write out sector data
    for (let sectorIdx = 1; sectorIdx <= 9; sectorIdx++) {
      writer.writeBytes(emptySector);
    }
  }
}
