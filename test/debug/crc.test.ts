import { describe, it } from "vitest";
import { calculateCRC7 } from "@emu/utils/crc";

describe("CRC7", () => {
  it("Sample #1", () => {
    // --- Act
    const crc = ((calculateCRC7(Uint8Array.from([0x48, 0x00, 0x00, 0x01, 0xaa])) << 1) | 0x01);

    // --- Assert
    console.log(crc);
  });

});