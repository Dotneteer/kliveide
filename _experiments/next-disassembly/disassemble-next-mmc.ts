import * as fs from "fs";
import * as path from "path";
import { Z80Disassembler } from "../src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection } from "../src/renderer/appIde/disassemblers/common-types";
import { MemorySectionType } from "../src/common/abstractions/MemorySection";
import { toHexa4, toHexa2 } from "../src/renderer/appIde/services/ide-commands";

/**
 * This script disassembles the enNxtmmc.rom file
 * and saves the output to nextmmc.txt in the next-disassembly folder
 */
async function disassembleNextMMC() {
  try {
    // --- Path to the ROM file
    const romPath = path.join(__dirname, "../src/public/roms/enNxtmmc.rom");
    
    // --- Check if ROM file exists
    if (!fs.existsSync(romPath)) {
      console.error(`ROM file not found: ${romPath}`);
      process.exit(1);
    }

    // --- Read the ROM file
    console.log(`Reading ROM file: ${romPath}`);
    const romData = fs.readFileSync(romPath);
    
    // --- Use the entire ROM data
    const romBytes = new Uint8Array(romData.buffer, romData.byteOffset, romData.length);
    
    console.log(`ROM size: ${romData.length} bytes`);
    console.log(`Disassembling ${romBytes.length} bytes...`);

    // --- Create memory section for disassembly
    const memSections: MemorySection[] = [];
    const endAddress = romBytes.length - 1;
    memSections.push(
      new MemorySection(0x0000, endAddress, MemorySectionType.Disassemble)
    );

    // --- Create disassembler with Z80N extended instruction set support
    const disassembler = new Z80Disassembler(
      memSections,
      romBytes,
      undefined,
      {
        allowExtendedSet: true,
        decimalMode: false
      }
    );

    // --- Perform disassembly
    console.log("Disassembling...");
    const result = await disassembler.disassemble(0x0000, endAddress);
    
    if (!result) {
      console.error("Disassembly failed");
      process.exit(1);
    }

    // --- Format output similar to DisassemblyCommand
    console.log(`Generated ${result.outputItems.length} disassembly items`);
    
    let output = "";
    output += "ZX Spectrum Next MMC ROM Disassembly\n";
    output += "=".repeat(119) + "\n";
    output += `File: enNxtmmc.rom\n`;
    output += `Address Range: $0000 - $${toHexa4(endAddress)} (0 - ${endAddress})\n`;
    output += `Total Instructions: ${result.outputItems.length}\n`;
    output += "=".repeat(119) + "\n\n";

    // --- Process each disassembly item
    result.outputItems.forEach((item) => {
      // Address and opcodes
      const address = toHexa4(item.address);
      const opCodes = item.opCodes
        .map((oc) => toHexa2(oc))
        .join(" ")
        .padEnd(13, " ");
      
      // Label (if present)
      const label = item.hasLabel
        ? `L${toHexa4(item.address)}:`.padEnd(12, " ")
        : "            ";
      
      // Instruction
      const instruction = item.instruction;
      
      // Format line: ADDRESS OPCODES LABEL INSTRUCTION
      output += `${address} ${opCodes} ${label} ${instruction}\n`;
    });

    // --- Save to file
    const outputPath = path.join(__dirname, "nextmmc.txt");
    fs.writeFileSync(outputPath, output, "utf-8");
    
    console.log(`\nDisassembly completed successfully!`);
    console.log(`Output saved to: ${outputPath}`);
    console.log(`File size: ${(output.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error("Error during disassembly:", error);
    process.exit(1);
  }
}

// --- Run the disassembly
disassembleNextMMC().then(() => {
  console.log("\nDone!");
}).catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
