# C64 Memory Emulation in VICE

This document summarizes how the VICE emulator represents and manages C64 memory based on the analysis of `src/c64/c64mem.c`.

## Memory Representation

### Physical Memory Arrays
- **`mem_ram`**: Main 64KB system RAM array
- **`mem_chargen_rom`**: Character generator ROM
- **`mem_color_ram`**: 1KB color RAM for video attributes

### Memory Configuration System
The emulator uses a sophisticated table-based system with **32 possible memory configurations** (`NUM_CONFIGS`) and **4 video banks** (`NUM_VBANKS`):

- **`mem_read_tab`**: Function pointer tables for read operations `[NUM_CONFIGS][0x101]`
- **`mem_write_tab`**: Function pointer tables for write operations `[NUM_VBANKS][NUM_CONFIGS][0x101]`
- **`mem_read_base_tab`**: Base pointers for fast memory access
- **`mem_read_limit_tab`**: Memory access limits for optimization

## Memory Access Management

### Function Pointer Dispatch
Memory access is handled through function pointers that are dynamically configured based on the current memory configuration:
- **`_mem_read_tab_ptr`**: Current read function table
- **`_mem_write_tab_ptr`**: Current write function table

### Configuration-Driven Access
The memory configuration (`mem_config`) is determined by:
- CPU port bits 0-2 (from `pport.dir` and `pport.data`)
- Cartridge EXROM/GAME lines
- Current video bank (`vbank`)

## Special Memory Handling

### CPU Port Emulation (Addresses $00/$01)
Implements detailed 6510 CPU port behavior including:
- **Unused bit simulation**: Models the "capacitor effect" where unused input bits gradually decay to 0
- **Board-specific behavior**: Different timing for SX-64 vs regular C64
- **Falloff timing**: Uses precise cycle counting for bit decay (`C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES`)

### Bank Switching
- **Video banking**: 4 banks of 16KB each for VIC-II access
- **Memory expansions**: Support for Plus/4 256K, Plus60K, and C64 256K expansions
- **Cartridge integration**: Dynamic reconfiguration when cartridges are inserted

## Advanced Features

### Watchpoint Support
- **`mem_read_tab_watch`** and **`mem_write_tab_watch`**: Separate tables for debugging
- **`mem_toggle_watchpoints`**: Switches between normal and watched memory access

### Memory Banking for Monitor/Debugger
Provides multiple memory "banks" for debugging:
- **CPU bank**: Current CPU view of memory
- **RAM bank**: Raw RAM access
- **ROM bank**: ROM content access  
- **I/O bank**: I/O device access
- **Cart bank**: Cartridge memory access

### DMA Support
- **`mem_dma_read`** / **`mem_dma_store`**: Bypass CPU port for direct memory access
- Used by VIC-II and other devices that need unfiltered memory access

## Performance Optimizations

### Fast Memory Access
- **Base pointer optimization**: `mem_read_base_tab` provides direct pointers to memory regions when possible
- **Limit checking**: `mem_read_limit_tab` enables fast bounds checking for CPU optimization

### Memory Mapping Translation
- **`mem_mmu_translate`**: Converts logical addresses to physical memory pointers
- Enables the CPU emulator to use direct memory access for performance-critical code

This sophisticated system accurately emulates the C64's complex memory management while providing the flexibility needed for cartridges, memory expansions, and debugging tools.

## Memory Table System Details

### `mem_read_tab` and `mem_write_tab` Arrays

VICE uses sophisticated lookup tables to implement the C64's complex memory mapping system. These arrays provide fast memory access dispatch based on current memory configuration.

#### Array Dimensions and Structure

**`mem_read_tab`**: `[NUM_CONFIGS][0x101]`
- **First dimension (NUM_CONFIGS)**: Memory configuration index (0-31 for C64)
  - Represents different combinations of PLA inputs: GAME, EXROM, CHAREN, HIRAM, LORAM
  - Each configuration creates a different memory map (RAM vs ROM at different addresses)
- **Second dimension (0x101)**: Memory page index (0x00-0xFF, plus 0x100 for wraparound)
  - Maps 256-byte pages of the 64KB address space ($0000-$FFFF)
  - Entry 0x100 duplicates entry 0x00 for optimization

**`mem_write_tab`**: `[NUM_VBANKS][NUM_CONFIGS][0x101]`
- **First dimension (NUM_VBANKS)**: VIC-II bank selection (0-3 for C64)
  - VIC-II can access different 16KB banks of memory
  - Affects writes to shared memory areas (like color RAM)
- **Second dimension**: Same as `mem_read_tab` - memory configuration
- **Third dimension**: Same as `mem_read_tab` - memory page

#### Function Pointer Types

```c
typedef uint8_t read_func_t(uint16_t addr);
typedef read_func_t *read_func_ptr_t;
typedef void store_func_t(uint16_t addr, uint8_t value);
typedef store_func_t *store_func_ptr_t;
```

#### Initialization Process

The arrays are initialized during `c64meminit()` or similar machine-specific functions:

1. **Configuration loop**: For each memory configuration (0-31)
2. **Page setup**: For each 256-byte page (0x00-0xFF)
3. **Function assignment**: Based on current configuration:
   - **RAM areas**: `ram_read`/`ram_store`
   - **ROM areas**: `rom_read`/`rom_store` (or specific ROM functions)
   - **Zero page**: `zero_read`/`zero_store` (handles CPU port)
   - **I/O areas**: Specific chip handlers (VIC-II, CIA, etc.)
   - **Color RAM**: `colorram_read`/`colorram_store`

#### Common Function Pointer Values

**Read Functions:**
- **`ram_read`**: Standard RAM access
- **`zero_read`**: Zero page with CPU port emulation
- **`zero_read_dma`**: Zero page for DMA access (bypasses CPU port)
- **`rom_read`**: Basic ROM access
- **`colorram_read`**: Color RAM with phi1 data in upper bits
- **`vicii_read`**: VIC-II register access
- **`cia1_read`/`cia2_read`**: CIA chip registers
- **`sid_read`**: SID chip registers
- **`cartridge_read`**: Cartridge ROM/RAM access
- **`ultimax_romh_read`**: Ultimax cartridge high ROM

**Store Functions:**
- **`ram_store`**: Standard RAM writes
- **`zero_store`**: Zero page with CPU port handling
- **`zero_store_dma`**: Zero page for DMA writes
- **`rom_store`**: ROM area writes (usually ignored or special handling)
- **`colorram_store`**: Color RAM writes
- **`vicii_store`**: VIC-II register writes
- **`cia1_store`/`cia2_store`**: CIA register writes
- **`sid_store`**: SID register writes
- **`cartridge_store`**: Cartridge RAM writes
- **`store_dummy`**: Ignore writes (for ROM areas)

#### Function Implementation Examples

**Basic RAM Access:**
```c
uint8_t ram_read(uint16_t addr) {
    return mem_ram[addr];
}

void ram_store(uint16_t addr, uint8_t value) {
    mem_ram[addr] = value;
}
```

**Zero Page with CPU Port:**
```c
uint8_t zero_read(uint16_t addr) {
    addr &= 0xff;
    switch ((uint8_t)addr) {
        case 0: return pport.dir_read;    // CPU port direction
        case 1: return pport.data_read;   // CPU port data
    }
    return mem_ram[addr];
}
```

**Color RAM with VIC-II Phi1 Data:**
```c
uint8_t colorram_read(uint16_t addr) {
    return mem_color_ram[addr & 0x3ff] | (vicii_read_phi1() & 0xf0);
}
```

#### Memory Configuration Examples

**Configuration 0x07** (All RAM/ROM enabled):
- $0000-$0FFF: `zero_read`/`zero_store` (handles CPU port)
- $1000-$7FFF: `ram_read`/`ram_store`
- $8000-$9FFF: `rom_read`/`ram_store` (BASIC ROM)
- $A000-$BFFF: `ram_read`/`ram_store`
- $C000-$CFFF: `ram_read`/`ram_store`
- $D000-$DFFF: I/O functions (VIC-II, CIA, SID, etc.)
- $E000-$FFFF: `rom_read`/`ram_store` (KERNAL ROM)

