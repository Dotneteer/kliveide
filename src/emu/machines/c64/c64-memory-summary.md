# C64 Memory Management Implementation Guide for TypeScript

This document provides a practical implementation guide for C64 memory management in TypeScript, based on the comprehensive analysis of VICE emulator source code.

## Overview: What You Need to Implement

To build an accurate C64 memory system, you need to implement:

1. **Memory Dispatch Tables**: Function pointer system for handling reads/writes
2. **32 Memory Configurations**: Different ROM/RAM combinations based on CPU port and cartridge lines
3. **CPU Port Emulation**: The 6510 processor port with capacitor effect
4. **I/O Area Handling**: VIC-II, CIA, SID, and Color RAM chips
5. **Performance Optimization**: Direct memory access for RAM/ROM regions
6. **DMA Operations**: VIC-II sprite/badline DMA and optional REU support

## Major Implementation Challenges

### Challenge 1: Memory Configuration System
**Problem**: The C64 has 32 different memory configurations determined by a 5-bit value combining CPU port bits and cartridge signals.

**VICE Reference**: 
- File: `src/c64/c64mem.c` 
- Key function: `mem_pla_config_changed()`
- Formula: `mem_config = (((~pport.dir | pport.data) & 0x7) | (export.exrom << 3) | (export.game << 4))`

**TypeScript Implementation Strategy**:
```typescript
interface MemoryConfiguration {
  basicRomVisible: boolean;
  kernalRomVisible: boolean; 
  chargenVisible: boolean;
  ioVisible: boolean;
  cartridgeRomlVisible: boolean;
  cartridgeRomhVisible: boolean;
}

class MemoryManager {
  private configurations: MemoryConfiguration[] = new Array(32);
  private currentConfig: number = 7; // Standard boot config
  
  private calculateConfiguration(cpuPortBits: number, exrom: boolean, game: boolean): number {
    return (cpuPortBits & 0x7) | (exrom ? 8 : 0) | (game ? 16 : 0);
  }
}
```

### Challenge 2: Function Pointer Dispatch System
**Problem**: Memory access needs dynamic dispatch based on current configuration and address.

**VICE Reference**: 
- File: `src/c64/c64mem.c`
- Arrays: `mem_read_tab[NUM_CONFIGS][0x101]`, `mem_write_tab[NUM_VBANKS][NUM_CONFIGS][0x101]`
- Types: `read_func_ptr_t`, `store_func_ptr_t`

**TypeScript Implementation Strategy**:
```typescript
type ReadFunction = (address: number) => number;
type WriteFunction = (address: number, value: number) => void;

class MemoryDispatchTable {
  private readTable: ReadFunction[][] = [];   // [config][page]
  private writeTable: WriteFunction[][][] = []; // [vbank][config][page]
  
  read(address: number): number {
    const page = address >>> 8;
    return this.readTable[this.currentConfig][page](address);
  }
  
  write(address: number, value: number): void {
    const page = address >>> 8;
    this.writeTable[this.currentVBank][this.currentConfig][page](address, value);
  }
}
```

### Challenge 3: CPU Port Capacitor Effect
**Problem**: Unused CPU port bits (3-7) exhibit "capacitor effect" - they retain values for ~350ms before decaying to 0.

**VICE Reference**: 
- File: `src/c64/c64mem.c`
- Constants: `C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES` (350000 cycles)
- Function: `zero_read()`, `zero_store()`

**TypeScript Implementation Strategy**:
```typescript
interface CapacitorBit {
  value: number;        // 0 or the bit value (e.g., 0x40 for bit 6)
  setTime: number;      // When the bit was last set (in cycles)
  falloffActive: boolean;
}

class CPUPort {
  private falloffCycles = 350000; // ~350ms at 1MHz
  private capacitorBits: CapacitorBit[] = new Array(8);
  
  read(address: number): number {
    if (address === 0x01) {
      let result = this.dataRead;
      
      // Check capacitor effect for unused input bits
      for (let bit = 3; bit <= 7; bit++) {
        if (!(this.direction & (1 << bit))) { // Input bit
          const cap = this.capacitorBits[bit];
          if (cap.falloffActive && (this.currentCycle - cap.setTime) < this.falloffCycles) {
            result |= cap.value; // Still holds charge
          }
        }
      }
      return result;
    }
    return this.memory[address];
  }
}
```

### Challenge 4: I/O Area Read-Back Differences
**Problem**: Many I/O areas return different values when read than what was written.

**VICE Reference**: 
- File: `src/c64/c64mem.c`
- Functions: `colorram_read()`, `vicii_read()`, `sid_read()`

**TypeScript Implementation Strategy**:
```typescript
class ColorRAM {
  private colorData = new Uint8Array(1024);
  
  read(address: number): number {
    const colorValue = this.colorData[address & 0x3ff];
    const phi1Data = this.vicii.getPhI1Data(); // VIC-II current bus data
    return colorValue | (phi1Data & 0xf0); // Lower 4 bits: color, upper 4: phi1
  }
  
  write(address: number, value: number): void {
    this.colorData[address & 0x3ff] = value & 0x0f; // Only store lower 4 bits
  }
}

class VICIIRegisters {
  read(address: number): number {
    switch (address) {
      case 0xd011: // Control register 1
        return (this.registers[address] & 0x7f) | ((this.rasterY & 0x100) >> 1);
      case 0xd012: // Current raster line
        return this.rasterY & 0xff;
      case 0xd020: // Border color  
        return this.registers[address] | 0xf0; // Upper 4 bits always 1
      // ... more registers
    }
  }
}
```

