/**
 * Integration Example: Creating a NEX file from assembler output
 * 
 * This example demonstrates the complete flow from assembly source
 * to NEX file generation using the Klive Z80 Assembler.
 */

import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Example 1: Minimal NEX file
 * 
 * This creates a simple NEX file that sets the border color and loops.
 */
export async function createMinimalNex() {
  const source = `
    ; Minimal ZX Spectrum Next program
    .model Next
    
    ; Configure NEX file
    .savenex file "minimal.nex"
    .savenex ram 768
    .savenex border 5
    .savenex stackaddr 0xFF00
    
    ; Entry point in bank 5
    .bank 5
    .org 0xC000
    .ent $
    
Start:
    ld a, 5           ; Cyan color
    out (0xFE), a     ; Set border
Loop:
    halt
    jr Loop
  `;

  // Compile the source
  const options = new AssemblerOptions();
  options.currentModel = 4; // Spectrum Next
  
  const assembler = new Z80Assembler();
  const output = await assembler.compile(source, options);
  
  if (output.errors.length > 0) {
    console.error("Compilation errors:");
    for (const error of output.errors) {
      console.error(`  ${error.errorCode}: ${error.message}`);
    }
    return;
  }
  
  // Generate NEX file
  const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
  await fs.writeFile("minimal.nex", nexData);
  
  console.log("Created minimal.nex");
  console.log(`  Size: ${nexData.length} bytes`);
  console.log(`  Banks: ${output.nexConfig?.ramSize}K RAM`);
}

/**
 * Example 2: Multi-bank game structure
 * 
 * Demonstrates multiple banks with different code sections.
 */
export async function createMultiBankNex() {
  const source = `
    ; Multi-bank ZX Spectrum Next game
    .model Next
    
    ; Configure NEX file
    .savenex file "game.nex"
    .savenex ram 768
    .savenex border 0
    .savenex core 3, 1, 10
    .savenex stackaddr 0x5FFF
    .savenex entrybank 5
    
    ; Main code in bank 5
    .bank 5
    .org 0xC000
    .ent $
    
Main:
    ; Initialize
    ld a, 0
    out (0xFE), a
    
    ; Call level loader in bank 2
    nextreg 0x56, 2   ; Page bank 2 to slot 6
    call 0xC000       ; Call LoadLevel
    
GameLoop:
    halt
    jr GameLoop
    
    ; Level loader in bank 2
    .bank 2
    .org 0xC000
    
LoadLevel:
    ; Load level data
    ld hl, LevelData
    ld de, 0x4000
    ld bc, 256
    ldir
    ret
    
LevelData:
    .defb 0,1,2,3,4,5,6,7,8,9
    .defs 246, 0xFF
    
    ; Graphics data in bank 10
    .bank 10
    .org 0xC000
    
SpriteData:
    .defb 0x00,0x00,0x00,0x00
    .defb 0x00,0x18,0x18,0x00
    .defb 0x00,0x3C,0x3C,0x00
    .defb 0x00,0x7E,0x7E,0x00
  `;

  const options = new AssemblerOptions();
  options.currentModel = 4;
  
  const assembler = new Z80Assembler();
  const output = await assembler.compile(source, options);
  
  if (output.errors.length > 0) {
    console.error("Compilation errors:");
    for (const error of output.errors) {
      console.error(`  ${error.errorCode}: ${error.message}`);
    }
    return;
  }
  
  // Generate NEX file
  const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
  await fs.writeFile("game.nex", nexData);
  
  console.log("Created game.nex");
  console.log(`  Size: ${nexData.length} bytes`);
  console.log(`  Banks: ${output.segments.length}`);
  console.log(`  Entry: 0x${output.entryAddress?.toString(16).toUpperCase()}`);
}

/**
 * Example 3: NEX with loading screen
 * 
 * Note: This example requires actual screen/palette/copper files to exist.
 * In a real scenario, these would be created with graphics tools.
 */
export async function createNexWithScreen() {
  // First, create dummy resource files for demonstration
  await createDummyResources();
  
  const source = `
    ; NEX with loading screen
    .model Next
    
    ; Configure NEX file
    .savenex file "demo.nex"
    .savenex ram 768
    .savenex border 0
    .savenex core 3, 1, 10
    
    ; Loading screen and effects
    .savenex screen "layer2", "loading.scr"
    .savenex palette "colors.nxp"
    .savenex bar "on", 2, 10, 50
    
    ; Simple program
    .org 0x8000
    .ent $
    
Start:
    ld a, 7
    out (0xFE), a
    halt
    jr Start
  `;

  const options = new AssemblerOptions();
  options.currentModel = 4;
  
  const assembler = new Z80Assembler();
  const output = await assembler.compile(source, options);
  
  if (output.errors.length > 0) {
    console.error("Compilation errors:");
    for (const error of output.errors) {
      console.error(`  ${error.errorCode}: ${error.message}`);
    }
    return;
  }
  
  // Generate NEX file
  const nexData = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
  await fs.writeFile("demo.nex", nexData);
  
  console.log("Created demo.nex");
  console.log(`  Size: ${nexData.length} bytes`);
  console.log(`  Has loading screen: Yes`);
  console.log(`  Has palette: Yes`);
}

/**
 * Create dummy resource files for demonstration
 */
async function createDummyResources() {
  // Create a dummy Layer2 screen (256x192x8 = 49152 bytes)
  const screen = new Uint8Array(49152);
  // Fill with a simple pattern
  for (let i = 0; i < screen.length; i++) {
    screen[i] = (i % 256);
  }
  await fs.writeFile("loading.scr", screen);
  
  // Create a dummy palette (512 bytes)
  const palette = new Uint8Array(512);
  // Simple gradient palette
  for (let i = 0; i < 256; i++) {
    palette[i * 2] = i;     // Color value
    palette[i * 2 + 1] = 0; // Reserved
  }
  await fs.writeFile("colors.nxp", palette);
  
  console.log("Created dummy resource files:");
  console.log("  loading.scr (49152 bytes)");
  console.log("  colors.nxp (512 bytes)");
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log("=== NEX File Generation Examples ===\n");
  
  console.log("Example 1: Minimal NEX");
  await createMinimalNex();
  console.log();
  
  console.log("Example 2: Multi-bank Game");
  await createMultiBankNex();
  console.log();
  
  console.log("Example 3: NEX with Loading Screen");
  await createNexWithScreen();
  console.log();
  
  console.log("=== All examples completed ===");
}

// If run directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