**Configuration 0x1F** (16K Game cartridge):
- Similar to above but with cartridge functions at $8000-$9FFF and $E000-$FFFF

#### Memory Access Dispatch

Memory access uses these tables for fast dispatch:
```c
// Read operation
uint8_t mem_read(uint16_t addr) {
    return _mem_read_tab_ptr[addr >> 8](addr);
}

// Write operation  
void mem_store(uint16_t addr, uint8_t value) {
    _mem_write_tab_ptr[addr >> 8](addr, value);
}
```

Where `_mem_read_tab_ptr` points to `mem_read_tab[current_config]` and `_mem_write_tab_ptr` points to `mem_write_tab[current_vbank][current_config]`.

#### Watchpoint Support

Separate watchpoint tables (`mem_read_tab_watch`/`mem_write_tab_watch`) provide debugging support by intercepting memory access for monitoring and breakpoint functionality.

### `mem_read_base_tab` and `mem_read_limit_tab` Optimization Tables

VICE implements sophisticated CPU optimization through additional parallel tables that enable direct memory access for performance-critical code sections.

#### `mem_read_base_tab`: Direct Memory Pointers

**Structure**: `[NUM_CONFIGS][0x101]` array of `uint8_t*` pointers

**Purpose**: Provides direct pointers to physical memory regions, bypassing function call overhead for simple memory access.

**Implementation Details:**
- **Non-NULL entries**: Point to the start of a contiguous memory region
- **NULL entries**: Indicate that direct access is not possible (I/O, complex logic required)
- **Address calculation**: `direct_ptr = base_ptr + (addr & 0xFF)`

**Example Setup:**
```c
/* For RAM pages - direct access possible */
mem_read_base_tab[config][0x10] = mem_ram;  // Page $1000-$10FF points to RAM

/* For ROM pages - direct access with offset */
mem_read_base_tab[config][0xD0] = mem_chargen_rom - 0xD000;  // Character ROM

/* For I/O pages - no direct access */
mem_read_base_tab[config][0xD0] = NULL;  // VIC-II/CIA/SID require function calls
```

#### `mem_read_limit_tab`: CPU Optimization Boundaries

**Structure**: `[NUM_CONFIGS][0x101]` array of `uint32_t` values

**Purpose**: Defines memory regions where the CPU emulator can use fast execution modes and direct memory access.

**Bit Layout** (32-bit values):
- **Upper 16 bits**: Start address of optimizable region
- **Lower 16 bits**: End address of optimizable region
- **Value 0**: No optimization possible for this page

**Example Values:**
```c
/* RAM region $0000-$CFFF can be optimized */
mem_read_limit_tab[config][0x10] = 0x0002CFFD;  // Start=$0002, End=$CFFD

/* I/O region $D000-$DFFF cannot be optimized */
mem_read_limit_tab[config][0xD0] = 0x00000000;  // No optimization

/* ROM region $E000-$FFFF can be optimized */
mem_read_limit_tab[config][0xE0] = 0xE000FFFD;  // Start=$E000, End=$FFFD
```

#### Memory Management Unit (MMU) Translation

The `mem_mmu_translate()` function uses these tables to provide CPU optimization information:

```c
void mem_mmu_translate(unsigned int addr, uint8_t **base, int *start, int *limit)
{
    uint8_t *p = _mem_read_base_tab_ptr[addr >> 8];
    uint32_t limits;

    if (p != NULL && addr > 1) {
        /* Direct memory access possible */
        *base = p;
        limits = mem_read_limit_tab_ptr[addr >> 8];
        *limit = limits & 0xffff;         // Extract end address
        *start = limits >> 16;            // Extract start address
    } else {
        /* Fall back to cartridge or complex handling */
        cartridge_mmu_translate(addr, base, start, limit);
    }
}
```

#### CPU Optimization Benefits

**Fast Execution Modes:**
1. **Direct Memory Access**: CPU can read/write memory without function calls
2. **Bounds Checking**: Limit values enable fast verification of memory access validity
3. **Instruction Caching**: CPU can pre-fetch instructions from known-good memory regions
4. **Cycle Accuracy**: Optimization doesn't compromise timing accuracy

**When Optimization is Applied:**
- **Contiguous RAM regions**: Normal system RAM access
- **ROM regions**: Character generator, BASIC, KERNAL ROMs
- **Simple memory maps**: No banking, no special logic required

**When Optimization is Disabled:**
- **I/O regions**: VIC-II, CIA, SID registers require function dispatch
- **Cartridge areas**: Banking and special cartridge logic
- **Zero page exceptions**: CPU port handling at $00/$01
- **Complex memory configurations**: Dynamic banking scenarios

#### Initialization and Updates

**Setup Process:**
```c
void mem_limit_init(void) {
    /* Configure optimization boundaries for each memory configuration */
    for (config = 0; config < NUM_CONFIGS; config++) {
        for (page = 0x00; page <= 0xFF; page++) {
            if (page_is_simple_ram_or_rom(config, page)) {
                mem_read_base_tab[config][page] = get_memory_pointer(page);
                mem_read_limit_tab[config][page] = calculate_limits(config, page);
            } else {
                mem_read_base_tab[config][page] = NULL;
                mem_read_limit_tab[config][page] = 0x00000000;
            }
        }
    }
}
```

**Dynamic Updates:**
```c
void mem_pla_config_changed(void) {
    /* Update pointers when memory configuration changes */
    _mem_read_base_tab_ptr = mem_read_base_tab[mem_config];
    mem_read_limit_tab_ptr = mem_read_limit_tab[mem_config];
    
    /* Notify CPU emulator to resync optimization boundaries */
    maincpu_resync_limits();
}
```

#### Memory Expansion Support

**Plus60K/Plus256K/C64-256K:**
- Expansion-specific limit tables disable optimization for expanded regions
- Base pointers redirect to expansion memory when active
- CPU optimization automatically adapts to available memory

**Cartridge Integration:**
- Cartridge regions typically disable base pointer optimization
- Complex cartridge banking handled through function dispatch
- Ultimax mode and other special cases use cartridge-specific MMU translation

This dual-table optimization system allows VICE to achieve high performance while maintaining perfect compatibility and timing accuracy with the original C64 hardware.

## The 32 Memory Configurations Explained

The "32 possible memory configurations" are determined by a 5-bit value calculated as:

```c
mem_config = (((~pport.dir | pport.data) & 0x7) | (export.exrom << 3) | (export.game << 4));
```

### Bit Composition
- **Bits 0-2**: CPU port bits 0-2 (LORAM, HIRAM, CHAREN)
  - Bit 0 (LORAM): Controls BASIC ROM visibility 
  - Bit 1 (HIRAM): Controls KERNAL ROM visibility
  - Bit 2 (CHAREN): Controls Character ROM vs I/O area
- **Bit 3**: EXROM line from cartridge (inverted)
- **Bit 4**: GAME line from cartridge (inverted)

### Memory Map by Configuration