### Challenge 5: DMA Operations and Cycle Stealing
**Problem**: VIC-II and other chips steal CPU cycles for DMA operations.

**VICE Reference**: 
- File: `src/vicii/vicii-sprites.c`, `src/vicii/vicii-badline.c`
- Function: `maincpu_steal_cycles()`

**TypeScript Implementation Strategy**:
```typescript
class VICIIChip {
  private spriteDMA(spriteNumber: number): void {
    if (this.spriteEnabled & (1 << spriteNumber)) {
      // Fetch 3 bytes of sprite data
      const baseAddr = this.spritePointers[spriteNumber] * 64;
      this.spriteData[spriteNumber] = [
        this.memory.read(baseAddr + 0),
        this.memory.read(baseAddr + 1), 
        this.memory.read(baseAddr + 2)
      ];
      
      // Steal CPU cycles for DMA
      this.cpu.stealCycles(3);
    }
  }
  
  private badlineDMA(): void {
    // Fetch 40 character codes and colors
    for (let i = 0; i < 40; i++) {
      this.videoMatrix[i] = this.memory.read(this.screenBase + this.vc + i);
      this.colorMatrix[i] = this.colorRAM.read(0xd800 + this.vc + i);
    }
    
    // Steal 40 CPU cycles for badline
    this.cpu.stealCycles(40);
  }
}
```

## Implementation Roadmap

### Phase 1: Basic Memory System
1. **Memory Arrays**: Implement RAM, ROM, and Color RAM arrays
2. **Simple Dispatch**: Basic read/write function dispatch
3. **CPU Port**: Basic CPU port without capacitor effect
4. **Configuration 7**: Implement standard C64 memory map

**Files to study in VICE**:
- `src/c64/c64mem.c` - Core memory management
- `src/c64/c64meminit.c` - Memory initialization

### Phase 2: Complete Configuration System  
1. **All 32 Configs**: Implement complete PLA configuration table
2. **Cartridge Support**: Add EXROM/GAME line handling
3. **Bank Switching**: Implement VIC-II bank selection
4. **Optimization Tables**: Add `mem_read_base_tab` and `mem_read_limit_tab`

**Files to study in VICE**:
- `src/c64/c64memlimit.c` - Optimization boundary setup
- `src/c64/c64cart.h` - Cartridge export structure

### Phase 3: I/O Implementation
1. **VIC-II Registers**: Implement register read/write with proper masks
2. **Color RAM**: Implement phi1 data mixing
3. **CIA Ports**: Add timer and I/O port emulation
4. **SID Registers**: Add write-only register handling

**Files to study in VICE**:
- `src/vicii/vicii-mem.c` - VIC-II memory interface
- `src/c64/c64cia1.c`, `src/c64/c64cia2.c` - CIA implementations

### Phase 4: Advanced Features
1. **Capacitor Effect**: Add CPU port bit decay timing
2. **DMA Operations**: Implement VIC-II cycle stealing
3. **Watchpoints**: Add debugging support
4. **REU Support**: Optional RAM expansion unit

**Files to study in VICE**:
- `src/c64/cart/reu.c` - RAM Expansion Unit
- `src/vicii/vicii-sprites.c` - Sprite DMA implementation

## Key VICE Functions and Structures to Reference

### Core Memory Management
- **`mem_read()`** / **`mem_store()`**: Main memory access functions
- **`mem_config`**: Current memory configuration variable
- **`pport_t`**: CPU port structure with capacitor bit tracking
- **`export_t`**: Cartridge EXROM/GAME line structure

### Memory Initialization
- **`c64meminit()`**: Main memory system initialization
- **`mem_limit_init()`**: Optimization table setup
- **`mem_pla_config_changed()`**: Configuration change handler

### I/O Implementations
- **`colorram_read()`** / **`colorram_store()`**: Color RAM with phi1 mixing
- **`zero_read()`** / **`zero_store()`**: CPU port with capacitor effect
- **`vicii_read()`** / **`vicii_store()`**: VIC-II register handling

### DMA and Performance
- **`mem_mmu_translate()`**: Memory optimization translation
- **`maincpu_steal_cycles()`**: CPU cycle stealing for DMA
- **`sprite_dma_access()`**: Sprite DMA implementation

## Testing and Validation

### Essential Test Cases
1. **Memory Configuration**: Test all 32 memory configurations
2. **CPU Port**: Verify capacitor effect timing (Lorenz test suite)
3. **I/O Read-back**: Test Color RAM phi1 mixing and VIC-II register masks
4. **DMA Timing**: Verify sprite and badline cycle stealing
5. **Cartridge**: Test EXROM/GAME line combinations

### Compatibility Targets
- **Basic Software**: BASIC programs, simple games
- **Advanced Software**: Demos with timing dependencies
- **Test Suites**: Wolfgang Lorenz CPU tests
- **Cartridges**: Action Replay, Final Cartridge III

## Performance Considerations

### Optimization Strategies
1. **Hot Path Optimization**: Optimize common RAM/ROM access patterns
2. **Function Inlining**: Inline simple read/write functions
3. **Table Lookups**: Pre-calculate memory configuration tables
4. **TypedArrays**: Use TypedArrays for memory storage

### Memory Usage
- **RAM**: 64KB main system RAM
- **ROM**: 20KB (8KB BASIC + 8KB KERNAL + 4KB CHARGEN)
- **Color RAM**: 1KB video attribute memory
- **Dispatch Tables**: ~130KB for complete function pointer tables

This implementation guide provides a structured approach to building a compatible and accurate C64 memory system in TypeScript, with clear references to the proven VICE implementation for guidance and validation.
