import path from "path";
import fs from "fs";
import { describe, it } from "vitest";

describe("Bootrom", () => {
  it("Generate colors file", () => {
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

  it("Generate 9-bit colors file", () => {
    // const colorFile = path.join(__dirname, "../testfiles/nextcolors.csv");
    // const colorsText = fs.readFileSync(colorFile, "utf8");
    // const colorValues: string[] = [];
    // let lines = colorsText.split("\n");
    // for (let i = 0; i < lines.length; i++) {
    //   const segments = lines[i].split(";");
    //   colorValues.unshift("#" + segments[4].trim());
    // }

    // const color8File = path.join(__dirname, "../testfiles/nextcolors8.csv");
    // const colors8Text = fs.readFileSync(color8File, "utf8");
    // const color8Values: string[] = [];
    // lines = colors8Text.split("\n");
    // for (let i = 0; i < lines.length; i++) {
    //   const segments = lines[i].split(";");
    //   const index = parseInt(segments[0].trim(), 10);
    //   const value = parseInt(segments[3].trim(), 2);
    //   color8Values[index] = colorValues[value];
    // }

    // let outFile = "const zxNext9BitColors: string[] = [\n";
    // for (let i = 0; i < colorValues.length; i++) {
    //   outFile += `  "${colorValues[i]}",\n`;
    // }
    // outFile += "];\n\n";
    // outFile += "const zxNext8BitColors: string[] = [\n";
    // for (let i = 0; i < color8Values.length; i++) {
    //   outFile += `  "${color8Values[i]}",\n`;
    // }
    // outFile += "];\n\n";

    // fs.writeFileSync(
    //   path.join(
    //     process.env[process.platform == "win32" ? "USERPROFILE" : "HOME"],
    //     "zxNextColors.ts"
    //   ),
    //   outFile
    // );
  });

  it("Fix xa0", () => {
    const filename = "/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/disassembly/rom0.kz80.asm";
    const contents = fs.readFileSync(filename, "utf8");
    const updated = contents.replaceAll("\xa0", " ");
    fs.writeFileSync(filename, updated);
  });
});