| Config | Binary | 8000-9FFF | A000-BFFF | D000-DFFF | E000-FFFF | Type |
|--------|---------|-----------|-----------|-----------|-----------|------|
| 0      | 00000   | RAM       | RAM       | RAM       | RAM       | All RAM |
| 1      | 00001   | RAM       | RAM       | CHARGEN   | RAM       | CHAREN only |
| 2      | 00010   | RAM       | RAM       | CHARGEN   | KERNAL    | CHAREN+HIRAM |
| 3      | 00011   | RAM       | BASIC     | CHARGEN   | KERNAL    | Full ROM |
| 4      | 00100   | RAM       | RAM       | RAM       | RAM       | All RAM |
| 5      | 00101   | RAM       | RAM       | I/O       | RAM       | I/O only |
| 6      | 00110   | RAM       | RAM       | I/O       | KERNAL    | I/O+HIRAM |
| 7      | 00111   | RAM       | BASIC     | I/O       | KERNAL    | Standard |
| 8-15   | 01xxx   | Same as 0-7 with EXROM asserted |
| 10     | 01010   | RAM       | CART ROMH | CHARGEN   | KERNAL    | |
| 11     | 01011   | CART ROML | BASIC/ROMH| CHARGEN   | KERNAL    | 8K Game |
| 14     | 01110   | RAM       | CART ROMH | I/O       | KERNAL    | |
| 15     | 01111   | CART ROML | BASIC/ROMH| I/O       | KERNAL    | 8K Game |
| 16-23  | 10xxx   | CART ROML | RAM       | I/O       | CART ROMH | Ultimax |
| 24-31  | 11xxx   | Same as 8-15 with both GAME and EXROM |
| 26     | 11010   | RAM       | CART ROMH | CHARGEN   | KERNAL    | |
| 27     | 11011   | CART ROML | CART ROMH | CHARGEN   | KERNAL    | 16K Game |
| 30     | 11110   | RAM       | CART ROMH | I/O       | KERNAL    | |
| 31     | 11111   | CART ROML | CART ROMH | I/O       | KERNAL    | 16K Game |

### Key Features
- **Configurations 0-7**: Normal C64 operation controlled by CPU port
- **Configurations 8-15**: EXROM asserted (adds cartridge ROM)
- **Configurations 16-23**: Ultimax mode (GAME=0, EXROM=1)
- **Configurations 24-31**: Both GAME and EXROM asserted

### Special Cases
- **Config 7**: Standard C64 boot configuration (BASIC + KERNAL + I/O)
- **Configs 16-23**: Ultimax cartridges take over $8000-$9FFF and $E000-$FFFF
- **Configs 11,15,27,31**: Game cartridges with different ROM combinations

## Querying EXROM and GAME Lines

The EXROM and GAME lines can be accessed through the global `export` structure defined in `src/c64/c64cart.h`:

```c
typedef struct {
    uint8_t exrom;          /* exrom signal, 0 = active */
    uint8_t game;           /* game signal, 0 = active */
    uint8_t ultimax_phi1;   /* flag for vic-ii, ultimax mode in phi1 phase */
    uint8_t ultimax_phi2;   /* flag for vic-ii, ultimax mode in phi2 phase */
} export_t;

extern export_t export;
```

### Access Methods

#### Direct Global Variable Access
```c
extern export_t export;

// Check current EXROM state (0 = active/asserted, 1 = inactive)
if (export.exrom == 0) {
    // EXROM is active
}

// Check current GAME state (0 = active/asserted, 1 = inactive)  
if (export.game == 0) {
    // GAME is active
}
```

#### Through Memory Configuration
The current memory configuration already incorporates these values:
```c
mem_config = (((~pport.dir | pport.data) & 0x7) | (export.exrom << 3) | (export.game << 4));

// Extract EXROM from memory config
int exrom = (mem_config >> 3) & 1;

// Extract GAME from memory config  
int game = (mem_config >> 4) & 1;
```

#### Monitor/Debugger Interface
VICE provides a monitor command `export` that displays current cartridge status:
```
(C64) export
Current mode: 16k game, GAME status: (0) (active), EXROM status: (0) (active)
```

### Cartridge Control Functions
Cartridges can modify these lines using:
```c
// Set EXROM line (0 = active, 1 = inactive)
cart_set_port_exrom_slotmain(int state);

// Set GAME line (0 = active, 1 = inactive)
cart_set_port_game_slotmain(int state);

// Notify system of configuration change
cart_port_config_changed_slotmain();
```

### Multi-Slot Support
VICE supports multiple cartridge slots with separate export structures:
- `export`: Final combined state seen by C64
- `export_slot1`: Slot 1 cartridge state
- `export_slotmain`: Main slot cartridge state  
- `export_passthrough`: Combined slot1 + main state

This allows complex cartridge combinations and passthrough scenarios.

### Hardware-Level Implementation: How the C64 Physically Reads EXROM and GAME

While the above describes how VICE emulates the EXROM and GAME signals in software, it's important to understand how the actual C64 hardware physically reads these signals from the expansion port.

#### C64 Expansion Port Pin Layout

The C64 expansion port is a 44-pin edge connector with the following relevant pins:
- **Pin 8**: /GAME line (active low)
- **Pin 9**: /EXROM line (active low)

These are digital input signals that are directly connected to the PLA (Programmable Logic Array) chip inside the C64.

#### The PLA Chip (906114-01)

The C64's memory management is handled by the PLA chip (part number 906114-01), which takes several inputs including:
- CPU address lines A0-A15
- CPU port bits (from $01)
- /GAME signal from expansion port pin 8
- /EXROM signal from expansion port pin 9
- Various other control signals

The PLA chip contains programmable logic that implements the 32 memory configurations described earlier. It directly reads the voltage levels on the /GAME and /EXROM pins and uses these as inputs to its internal logic equations.

#### Physical Signal Reading Process

1. **Direct Hardware Connection**: The /GAME and /EXROM pins are directly wired to input pins on the PLA chip
2. **Voltage Level Detection**: The PLA reads TTL-compatible voltage levels (0V = logic 0/active, +5V = logic 1/inactive)
3. **Real-Time Logic**: The PLA evaluates its programmed logic equations on every memory access cycle
4. **Output Generation**: Based on the input combination, the PLA generates appropriate chip select signals for RAM, ROM, and I/O

#### Signal Characteristics

- **Active Low**: Both signals are active low, meaning 0V = asserted, +5V = not asserted
- **TTL Compatible**: Standard TTL voltage levels and timing
- **Pull-up Resistors**: The C64 motherboard includes pull-up resistors on these lines, so if no cartridge is inserted, both lines default to +5V (inactive)
- **Real-Time Response**: The PLA responds to changes in these signals within nanoseconds

#### Cartridge Perspective

From a cartridge's perspective:
- To assert /GAME: Connect pin 8 to ground through appropriate logic
- To assert /EXROM: Connect pin 9 to ground through appropriate logic  
- To leave inactive: Leave pins floating (pulled high by motherboard resistors)

This hardware-level understanding explains why VICE maintains the `export.game` and `export.exrom` variables - they directly represent the logical state of these physical pins as read by the PLA chip.

## Programmatic Detection of EXROM and GAME Lines in 6510 Assembly

While the EXROM and GAME lines are not directly readable by the 6510 CPU, their states can be inferred programmatically through careful analysis of the memory configuration. Here are several assembly techniques for detecting cartridge presence and configuration:

### Method 1: Memory Map Analysis

The most reliable method is to test which memory regions are accessible, as different EXROM/GAME combinations create distinct memory maps:

```assembly
; Cartridge Detection Routine
; Returns: A = cartridge type
;   0 = No cartridge
;   1 = 8K cartridge (EXROM=0, GAME=1)  
;   2 = 16K cartridge (EXROM=0, GAME=0)
;   3 = Ultimax cartridge (EXROM=1, GAME=0)

cartridge_detect:
        ; Save current memory configuration
        lda $01
        pha
        
        ; Set CPU port to enable all ROM/RAM
        lda #$37        ; %00110111 - enable BASIC, KERNAL, I/O
        sta $01
        
        ; Test for BASIC ROM presence at $A000
        lda $a000       ; Read BASIC ROM signature
        cmp #$94        ; BASIC cold start vector low byte
        bne no_basic
        lda $a001  
        cmp #$e3        ; BASIC cold start vector high byte
        beq basic_present
        
no_basic:
        ; BASIC ROM not accessible - cartridge is present
        ; Now test what type by examining $8000-$9FFF
        
        ; Test for ROM at $8000 (ROML)
        lda $8000
        sta $02         ; Store test value
        eor #$ff        ; Flip all bits
        sta $8000       ; Try to write
        lda $8000
        cmp $02         ; Did it change?
        beq has_roml    ; No - it's ROM
        
        ; $8000 is RAM/not present
        ; Test for Ultimax mode by checking $E000 (ROMH)
        lda #$36        ; Disable KERNAL to test ROMH
        sta $01
        lda $e000
        sta $02
        eor #$ff
        sta $e000
        lda $e000
        cmp $02
        bne ultimax_cart ; It's RAM - Ultimax mode
        
        ; Restore and return no cartridge
        pla
        sta $01
        lda #0
        rts
        
has_roml:
        ; ROML present - test for ROMH at $A000 with BASIC disabled
        lda #$36        ; Disable BASIC, enable KERNAL/I/O
        sta $01
        lda $a000
        sta $02
        eor #$ff
        sta $a000
        lda $a000
        cmp $02
        beq has_romh    ; No change - it's ROM
        
        ; Only ROML - 8K cartridge
        pla
        sta $01
        lda #1
        rts
        
has_romh:
        ; Both ROML and ROMH - 16K cartridge
        pla
        sta $01
        lda #2
        rts
        
ultimax_cart:
        ; Ultimax cartridge detected
        pla
        sta $01
        lda #3
        rts
        
basic_present:
        ; BASIC accessible - no cartridge interfering
        pla
        sta $01
        lda #0
        rts
```

