import path from "path";
import fs from "fs";
import { describe, it } from "vitest";

describe("Bootrom", () => {
  it("Generate bootrom file", () => {
    // const bootRomFile = path.join(__dirname, "../testfiles/bootrom_ab.txt");
    // const bootRomText = fs.readFileSync(bootRomFile, "utf8");
    // const bootRom = new Uint8Array(0x2000);
    // const lines = bootRomText.split("\n");
    // let counter = 0;
    // for (let i = 0; i < lines.length; i++) {
    //   const lineBytes = lines[i].trim().split(",");
    //   for (let j = 0; j < lineBytes.length; j++) {
    //     const lineByte = lineBytes[j].trim();
    //     if (lineByte.startsWith("x")) {
    //       bootRom[counter++] = parseInt(lineByte.substring(2, 4), 16);
    //     }
    //   }
    // }

    // fs.writeFileSync(
    //   path.join(
    //     process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"],
    //     "bootrom_ab.bin"
    //   ),
    //   bootRom
    // );
  });
});
