import * as fs from "fs";
import * as path from "path";
import { Z80Disassembler } from "../src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection } from "../src/renderer/appIde/disassemblers/common-types";
import { MemorySectionType } from "../src/common/abstractions/MemorySection";
import { toHexa4, toHexa2 } from "../src/renderer/appIde/services/ide-commands";

/**
 * This script disassembles the second 16KB block (ROM 1) of the enAltZX.rom file
 * and saves the output to altRom1.txt in the next-disassembly folder.
 * The disassembly starts at address 0x0000 (not 0x4000).
 */
async function disassembleAltRom1() {
  try {
    // --- Path to the ROM file
    const romPath = path.join(__dirname, "../src/public/roms/enAltZX.rom");
    
    // --- Check if ROM file exists
    if (!fs.existsSync(romPath)) {
      console.error(`ROM file not found: ${romPath}`);
      process.exit(1);
    }

    // --- Read the ROM file
    console.log(`Reading ROM file: ${romPath}`);
    const romData = fs.readFileSync(romPath);
    
    // --- Extract second 16KB (bytes 0x4000-0x7FFF from file, disassembled as 0x0000-0x3FFF)
    const rom16k = new Uint8Array(romData.buffer, romData.byteOffset + 0x4000, Math.min(16384, romData.length - 0x4000));
    
    console.log(`ROM size: ${romData.length} bytes`);
    console.log(`Extracting ROM 1 (bytes 0x4000-0x7FFF from file)...`);
    console.log(`Disassembling ${rom16k.length} bytes starting at address 0x0000...`);

    // --- Create memory section for disassembly (starting at address 0)
    const memSections: MemorySection[] = [];
    memSections.push(
      new MemorySection(0x0000, 0x3FFF, MemorySectionType.Disassemble)
    );

    // --- Create disassembler with Z80N extended instruction set support
    const disassembler = new Z80Disassembler(
      memSections,
      rom16k,
      undefined,
      {
        allowExtendedSet: true,
        decimalMode: false
      }
    );

    // --- Perform disassembly
    console.log("Disassembling...");
    const result = await disassembler.disassemble(0x0000, 0x3FFF);
    
    if (!result) {
      console.error("Disassembly failed");
      process.exit(1);
    }

    // --- Format output similar to DisassemblyCommand
    console.log(`Generated ${result.outputItems.length} disassembly items`);
    
    let output = "";
    output += "ZX Spectrum Alt ROM Disassembly (ROM 1 - Second 16KB)\n";
    output += "=" .repeat(80) + "\n";
    output += `File: enAltZX.rom\n`;
    output += `Source ROM Block: ROM 1 (file bytes 0x4000-0x7FFF)\n`;
    output += `Disassembly Address Range: $0000 - $3FFF (0 - 16383)\n`;
    output += `Total Instructions: ${result.outputItems.length}\n`;
    output += "=" .repeat(80) + "\n\n";

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
    const outputPath = path.join(__dirname, "altRom1.txt");
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
disassembleAltRom1().then(() => {
  console.log("\nDone!");
}).catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