### Method 2: Memory Configuration Inference

Since the memory configuration includes EXROM/GAME states, you can infer them by testing the resulting memory layout:

```assembly
; Determine current EXROM/GAME state by testing memory configuration
; Returns: A = configuration bits
;   Bit 3 = EXROM state (0=active, 1=inactive)
;   Bit 4 = GAME state (0=active, 1=inactive)

get_exrom_game_state:
        ; Save current CPU port
        lda $01
        pha
        
        ; Test with CPU port = $37 (all ROM enabled)
        lda #$37
        sta $01
        
        ; Check if BASIC is accessible at $A000
        lda $a000
        cmp #$94        ; BASIC signature
        bne no_basic_access
        
        ; BASIC accessible - normal operation
        ; EXROM=1, GAME=1 (both inactive)
        pla
        sta $01
        lda #%00011000  ; Both EXROM and GAME inactive
        rts
        
no_basic_access:
        ; BASIC not accessible - cartridge active
        ; Test for 8K vs 16K vs Ultimax
        
        ; Disable BASIC to test ROMH
        lda #$36
        sta $01
        
        ; Test ROMH at $A000
        lda $a000
        sta $02
        eor #$ff
        sta $a000
        lda $a000
        cmp $02
        beq romh_present
        
        ; No ROMH - test for Ultimax
        lda #$35        ; Test with I/O disabled
        sta $01
        lda $e000       ; Test high ROM area
        sta $02
        eor #$ff
        sta $e000
        lda $e000
        cmp $02
        beq ultimax_mode
        
        ; 8K cartridge: EXROM=0, GAME=1
        pla
        sta $01
        lda #%00010000  ; EXROM active, GAME inactive
        rts
        
romh_present:
        ; 16K cartridge: EXROM=0, GAME=0
        pla
        sta $01
        lda #%00000000  ; Both EXROM and GAME active
        rts
        
ultimax_mode:
        ; Ultimax cartridge: EXROM=1, GAME=0
        pla
        sta $01
        lda #%00001000  ; EXROM inactive, GAME active
        rts
```

### Method 3: Signature-Based Detection

Many cartridges have recognizable signatures that can be detected:

```assembly
; Detect specific cartridge types by signature
; Returns: A = cartridge ID (0 = none, >0 = specific type)

detect_cartridge_type:
        lda $01
        pha
        
        ; Enable cartridge ROM access
        lda #$36
        sta $01
        
        ; Check for common cartridge signatures
        
        ; Test for Action Replay signature
        lda $8000
        cmp #$09        ; Action Replay signature byte 1
        bne not_action_replay
        lda $8001
        cmp #$80        ; Action Replay signature byte 2
        bne not_action_replay
        
        pla
        sta $01
        lda #1          ; Action Replay detected
        rts
        
not_action_replay:
        ; Test for Final Cartridge III
        lda $8004
        cmp #$c3        ; FC3 signature
        bne not_fc3
        lda $8005
        cmp #$c2
        bne not_fc3
        lda $8006
        cmp #$cd
        bne not_fc3
        
        pla
        sta $01
        lda #2          ; Final Cartridge III detected
        rts
        
not_fc3:
        ; Test for Simons' BASIC
        lda $8000
        cmp #$00        ; Simons' BASIC starts with BRK
        bne not_simons
        lda $8004       ; Check for BASIC signature
        cmp #$c3
        bne not_simons
        
        pla
        sta $01
        lda #3          ; Simons' BASIC detected
        rts
        
not_simons:
        ; Add more cartridge signatures as needed
        
        pla
        sta $01
        lda #0          ; No recognized cartridge
        rts
```

### Method 4: Dynamic Bank Switching Detection

For advanced cartridges with bank switching capabilities:

```assembly
; Test for bank-switching cartridge
; Returns: A = 1 if bank switching detected, 0 if not

detect_banking:
        lda $01
        pha
        lda #$36
        sta $01
        
        ; Read initial value from $8000
        lda $8000
        sta $02
        
        ; Try common banking registers
        ; Test $DE00 (common I/O area for cartridges)
        lda #$00
        sta $de00       ; Try to switch to bank 0
        lda $8000
        sta $03
        
        lda #$01  
        sta $de00       ; Try to switch to bank 1
        lda $8000
        cmp $03         ; Did content change?
        beq no_banking
        
        ; Banking detected
        pla
        sta $01
        lda #1
        rts
        
no_banking:
        pla
        sta $01
        lda #0
        rts
```

### Usage Notes

1. **Timing Considerations**: These routines should be run with interrupts disabled to avoid interference
2. **Memory Safety**: Always save and restore the CPU port ($01) state
3. **Cartridge Compatibility**: Some cartridges may have special initialization requirements
4. **False Positives**: ROM/RAM detection can be affected by cartridges that map RAM to ROM areas

### Example Usage

```assembly
main:
        sei             ; Disable interrupts
        jsr cartridge_detect
        cmp #0
        beq no_cart
        cmp #1
        beq cart_8k
        cmp #2  
        beq cart_16k
        cmp #3
        beq cart_ultimax
        
no_cart:
        ; Handle no cartridge case
        rts
        
cart_8k:
        ; Handle 8K cartridge
        rts
        
cart_16k:
        ; Handle 16K cartridge  
        rts
        
cart_ultimax:
        ; Handle Ultimax cartridge
        rts
```

These assembly techniques provide reliable methods for detecting cartridge presence and inferring EXROM/GAME line states from within C64 programs.

## The Capacitor Effect - CPU Port Unused Bits Emulation

### What is the Capacitor Effect?

The "capacitor effect" refers to a hardware quirk in the 6510 CPU where unused input pins (bits 3-7 of the processor port at $01) don't immediately read as 0. Instead, they retain their previous values for a period of time before gradually "decaying" to 0. This happens because these pins have small parasitic capacitances that hold charge when disconnected from external circuits.

### Real Hardware Behavior

On real C64 hardware:
- **Bits 0-2**: Used for memory banking (LORAM, HIRAM, CHAREN) - always connected
- **Bits 3-5**: Used for tape control but only on regular C64, not SX-64
- **Bits 6-7**: Always unused floating inputs subject to capacitor effect

### VICE Emulation Implementation

VICE accurately emulates this behavior through several mechanisms:

#### Timing Constants
```c
// Regular C64: ~350ms falloff time for 6510 CPU
#define C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES 350000

// SX-64: ~1500ms falloff time (longer decay)  
#define SX64_CPU6510_DATA_PORT_FALL_OFF_CYCLES 1500000

// C128: ~1500ms falloff time for 8500 CPU
#define C64_CPU8500_DATA_PORT_FALL_OFF_CYCLES 1500000

// Random variation (±20% of base time)
#define FALLOFF_RANDOM (C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES / 5)
```

#### Per-Bit State Tracking
Each unused bit has individual state variables:
```c
typedef struct pport_s {
    // Falloff timing for each bit
    CLOCK data_set_clk_bit3, data_set_clk_bit4, data_set_clk_bit5;
    CLOCK data_set_clk_bit6, data_set_clk_bit7;
    
    // Current bit values (0 or the bit value)
    uint8_t data_set_bit3, data_set_bit4, data_set_bit5;
    uint8_t data_set_bit6, data_set_bit7;
    
    // Falloff active flags
    uint8_t data_falloff_bit3, data_falloff_bit4, data_falloff_bit5;
    uint8_t data_falloff_bit6, data_falloff_bit7;
} pport_t;
```

#### Falloff Triggering Events

The capacitor effect is triggered when:

1. **Output to Input Transition**: When a bit changes from output mode to input mode, and the output bit was 1:
```c
if ((pport.dir & 0x40)) {  // Was output
    if ((pport.dir ^ value) & 0x40) {  // Now input
        pport.data_set_clk_bit6 = maincpu_clk + C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES + 
                                  lib_unsigned_rand(0, FALLOFF_RANDOM);
        pport.data_set_bit6 = pport.data & 0x40;  // Preserve current value
        pport.data_falloff_bit6 = 1;  // Start timer
    }
}
```

2. **Writing to Output Bits**: When writing to a bit that's set as output:
```c
if (pport.dir & 0x80) {  // Bit 7 is output
    pport.data_set_bit7 = value & 0x80;  // Set new value
    pport.data_set_clk_bit7 = maincpu_clk + C64_CPU6510_DATA_PORT_FALL_OFF_CYCLES + 
                              lib_unsigned_rand(0, FALLOFF_RANDOM);
    pport.data_falloff_bit7 = 1;  // Reset timer
}
```

#### Reading with Falloff Check

When reading $01, VICE checks if the falloff time has expired:
```c
// Check if falloff time expired
if (pport.data_falloff_bit6 && (pport.data_set_clk_bit6 < maincpu_clk)) {
    pport.data_falloff_bit6 = 0;  // Stop falloff
    pport.data_set_bit6 = 0;      // Bit now reads as 0
}

// For input bits, use capacitor value
if (!(pport.dir_read & 0x40)) {  // Bit 6 is input
    retval &= ~0x40;             // Clear bit
    retval |= pport.data_set_bit6;  // Set capacitor value
}
```

#### Board-Specific Differences

- **Regular C64**: Only bits 6-7 are affected (bits 3-5 are connected to tape port)
- **SX-64**: Bits 3-5 are also floating (not connected), so they also exhibit the effect
- **Timing differences**: SX-64 has longer falloff times than regular C64

### Real-World Impact

This effect is crucial for:
- **Compatibility**: Some programs rely on this timing for copy protection or timing loops
- **Test suites**: The Lorenz test suite specifically tests this behavior
- **Accurate emulation**: Ensures VICE behaves exactly like real hardware

### Programming Implications

Programmers can exploit this effect by:
1. Setting a bit to output mode and writing 1 to it
2. Switching it to input mode  
3. Reading it repeatedly to measure time passage
4. The bit will eventually read as 0 after the capacitor discharges

This creates a crude but effective timer mechanism that some software uses for timing-critical operations.

## The Wolfgang Lorenz Test Suite

### What is the Lorenz Test Suite?

The Wolfgang Lorenz Test Suite is a comprehensive collection of tests for the 6502/6510 CPU that was created by Wolfgang Lorenz to verify the accuracy of CPU emulation. It's particularly famous for testing edge cases and subtle timing behaviors that many emulators get wrong.

**Key Features:**
- Tests all 6502/6510 instructions and addressing modes
- Verifies flag behavior in edge cases  
- Tests undocumented/illegal opcodes
- **Importantly**: Tests the capacitor effect on CPU port bits
- Validates interrupt timing and behavior

### The cpuports.prg Test

The most relevant test for capacitor effect emulation is `cpuports.prg`, which specifically tests the behavior of unused CPU port bits. As noted in the VICE source code:

```c
/*
   cpuports.prg from the lorenz testsuite will fail when the falloff takes less
   than 5984 cycles. he explicitly delays by ~1280 cycles and mentions capacitance,
   so he probably even was aware of what happens.
*/
```

**What cpuports.prg Tests:**
- Sets unused port bits to 1 in output mode
- Switches them to input mode
- Waits a specific number of cycles (~1280)
- Reads the bits to verify they still return 1
- Waits longer and verifies they eventually decay to 0

This test validates that VICE's capacitor effect timing is accurate to real hardware.

### Where to Find the Test Suite

**Historical Locations:**
- Original package: `testsuite-2.15.tar.gz` by Christer Palm (repackaged from D64 format)
- Archive location: `http://jegt.net/~palm/testsuite-2.15.tar.gz` (no longer available)

**Current Availability:**
The original test suite files are now hard to find, but you can locate them through:

1. **Internet Archive/Wayback Machine**: Search for historical snapshots
2. **VICE Community**: The VICE development team has copies for testing
3. **C64 Scene Databases**: Sites like CSDb.dk may have archived versions
4. **Alternative Test Suites**: Modern alternatives include:
   - [SingleStepTests/ProcessorTests](https://github.com/SingleStepTests/ProcessorTests) - JSON-based processor tests
   - [macmade/MOS-6502-Tests](https://github.com/macmade/MOS-6502-Tests) - Modern 6502 test suite

### How to Use the Test Suite with VICE

**Running Tests:**
1. Download the test suite files (.prg format)
2. Load them in VICE using the monitor or autostart
3. The tests will run automatically and report PASS/FAIL results
4. Tests that fail indicate emulation inaccuracies

**VICE Integration:**
VICE developers use the Lorenz test suite during development to:
- Validate CPU emulation accuracy
- Test capacitor effect timing
- Verify undocumented instruction behavior
- Ensure timing-critical compatibility

**Expected Results:**
- All tests should PASS on accurately emulated systems
- `cpuports.prg` specifically validates capacitor effect timing
- Failures indicate areas where emulation needs improvement

### Test Environment Requirements

When running the tests outside a C64 environment, you need to provide:

**Memory Layout:**
```
$0002 = $00     ; Zero page setup
$A002 = $00     ; Test environment setup  
$A003 = $80
$FFFE = $48     ; IRQ vector (low)
$FFFF = $FF     ; IRQ vector (high)
$01FE = $FF     ; Stack setup
$01FF = $7F
```

**IRQ Handler:** A simple IRQ handler at $FF48 that preserves registers
**System Calls:** Trap handlers for KERNAL functions like print character ($FFD2), load ($E16F), etc.
**CPU State:** Start with S=$FD, P=$04, PC=$0801

### Impact on VICE Development

The Lorenz test suite has been instrumental in VICE development:
- Helped identify and fix numerous CPU emulation bugs
- Validated the capacitor effect implementation
- Ensured compatibility with timing-sensitive software
- Provided a benchmark for emulation accuracy

The fact that VICE passes all Lorenz tests (including `cpuports.prg`) demonstrates the high accuracy of its 6510 CPU and capacitor effect emulation.

## C64 DMA Operations and Implementation in VICE

Direct Memory Access (DMA) is crucial for the C64's performance, allowing hardware components to transfer data without CPU intervention. The C64 uses DMA extensively for graphics, sprite rendering, and memory expansion devices.

## The VIC-II Chip: Primary DMA Controller

**The VIC-II video interface controller (chip numbers 6567/6569/8562/8565) is the main hardware element that implements DMA in the C64.** This chip serves as both the video controller and the primary DMA controller for the system.

### VIC-II DMA Capabilities

The VIC-II chip implements several types of DMA operations:

1. **Sprite DMA**: Fetches sprite data from memory for display
2. **Character/Color DMA**: Fetches screen and color data during "badlines"  
3. **Refresh DMA**: Performs DRAM refresh cycles to maintain memory integrity
4. **Memory arbitration**: Controls when the CPU vs VIC-II can access memory

### VIC-II Bus Arbitration

The VIC-II has higher bus priority than the 6510 CPU and can "steal" memory cycles:

```c
/* VIC-II bus arbitration in VICE */
static inline void vicii_steal_cycles(void)
{
    /* VIC-II takes priority over CPU for memory access */
    if (vicii_dma_active) {
        maincpu_stolen_cycles++;
        /* CPU must wait while VIC-II performs DMA */
    }
}
```

**Hardware Implementation:**
- **Address Bus Control**: VIC-II can drive the address bus (A0-A13) independently of CPU
- **Data Bus Access**: VIC-II reads memory data directly during its allocated cycles  
- **RAS/CAS Control**: VIC-II generates DRAM control signals for memory access
- **PHI2 Coordination**: DMA operations are synchronized with the system clock

### VIC-II Memory Access Windows

The VIC-II accesses memory during specific time slots:
- **PHI1 Phase**: VIC-II can access memory while CPU is in internal operations
- **Stolen Cycles**: VIC-II can force CPU to wait during critical display operations
- **Refresh Cycles**: VIC-II performs mandatory DRAM refresh every 40 µs

### 7.1 VIC-II Sprite DMA

The VIC-II video chip performs DMA operations to fetch sprite data for display. This is the most common DMA operation in C64 systems.

**Implementation in VICE** (`src/vicii/vicii-sprites.c`):
```c
/* Sprite DMA cycle timing */
static void sprite_dma_access(int sprite_num, int cycle)
{
    if (sprite_enabled_mask & (1 << sprite_num)) {
        /* Fetch 3 bytes of sprite data per sprite per line */
        sprite_data[sprite_num][0] = dma_read(sprite_address + 0);
        sprite_data[sprite_num][1] = dma_read(sprite_address + 1);
        sprite_data[sprite_num][2] = dma_read(sprite_address + 2);
        
        /* Set DMA active flag to steal CPU cycles */
        dma_msk |= (1 << sprite_num);
    }
}
```

**Technical Details:**
- **Timing**: Sprite DMA occurs during specific VIC-II cycles (55-62 for sprites 0-7)
- **Data Volume**: 3 bytes per sprite per scanline when sprite is active
- **CPU Impact**: Each sprite DMA access steals one CPU cycle
- **Priority**: VIC-II has higher priority than CPU during DMA cycles

### 7.2 Badline DMA for Character Display

Badlines are special scanlines where the VIC-II fetches character and color data for text display, representing one of the most intensive DMA operations.

**Implementation in VICE** (`src/vicii/vicii-badline.c`):
```c
static void badline_dma_access(void)
{
    int i;
    
    /* Fetch 40 character codes and colors during badline */
    for (i = 0; i < 40; i++) {
        /* Character data fetch */
        video_matrix[i] = dma_read(screen_base + vc + i);
        
        /* Color data fetch */
        color_matrix[i] = color_ram_read(0xD800 + vc + i);
    }
    
    /* Steal CPU cycles during badline */
    dma_maincpu_steal_cycles(40);  /* 40 cycles for character/color fetch */
}
```

**Badline Characteristics:**
- **Frequency**: Every 8th scanline in text mode (scanlines 51, 59, 67, etc.)
- **Data Transfer**: 40 bytes of character data + 40 nibbles of color data
- **CPU Penalty**: CPU is completely halted for 40 cycles
- **Memory Access**: Sequential reads from screen memory and color RAM

### 7.3 REU (RAM Expansion Unit) DMA

The REU provides sophisticated DMA operations for bulk memory transfers, implemented in `src/c64/cart/reu.c`.

**DMA Transfer Types**:
```c
typedef enum {
    REU_DMA_TRANSFER    = 0x90,  /* C64 → REU transfer */
    REU_DMA_RETRANSFER  = 0x91,  /* REU → C64 transfer */
    REU_DMA_SWAP        = 0x92,  /* C64 ↔ REU swap */
    REU_DMA_VERIFY      = 0x93   /* C64 ⇄ REU compare */
} reu_dma_type_t;
```

**Implementation Example**:
```c
static void reu_dma_execute(int transfer_type)
{
    uint16_t c64_addr = reu_registers[REU_C64_ADDR_LO] | 
                       (reu_registers[REU_C64_ADDR_HI] << 8);
    uint32_t reu_addr = reu_registers[REU_REU_ADDR_LO] | 
                       (reu_registers[REU_REU_ADDR_MID] << 8) |
                       (reu_registers[REU_REU_ADDR_HI] << 16);
    uint16_t length = reu_registers[REU_LENGTH_LO] | 
                     (reu_registers[REU_LENGTH_HI] << 8);
    
    switch (transfer_type) {
        case REU_DMA_TRANSFER:
            /* Copy from C64 memory to REU memory */
            for (int i = 0; i < length; i++) {
                reu_memory[reu_addr + i] = mem_read(c64_addr + i);
            }
            break;
            
        case REU_DMA_RETRANSFER:
            /* Copy from REU memory to C64 memory */
            for (int i = 0; i < length; i++) {
                mem_store(c64_addr + i, reu_memory[reu_addr + i]);
            }
            break;
    }
    
    /* DMA steals CPU cycles proportional to transfer length */
    maincpu_steal_cycles(length * 2);  /* 2 cycles per byte transferred */
}
```

**REU DMA Features:**
- **Transfer Size**: Up to 64KB in single operation
- **Memory Types**: Can access all 64KB C64 memory + up to 16MB REU memory
- **Addressing Modes**: Auto-increment for both source and destination
- **Performance**: Approximately 2-3× faster than CPU-based copying

### 7.4 Drive DMA Operations

Some advanced disk drives use DMA for data transfer, particularly the PC8477 floppy controller used in 1581 drives.

**Implementation** (`src/drive/pc8477.c`):
```c
/* PC8477 DMA transfer control */
typedef struct {
    int dma_enabled;
    int dma_direction;  /* 0=read, 1=write */
    uint8_t *dma_buffer;
    int dma_length;
    int dma_position;
} pc8477_dma_t;

static void pc8477_dma_transfer(pc8477_dma_t *dma)
{
    if (dma->dma_enabled && !dma->nodma) {
        /* Execute DMA transfer */
        if (dma->dma_direction == 0) {
            /* DMA read from disk to buffer */
            fdc_read_sector_dma(dma->dma_buffer, dma->dma_length);
        } else {
            /* DMA write from buffer to disk */
            fdc_write_sector_dma(dma->dma_buffer, dma->dma_length);
        }
    }
}
```

### 7.5 DMA Performance Impact

All DMA operations affect CPU timing in VICE through the cycle stealing mechanism:

```c
/* Main CPU cycle stealing for DMA operations */
void maincpu_steal_cycles(int cycles)
{
    /* Delay CPU execution by specified cycles */
    maincpu_clk += cycles;
    
    /* Update other chips accordingly */
    vicii_delay_clk(cycles);
    sid_delay_clk(cycles);
    cia1_delay_clk(cycles);
    cia2_delay_clk(cycles);
}
```

**Performance Characteristics:**
- **Sprite DMA**: 1 cycle per byte, intermittent during visible scanlines
- **Badline DMA**: 40 cycles stolen every 8th scanline in text mode
- **REU DMA**: 2 cycles per byte for large block transfers
- **Drive DMA**: Variable depending on transfer size and drive type

## Writing to ROM Areas: Underlying RAM Access

When you write to memory areas where ROM is currently paged in, the C64 hardware and VICE emulation behave in specific ways depending on the address range and memory configuration. The key principle is that **writes always go to the underlying RAM**, never to the ROM itself (which is read-only).

### ROM Write Behavior by Address Range

| Address Range | ROM Type | Write Behavior | Configuration Dependency | Notes |
|---------------|----------|----------------|--------------------------|-------|
| **$A000-$BFFF** | BASIC ROM | Writes to underlying RAM | Configs 3, 7, 11, 15 | When BASIC ROM is paged in, writes go through to RAM underneath |
| **$E000-$FFFF** | KERNAL ROM | Writes to underlying RAM | Configs 2, 3, 6, 7, 10, 11, 14, 15, 26, 27, 30, 31 | When KERNAL ROM is paged in, writes go through to RAM |
| **$D000-$DFFF** | Character ROM | Writes to underlying RAM | Configs 1, 2, 3, 9, 10, 11, 26, 27 | When CHARGEN is paged in, writes go to RAM underneath |
| **$8000-$9FFF** | ROML (Cart) | Depends on cartridge type | Game/Ultimax modes | Some carts allow writes, others ignore or write to RAM |
| **$A000-$BFFF** | ROMH (Cart) | Depends on cartridge type | Game/Ultimax modes | Some carts allow writes, others ignore or write to RAM |
| **$1000-$7FFF** | Ultimax mode | Usually ignored or open bus | Ultimax configurations | Behavior varies by cartridge implementation |

### Detailed Write Behavior Analysis

#### BASIC ROM Area ($A000-$BFFF)
```c
// VICE implementation: writes always go to RAM
// No special write hook - uses default ram_store()
void write_basic_area(uint16_t addr, uint8_t value) {
    mem_ram[addr] = value;  // Direct RAM write
}
```

**Memory Configurations where BASIC ROM is visible:**
- Config 3: LORAM=1, HIRAM=1, CHAREN=1 (Standard BASIC mode)
- Config 7: LORAM=1, HIRAM=1, CHAREN=1, I/O visible
- Config 11: 8K Game cartridge with BASIC ROM
- Config 15: 8K Game cartridge with BASIC ROM and I/O

**Practical Impact:**
- `POKE 40960,123` writes 123 to RAM at $A000, even when BASIC ROM is active
- Switching ROM out later reveals the written value
- Self-modifying code can be stored in this area for later execution

#### KERNAL ROM Area ($E000-$FFFF)
```c
// VICE implementation: writes always go to RAM
// No special write hook - uses default ram_store()
void write_kernal_area(uint16_t addr, uint8_t value) {
    mem_ram[addr] = value;  // Direct RAM write
}
```

**Memory Configurations where KERNAL ROM is visible:**
- Configs 2, 3, 6, 7: Standard C64 modes with KERNAL
- Configs 10, 11, 14, 15: Game cartridge modes with KERNAL
- Configs 26, 27, 30, 31: 16K cartridge modes with KERNAL

**Special Considerations:**
- Interrupt vectors at $FFFA-$FFFF can be modified in RAM
- Custom KERNAL routines can be installed in RAM
- Reset vector modification affects system behavior

#### Character ROM Area ($D000-$DFFF)
```c
// VICE implementation: writes always go to RAM
// No special write hook - uses default ram_store()
void write_chargen_area(uint16_t addr, uint8_t value) {
    mem_ram[addr] = value;  // Direct RAM write
}
```

**Memory Configurations where Character ROM is visible:**
- Configs 1, 2, 3: CHAREN=0 modes
- Configs 9, 10, 11: Game cartridge modes with CHARGEN
- Configs 26, 27: 16K cartridge modes with CHARGEN

**Usage Patterns:**
- Custom character sets stored in RAM at $D000
- Graphics data preparation while CHARGEN is active
- VIC-II bank switching preparation

#### Cartridge ROM Areas ($8000-$9FFF, $A000-$BFFF in cartridge modes)

**ROML Area ($8000-$9FFF):**
- **Standard behavior**: Writes go to underlying RAM via `roml_no_ultimax_store()`
- **Cartridge-specific**: Some cartridges (Expert, DQBB, etc.) intercept writes
- **Final action**: Usually `ram_store(addr, value)` after cartridge handling

**ROMH Area ($A000-$BFFF in cartridge configurations):**
- **Standard behavior**: Writes go to underlying RAM via `romh_no_ultimax_store()`
- **Cartridge-specific**: Some cartridges may intercept or modify behavior
- **Final action**: Usually `ram_store(addr, value)` after cartridge handling

### Programming Implications

#### Safe ROM Overlay Technique
```assembly
; Store code in RAM while ROM is active
lda #$34        ; Bank out BASIC ROM
sta $01
lda #<routine   ; Copy routine to BASIC area
sta $fb
lda #>routine
sta $fc
ldy #0
:
lda code_start,y
sta $a000,y
iny
bne :-

lda #$37        ; Bank ROM back in
sta $01
; Code is now in RAM underneath BASIC ROM
```

#### Interrupt Vector Modification
```assembly
; Modify interrupt vectors in RAM while KERNAL is active
sei
lda #<irq_handler
sta $fffe       ; Write to RAM underneath KERNAL ROM
lda #>irq_handler  
sta $ffff
cli
; Vector change takes effect when KERNAL is banked out
```

### VICE Implementation Details

The VICE emulator implements this behavior through the memory dispatch system:

1. **Memory configuration tables** determine which read function is used
2. **Write functions** are separate and typically default to `ram_store()`
3. **No special write protection** for ROM areas - all writes go to RAM
4. **Cartridge hooks** may intercept writes before they reach RAM

This accurate emulation allows C64 software to use advanced memory management techniques that depend on the ability to write to RAM underneath active ROM.

### 7.6 DMA in Demo Programming

C64 demo programmers often exploit DMA timing for effects:

**Sprite Multiplexing**: Using precisely timed sprite DMA to display more than 8 sprites
**Badline Manipulation**: Triggering or avoiding badlines for timing control
**REU Streaming**: Using REU DMA for real-time data streaming effects

This comprehensive DMA system in VICE ensures accurate emulation of the C64's sophisticated memory access patterns, critical for compatibility with timing-sensitive software and advanced hardware configurations.

## 12. I/O Areas with Read-Back Differences

Several I/O chip areas in the C64 exhibit different values when reading back immediately after writing. This occurs due to unused register bits, hardware masks, and chip-specific behavior. The following table details these memory areas:

| Address Range | Chip | Description | Read-Back Behavior | Implementation |
|---------------|------|-------------|-------------------|----------------|
| $D800-$DBFF | Color RAM | Video color memory | Lower 4 bits: written value<br>Upper 4 bits: VIC-II phi1 data | `mem_color_ram[addr & 0x3ff] \| (vicii_read_phi1() & 0xf0)` |
| $D000-$D02E | VIC-II | Video registers | Varies by register | Register-specific masks and unused bits |
| $D400-$D7FF | SID | Sound registers | Write-only registers read as bus data | Many registers are write-only |
| $DC00-$DCFF | CIA1 | Timer/I/O registers | Varies by register | Timer states, I/O port combinations |
| $DD00-$DDFF | CIA2 | Timer/I/O registers | Varies by register | Timer states, I/O port combinations |

### 12.1 Color Memory ($D800-$DBFF)

The color memory area is the most well-known example of read-back differences:

```c
void colorram_store(uint16_t addr, uint8_t value)
{
    mem_color_ram[addr & 0x3ff] = value & 0xf;  // Only lower 4 bits stored
}

uint8_t colorram_read(uint16_t addr)
{
    return mem_color_ram[addr & 0x3ff] | (vicii_read_phi1() & 0xf0);
}
```

**Behavior**: 
- **Written**: Any 8-bit value
- **Read Back**: Lower 4 bits contain the color value, upper 4 bits contain VIC-II phi1 bus data
- **Example**: Write $FF, might read back $3F (if VIC-II phi1 data is $30)

**VIC-II Phi1 Data Explanation**:

The VIC-II phi1 data represents whatever the VIC-II chip is reading from memory during the phi1 phase of each cycle. This data varies by cycle position within each scanline and includes:

- **Graphics Data**: Character or bitmap data being fetched for current display
- **Sprite Pointers**: Sprite pointer values from screen memory + $3F8-$3FF  
- **Sprite Data**: Actual sprite pixel data
- **Refresh Data**: RAM refresh accesses to keep DRAM refreshed
- **Idle Data**: Default $FF value when VIC-II is not actively fetching

The specific phi1 data depends on:
1. **Current raster cycle** (0-62 for PAL, 0-64 for NTSC)  
2. **VIC-II video mode** (text, bitmap, multicolor, etc.)
3. **Current display state** (border, active area, badline, etc.)
4. **Sprite activity** (sprite pointers and data fetches)

This creates a "semi-random" upper 4 bits in color memory reads that reflects the VIC-II's current memory activity, making color memory reads cycle-dependent and somewhat unpredictable.

### 12.2 VIC-II Registers ($D000-$D02E)

VIC-II registers have various unused bits and special behaviors:

| Register | Address | Write Mask | Read Behavior | Notes |
|----------|---------|------------|---------------|-------|
| $D016 | Control Register 2 | $FF | Some bits reflect written value | X-scroll and display mode bits |
| $D017 | Sprite Y Expansion | $FF | Reflects written value | All bits used |
| $D01E | Sprite-Sprite Collision | N/A | Read-only, write ignored | Collision detection |
| $D01F | Sprite-Background Collision | N/A | Read-only, write ignored | Collision detection |
| $D020 | Border Color | $0F | Only lower 4 bits | Upper 4 bits read as floating |
| $D021-$D024 | Background Colors | $0F | Only lower 4 bits | Upper 4 bits read as floating |

### 12.2 VIC-II Registers ($D000-$D02E) - Detailed Analysis

Each VIC-II register where written and read-back values differ:

#### $D011 - Control Register 1 (Video Mode/Y Scroll/Raster)
- **Written**: Full 8-bit value stored
- **Read Back**: Bit 7 reflects current raster line bit 8 (real-time)
- **Difference**: Bit 7 shows actual raster position, not written value
- **Implementation**: `(vicii.regs[addr] & 0x7f) | ((raster_y & 0x100) >> 1)`

#### $D012 - Raster Line Compare
- **Written**: 8-bit raster compare value  
- **Read Back**: Current raster line lower 8 bits (real-time)
- **Difference**: Returns current raster position, not compare value
- **Implementation**: `raster_y & 0xff`

#### $D013 - Light Pen X Position
- **Written**: Write ignored
- **Read Back**: Current light pen X coordinate
- **Difference**: Read-only register, writes have no effect

#### $D014 - Light Pen Y Position  
- **Written**: Write ignored
- **Read Back**: Current light pen Y coordinate
- **Difference**: Read-only register, writes have no effect

#### $D016 - Control Register 2 (X Scroll/Display Mode)
- **Written**: Full 8-bit value stored
- **Read Back**: Written value OR'd with $C0
- **Difference**: Upper 2 bits always read as 1
- **Implementation**: `vicii.regs[addr] | 0xc0`

#### $D018 - Memory Pointers (Video Matrix/Character Base)
- **Written**: Full 8-bit value stored
- **Read Back**: Written value OR'd with $01  
- **Difference**: Bit 0 always reads as 1 (unused)
- **Implementation**: `vicii.regs[addr] | 0x1`

#### $D019 - Interrupt Request Register (IRQ)
- **Written**: Writing 1-bits clears corresponding interrupt flags
- **Read Back**: Current interrupt status OR'd with $70
- **Difference**: Upper bits $70 always set, reflects real interrupt state
- **Implementation**: `irq_status | 0x70` (plus bit 7 logic)

#### $D01A - Interrupt Mask Register
- **Written**: Lower 4 bits set interrupt enable mask
- **Read Back**: Written value OR'd with $F0
- **Difference**: Upper 4 bits always read as 1
- **Implementation**: `vicii.regs[addr] | 0xf0`

#### $D01E - Sprite-Sprite Collision Register
- **Written**: Write ignored
- **Read Back**: Current collision flags, then clears register
- **Difference**: Read-only, reading clears the register
- **Implementation**: Returns collision flags, sets register to 0

#### $D01F - Sprite-Background Collision Register  
- **Written**: Write ignored
- **Read Back**: Current collision flags, then clears register
- **Difference**: Read-only, reading clears the register
- **Implementation**: Returns collision flags, sets register to 0

#### $D020 - Border Color
- **Written**: Full 8-bit value, only lower 4 bits stored
- **Read Back**: Lower 4 bits contain color, upper 4 bits read as 1
- **Difference**: Upper 4 bits always $F0 (except on DTV)
- **Implementation**: `vicii.regs[addr] | 0xf0`

#### $D021-$D024 - Background Colors 0-3
- **Written**: Full 8-bit value, only lower 4 bits stored  
- **Read Back**: Lower 4 bits contain color, upper 4 bits read as 1
- **Difference**: Upper 4 bits always $F0 (except on DTV)
- **Implementation**: `vicii.regs[addr] | 0xf0`

#### $D025-$D026 - Sprite Multicolor Registers
- **Written**: Full 8-bit value, only lower 4 bits stored
- **Read Back**: Lower 4 bits contain color, upper 4 bits read as 1  
- **Difference**: Upper 4 bits always $F0
- **Implementation**: `vicii.regs[addr] | 0xf0`

#### $D027-$D02E - Sprite Colors 0-7
- **Written**: Full 8-bit value, only lower 4 bits stored
- **Read Back**: Lower 4 bits contain color, upper 4 bits read as 1
- **Difference**: Upper 4 bits always $F0
- **Implementation**: `vicii.regs[addr] | 0xf0`

#### $D02F-$D03F - Unused Registers
- **Written**: Values stored in extended modes, ignored in normal mode
- **Read Back**: $FF in normal VIC-II, register value in VIC-IIe mode
- **Difference**: Behavior depends on VIC-II model
- **Implementation**: `0xff` or stored value based on mode

### 12.3 SID Registers ($D400-$D7FF)

The SID chip has many write-only registers that cannot be read back:

| Register Range | Type | Read Behavior | Notes |
|----------------|------|---------------|-------|
| $D400-$D406 | Voice 1 Control | Write-only | Reads return floating bus data |
| $D407-$D40D | Voice 2 Control | Write-only | Reads return floating bus data |
| $D40E-$D414 | Voice 3 Control | Write-only | Reads return floating bus data |
| $D415-$D418 | Filter/Volume | Write-only | Reads return floating bus data |
| $D419-$D41A | Potentiometer X/Y | Read-only | Write ignored, reads return paddle values |
| $D41B | Oscillator 3 | Read-only | Write ignored, reads return voice 3 waveform |
| $D41C | Envelope 3 | Read-only | Write ignored, reads return voice 3 envelope |

### 12.4 CIA Registers ($DC00-$DCFF, $DD00-$DDFF)

CIA chips have complex I/O port behavior where the read value depends on:
- Data Direction Register (DDR) settings
- External hardware connections
- Timer states

**CIA Port Reading Formula**:
```c
// For CIA ports A and B
read_value = (written_data & DDR) | (external_input & ~DDR)
```

**Timer Register Behavior**:
- **Control Registers**: Some bits are read-only (e.g., timer running status)
- **Timer Values**: Read current timer value, not written value
- **Interrupt Register**: Reading clears pending interrupts

### 12.5 Programming Considerations

When working with these I/O areas:

1. **Color Memory**: Always mask upper bits when checking color values
2. **VIC-II**: Use appropriate bit masks for register comparisons
3. **SID**: Don't attempt to read write-only registers for verification
4. **CIA**: Account for DDR settings when reading ports
5. **General**: Use separate variables to track intended values rather than reading back

#### Example: Safe Color Memory Access
```assembly
; Safe color memory writing and reading
lda #$01        ; White color
sta $d800       ; Write to color memory

; Don't do this - unreliable
lda $d800       ; May read $31 instead of $01
cmp #$01        ; Unreliable comparison

; Do this instead - mask the read
lda $d800
and #$0f        ; Mask upper bits
cmp #$01        ; Reliable comparison
```

#### Example: CIA Port Configuration
```assembly
; Configure CIA1 Port A for mixed input/output
lda #%11110000  ; Upper 4 bits output, lower 4 input
sta $dc02       ; Data Direction Register A

lda #$f0        ; Set output bits high
sta $dc00       ; Port A data

; Read back accounts for DDR
lda $dc00       ; Returns: (output_data & DDR) | (input_data & ~DDR)
```
