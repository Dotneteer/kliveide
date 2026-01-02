# DivMMC Test Cases

## Overview

This document contains comprehensive documentation and detailed test cases for DivMMC (ESXDOS SD card interface) implementation.

**Contents:**
- Complete DivMMC implementation documentation
- TypeScript reference implementation
- 95 detailed test cases across 12 categories

---

## DivMMC Implementation Reference

### Overview

**DivMMC** is a hardware interface for SD card access that automatically pages its ROM and RAM into the CPU address space when the Spectrum ROM calls certain entry points. This allows transparent interception of ROM calls to provide DOS functionality.

**DivMMC provides:**
- **8KB ROM** at bank 8 (esxdos ROM)
- **128KB RAM** (16 banks of 8KB each, banks 0-15)
- **Automatic paging** ("automap") triggered by specific ROM addresses
- **Manual control** via port 0xE3

### Memory Layout When DivMMC is Active

When DivMMC automaps or is manually enabled via `conmem` bit:

| CPU Address | DivMMC Mapping | Bank | Access |
|-------------|----------------|------|---------|
| `0x0000-0x1FFF` | DivMMC ROM or RAM | Bank 8 (ROM) or Bank 3 (RAM) | Read-only (ROM), R/W (RAM if `mapram=1`) |
| `0x2000-0x3FFF` | DivMMC RAM | Port 0xE3 bits 3:0 | Read/Write |
| `0x4000-0xFFFF` | Normal memory | - | Unaffected |

### Port 0xE3 Control Register

**Format:**
```
Bit 7 (conmem): Enable DivMMC paging manually
Bit 6 (mapram): 0=ROM in page 0, 1=RAM bank 3 in page 0
Bits 5-4: Unused
Bits 3-0: RAM bank number for page 1 (0x2000-0x3FFF)
```

**Control Flow:**
- Write: Set manual paging state
- Read: Returns current register value
- Automatically cleared when `RETN` instruction executed (returns from esxdos)

### Automatic Mapping (Automap) Entry Points

DivMMC monitors the Z80 bus and automatically maps itself in when the CPU fetches from certain ROM addresses. There are two types of entry points:

**1. Standard Entry Points (addresses 0x0000-0x003F):**

These are configured via NextReg registers:
- **NextReg 0xB8** - Entry point enable (bits 7:0 for addresses 0x0000, 0x0008, 0x0010, 0x0018, 0x0020, 0x0028, 0x0030, 0x0038)
- **NextReg 0xB9** - Entry point "valid" flag (requires ROM 3 present)
- **NextReg 0xBA** - Entry point timing (instant vs delayed)

**VHDL Entry Point Decode (lines 2850-2888):**
```vhdl
-- Check for RST addresses in page 0
if port_00xx_msb = '1' and cpu_a(7 downto 6) = "00" and cpu_a(2 downto 0) = "000" then
   case cpu_a(5 downto 3) is
      when "000" => -- 0x0000 (RST 0)
      when "001" => -- 0x0008 (RST 8)
      when "010" => -- 0x0010 (RST 16)
      when "011" => -- 0x0018 (RST 24)
      when "100" => -- 0x0020 (RST 32)
      when "101" => -- 0x0028 (RST 40)
      when "110" => -- 0x0030 (RST 48)
      when "111" => -- 0x0038 (RST 56, standard interrupt)
   end case;
end if;
```

**2. Additional Entry Points:**

Configured via **NextReg 0xBB** bits:
- **Bit 0**: NMI at 0x0066 (delayed)
- **Bit 1**: NMI at 0x0066 (instant)
- **Bit 2**: 0x04C6 (delayed)
- **Bit 3**: 0x0562 (delayed)
- **Bit 4**: 0x04D7 (delayed)
- **Bit 5**: 0x056A (delayed)
- **Bit 6**: Enable auto-unmap at 0x1FF8-0x1FFF
- **Bit 7**: 0x3Dxx (instant, ROM 3 only)

### Automap Timing: Instant vs Delayed

**Instant Mapping:**
- Activates **immediately** when entry point detected
- Maps in on the **same M1 cycle** as the fetch
- Used for critical entry points that must intercept immediately

**Delayed Mapping:**
- Activates **after the current instruction completes**
- Maps in on the **next M1 cycle** (next opcode fetch)
- Allows the ROM instruction to execute before interception

**From divmmc.vhd (lines 133-140):**
```vhdl
process (i_CLK)
begin
   if rising_edge(i_CLK) then
      if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
         automap_hold <= '0';
      elsif i_cpu_mreq_n = '0' and i_cpu_m1_n = '0' then
         -- Activate on M1 cycle if entry point detected
         automap_hold <= (i_automap_active and 
            (i_automap_instant_on or i_automap_delayed_on or ...))
```

### Automap State Machine

The DivMMC automap has three states:

**1. Inactive (automap = 0)**
- Normal operation, DivMMC not mapped
- Monitoring for entry points

**2. Hold (automap_hold = 1)**
- Entry point detected during M1 cycle
- Set on **falling edge** of 28MHz clock during M1

**3. Held (automap_held = 1)**
- Automap active for subsequent instructions
- Set when MREQ inactive (between instructions)
- Persists until `RETN` or auto-unmap address

**State Transitions:**
```
Inactive → Hold: Entry point detected during M1 (mreq=0, m1=0)
Hold → Held: After M1 completes (mreq=1)
Held → Inactive: RETN executed OR auto-unmap address (0x1FF8-0x1FFF)
```

### Auto-Unmap Feature

**NextReg 0xBB bit 6** enables automatic unmapping when CPU executes from addresses 0x1FF8-0x1FFF.

**From zxnext.vhd (line 2896):**
```vhdl
divmmc_automap_delayed_off <= '1' when 
   port_1fxx_msb = '1' and 
   cpu_a(7 downto 3) = "11111" and 
   nr_bb_divmmc_ep_1(6) = '1' else '0';
```

This allows esxdos ROM to unmap itself by jumping to these addresses before returning to Spectrum ROM.

### ROM 3 Entry Points

Some entry points only trigger if **ROM 3** is present (128K +2A/+3 ROM):
- Controlled by `divmmc_rst_ep_valid` flag
- If ROM 3 not present, these entry points are disabled
- Prevents unwanted trapping on 48K ROMs

**"ROM 3 only" mode:**
```vhdl
divmmc_automap_rom3_instant_on <= 
   (divmmc_rst_ep and (not divmmc_rst_ep_valid) and divmmc_rst_ep_timing)
```

### RETN Instruction Detection

DivMMC automatically unmaps when the Z80 executes `RETN` (return from NMI):
- Detected by the Z80 state machine
- Clears `automap_held` and `automap_hold`
- Clears `conmem` bit in port 0xE3
- Returns to normal memory mapping

**From divmmc.vhd (lines 133-136):**
```vhdl
if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
   automap_hold <= '0';
   automap_held <= '0';
end if;
```

### NMI Button Integration

DivMMC includes NMI button support:
- Pressing button sets `button_nmi` flag
- Entry point at 0x0066 (NMI vector) can be configured to trigger automap
- Allows manual invocation of esxdos

**From divmmc.vhd (lines 115-125):**
```vhdl
process (i_CLK)
begin
   if rising_edge(i_CLK) then
      if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
         button_nmi <= '0';
      elsif i_divmmc_button = '1' then
         button_nmi <= '1';
      elsif automap_held = '1' then
         button_nmi <= '0';
      end if;
   end if;
end process;
```

### Complete Automap Activation Conditions

**DivMMC maps in when ANY of these occur:**

1. **Instant entry point hit** AND ROM 3 present (if required)
2. **Delayed entry point hit** (activates next instruction) AND ROM 3 present (if required)
3. **NMI entry point** (0x0066) AND NMI button pressed
4. **Manual enable** via port 0xE3 bit 7 (`conmem=1`)
5. **Already mapped** AND not at auto-unmap address (0x1FF8-0x1FFF)

### Priority and Overrides

In the memory decode priority chain, DivMMC is **highest priority**:

```
1. DivMMC (highest)
2. Layer 2 mapping
3. Expansion bus ROM (ROMCS)
4. Alternative ROM
5. Standard MMU (lowest)
```

When DivMMC is active, it completely overrides the MMU for addresses 0x0000-0x3FFF.

### TypeScript Implementation Example

```typescript
class DivMMC {
  // Port 0xE3 register
  private conmem: boolean = false;    // Bit 7: manual enable
  private mapram: boolean = false;    // Bit 6: map RAM instead of ROM in page 0
  private ramBank: number = 0;        // Bits 3:0: RAM bank for page 1
  
  // Automap state
  private automapHold: boolean = false;   // Detected entry point this M1
  private automapHeld: boolean = false;   // Automap active
  private buttonNmi: boolean = false;     // NMI button pressed
  
  // Configuration (NextReg 0xB8-0xBB)
  private entryPointsEnable: number = 0;      // NextReg 0xB8
  private entryPointsValid: number = 0;       // NextReg 0xB9 (ROM 3 required)
  private entryPointsTiming: number = 0;      // NextReg 0xBA (instant vs delayed)
  private additionalEntryPoints: number = 0;  // NextReg 0xBB
  
  private enabled: boolean = true;  // Port decode enable
  
  /**
   * Check if CPU is fetching from an automap entry point
   */
  checkEntryPoint(cpuAddr: number, m1Active: boolean, rom3Present: boolean): 
    { instant: boolean; delayed: boolean; rom3Only: boolean } {
    
    // Standard RST entry points (0x0000, 0x0008, 0x0010, 0x0018, 0x0020, 0x0028, 0x0030, 0x0038)
    if ((cpuAddr & 0xFFC7) === 0x0000 && m1Active) {
      const slot = (cpuAddr >> 3) & 0x07;
      const enabled = (this.entryPointsEnable >> slot) & 1;
      const valid = (this.entryPointsValid >> slot) & 1;
      const instant = (this.entryPointsTiming >> slot) & 1;
      
      if (enabled) {
        // Check ROM 3 requirement
        const rom3Only = valid === 0;
        if (rom3Only && !rom3Present) {
          return { instant: false, delayed: false, rom3Only: true };
        }
        
        return {
          instant: instant === 1,
          delayed: instant === 0,
          rom3Only: rom3Only
        };
      }
    }
    
    // NMI vector (0x0066)
    if (cpuAddr === 0x0066 && m1Active && this.buttonNmi) {
      const instantNmi = (this.additionalEntryPoints >> 1) & 1;
      const delayedNmi = (this.additionalEntryPoints >> 0) & 1;
      return {
        instant: instantNmi === 1,
        delayed: delayedNmi === 1,
        rom3Only: false
      };
    }
    
    // Additional entry points (0x04C6, 0x0562, 0x04D7, 0x056A) - all delayed
    if (cpuAddr === 0x04C6 && ((this.additionalEntryPoints >> 2) & 1)) {
      return { instant: false, delayed: true, rom3Only: false };
    }
    if (cpuAddr === 0x0562 && ((this.additionalEntryPoints >> 3) & 1)) {
      return { instant: false, delayed: true, rom3Only: false };
    }
    if (cpuAddr === 0x04D7 && ((this.additionalEntryPoints >> 4) & 1)) {
      return { instant: false, delayed: true, rom3Only: false };
    }
    if (cpuAddr === 0x056A && ((this.additionalEntryPoints >> 5) & 1)) {
      return { instant: false, delayed: true, rom3Only: false };
    }
    
    // 0x3Dxx instant entry (ROM 3 only)
    if ((cpuAddr & 0xFF00) === 0x3D00 && ((this.additionalEntryPoints >> 7) & 1)) {
      if (!rom3Present) {
        return { instant: false, delayed: false, rom3Only: true };
      }
      return { instant: true, delayed: false, rom3Only: true };
    }
    
    return { instant: false, delayed: false, rom3Only: false };
  }
  
  /**
   * Update automap state on M1 cycle (opcode fetch)
   * Call this on falling edge of clock during M1
   */
  updateOnM1(cpuAddr: number, rom3Present: boolean): void {
    if (!this.enabled) return;
    
    const ep = this.checkEntryPoint(cpuAddr, true, rom3Present);
    
    // Check for auto-unmap address (0x1FF8-0x1FFF)
    const autoUnmap = (cpuAddr >= 0x1FF8 && cpuAddr <= 0x1FFF) &&
                      ((this.additionalEntryPoints >> 6) & 1);
    
    if (ep.instant || ep.delayed) {
      // Activate automap
      this.automapHold = true;
    } else if (this.automapHeld && autoUnmap) {
      // Deactivate automap
      this.automapHold = false;
    } else if (this.automapHeld) {
      // Keep automap active
      this.automapHold = true;
    }
  }
  
  /**
   * Update automap state when MREQ goes inactive (between instructions)
   * Call this when transitioning from instruction to instruction
   */
  updateAfterInstruction(): void {
    this.automapHeld = this.automapHold;
  }
  
  /**
   * Check if DivMMC is currently paging memory
   */
  isActive(): boolean {
    if (!this.enabled) return false;
    return this.conmem || this.automapHeld;
  }
  
  /**
   * Handle RETN instruction - clears automap and conmem
   */
  handleRetn(): void {
    this.automapHold = false;
    this.automapHeld = false;
    this.conmem = false;
    this.buttonNmi = false;
  }
  
  /**
   * Write to port 0xE3
   */
  writeControl(value: number): void {
    this.conmem = (value & 0x80) !== 0;
    this.mapram = (value & 0x40) !== 0;
    this.ramBank = value & 0x0F;
  }
  
  /**
   * Read from port 0xE3
   */
  readControl(): number {
    return (this.conmem ? 0x80 : 0) |
           (this.mapram ? 0x40 : 0) |
           this.ramBank;
  }
  
  /**
   * Determine what DivMMC maps at given CPU address
   */
  getMapping(cpuAddr: number): {
    active: boolean;
    isRom: boolean;
    bank: number;
    readOnly: boolean;
  } {
    if (!this.isActive()) {
      return { active: false, isRom: false, bank: 0, readOnly: false };
    }
    
    const page = (cpuAddr >> 13) & 0x07;
    
    if (page === 0) {
      // 0x0000-0x1FFF: DivMMC ROM (bank 8) or RAM (bank 3)
      if (this.mapram) {
        return { active: true, isRom: false, bank: 3, readOnly: true };
      } else {
        return { active: true, isRom: true, bank: 8, readOnly: true };
      }
    } else if (page === 1) {
      // 0x2000-0x3FFF: DivMMC RAM (selectable bank)
      return { active: true, isRom: false, bank: this.ramBank, readOnly: false };
    }
    
    return { active: false, isRom: false, bank: 0, readOnly: false };
  }
  
  /**
   * Press NMI button
   */
  pressNmiButton(): void {
    this.buttonNmi = true;
  }
}
```

### Key Points for Emulation

1. **Monitor M1 cycles** - Entry points detected during opcode fetch (MREQ=0, M1=0)
2. **Two-stage activation** - `automap_hold` set during M1, `automap_held` set after instruction
3. **Instant vs delayed** - Instant activates same M1, delayed activates next M1
4. **RETN detection** - Automatically unmaps DivMMC and clears `conmem`
5. **ROM 3 dependency** - Some entry points only work if 128K +2A/+3 ROM present
6. **Auto-unmap** - Addresses 0x1FF8-0x1FFF can automatically disable automap
7. **Highest priority** - DivMMC overrides all other memory mapping (MMU, Layer 2, etc.)
8. **State persistence** - Once automapped, stays mapped until RETN or auto-unmap

The key insight is that DivMMC paging happens **transparently** - the Spectrum ROM makes a standard call (like `RST 8`), and DivMMC intercepts it by substituting its own ROM before the CPU reads the instruction bytes at that address.

---

## Category 1: Entry Point Detection (Instant Mode)

### Test 1.1: `RST 0 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 0 = 1 (entry point 0x0000 enabled)
- NextReg 0xB9 bit 0 = 1 (ROM 3 not required)
- NextReg 0xBA bit 0 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x4000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU jumps to address 0x0000 (e.g., via `JP 0` or reset)
- M1 cycle begins, CPU fetches opcode from 0x0000
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0000 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0000 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear, automap is separate)

---

### Test 1.2: `RST 8 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xB9 bit 1 = 1 (ROM 3 not required)
- NextReg 0xBA bit 1 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x3000 in normal Spectrum ROM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 8` instruction (opcode 0xCF)
- M1 cycle begins, CPU fetches opcode from 0x0008
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0008 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0008 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear, automap is separate)

---

### Test 1.3: `RST 16 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 2 = 1 (entry point 0x0010 enabled)
- NextReg 0xB9 bit 2 = 1 (ROM 3 not required)
- NextReg 0xBA bit 2 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x5000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 16` instruction (opcode 0xD7)
- M1 cycle begins, CPU fetches opcode from 0x0010
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0010 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0010 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 1.4: `RST 24 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 3 = 1 (entry point 0x0018 enabled)
- NextReg 0xB9 bit 3 = 1 (ROM 3 not required)
- NextReg 0xBA bit 3 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 24` instruction (opcode 0xDF)
- M1 cycle begins, CPU fetches opcode from 0x0018
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0018 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0018 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 1.5: `RST 32 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 4 = 1 (entry point 0x0020 enabled)
- NextReg 0xB9 bit 4 = 1 (ROM 3 not required)
- NextReg 0xBA bit 4 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0xC000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 32` instruction (opcode 0xE7)
- M1 cycle begins, CPU fetches opcode from 0x0020
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0020 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0020 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 1.6: `RST 40 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 5 = 1 (entry point 0x0028 enabled)
- NextReg 0xB9 bit 5 = 1 (ROM 3 not required)
- NextReg 0xBA bit 5 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x6000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 40` instruction (opcode 0xEF)
- M1 cycle begins, CPU fetches opcode from 0x0028
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0028 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0028 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 1.7: `RST 48 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 6 = 1 (entry point 0x0030 enabled)
- NextReg 0xB9 bit 6 = 1 (ROM 3 not required)
- NextReg 0xBA bit 6 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x7000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 48` instruction (opcode 0xF7)
- M1 cycle begins, CPU fetches opcode from 0x0030
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0030 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0030 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 1.8: `RST 56 instant entry point activates during M1 cycle`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 7 = 1 (entry point 0x0038 enabled)
- NextReg 0xB9 bit 7 = 1 (ROM 3 not required)
- NextReg 0xBA bit 7 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x9000 in normal RAM
- Interrupts are enabled (IM 1 mode)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- Maskable interrupt occurs
- CPU executes `RST 56` instruction (opcode 0xFF, automatic in IM 1)
- M1 cycle begins, CPU fetches opcode from 0x0038
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0038 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0038 instead of Spectrum ROM
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)
- Interrupt handler executes from DivMMC ROM

---

### Test 1.9: `All instant RST entry points work in sequence`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0xFF (all 8 entry points enabled)
- NextReg 0xB9 = 0xFF (ROM 3 not required for any)
- NextReg 0xBA = 0xFF (all instant timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes sequence: `RST 0`, then `RETN`, then `RST 8`, then `RETN`, then `RST 16`, then `RETN`, then `RST 24`, then `RETN`, then `RST 32`, then `RETN`, then `RST 40`, then `RETN`, then `RST 48`, then `RETN`, then `RST 56`, then `RETN`
- Each RST instruction triggers M1 cycle at corresponding entry point
- Each RETN instruction unmaps DivMMC before next RST

**Then:**
- For each RST instruction:
  - Entry point detected as instant during M1 cycle
  - `automap_hold` = 1 immediately
  - DivMMC ROM bank 8 mapped to 0x0000-0x1FFF
  - CPU reads from DivMMC ROM at entry point address
  - After instruction: `automap_held` = 1
- For each RETN instruction:
  - `automap_hold` = 0
  - `automap_held` = 0
  - DivMMC unmapped
  - Normal memory mapping restored
- All 8 entry points trigger correctly in sequence
- No entry points are missed or incorrectly activated

---

## Category 2: Entry Point Detection (Delayed Mode)

### Test 2.1: `RST 0 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 0 = 1 (entry point 0x0000 enabled)
- NextReg 0xB9 bit 0 = 1 (ROM 3 not required)
- NextReg 0xBA bit 0 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x4000 in normal RAM
- Spectrum ROM at 0x0000 contains: `0xC3 0x50 0x00` (JP 0x0050)
- DivMMC ROM at 0x0000 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU jumps to address 0x0000 (e.g., via `JP 0` or reset)
- M1 cycle begins, CPU fetches opcode from 0x0000
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0xC3 from Spectrum ROM (not DivMMC ROM yet)
- CPU completes the JP instruction, reading operands 0x50 0x00 from Spectrum ROM
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes JP 0x0050 from Spectrum ROM (jumps to 0x0050)
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x0050: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x0050
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.2: `RST 8 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xB9 bit 1 = 1 (ROM 3 not required)
- NextReg 0xBA bit 1 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x3000 in normal Spectrum ROM
- Spectrum ROM at 0x0008 contains: `0xC9` (RET)
- DivMMC ROM at 0x0008 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00
- Stack pointer points to valid return address 0x3010

**When:**
- CPU executes `RST 8` instruction (opcode 0xCF)
- M1 cycle begins, CPU fetches opcode from 0x0008
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0xC9 (RET) from Spectrum ROM (not DivMMC ROM yet)
- CPU completes the RET instruction, popping return address from stack
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes RET from Spectrum ROM (returns to 0x3010)
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x3010: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x1010 (0x3010 & 0x1FFF in DivMMC ROM)
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.3: `RST 16 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 2 = 1 (entry point 0x0010 enabled)
- NextReg 0xB9 bit 2 = 1 (ROM 3 not required)
- NextReg 0xBA bit 2 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x5000 in normal RAM
- Spectrum ROM at 0x0010 contains: `0x00` (NOP)
- DivMMC ROM at 0x0010 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 16` instruction (opcode 0xD7)
- M1 cycle begins, CPU fetches opcode from 0x0010
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x00 (NOP) from Spectrum ROM
- CPU completes the NOP instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes NOP from Spectrum ROM
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x0011: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x0011
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.4: `RST 24 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 3 = 1 (entry point 0x0018 enabled)
- NextReg 0xB9 bit 3 = 1 (ROM 3 not required)
- NextReg 0xBA bit 3 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x0018 contains: `0x3E 0x05` (LD A,5)
- DivMMC ROM at 0x0018 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00
- Register A = 0x00

**When:**
- CPU executes `RST 24` instruction (opcode 0xDF)
- M1 cycle begins, CPU fetches opcode from 0x0018
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x3E (LD A,n) from Spectrum ROM
- CPU completes the LD A,5 instruction, reading operand 0x05 from Spectrum ROM
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes LD A,5 from Spectrum ROM
- Register A = 0x05
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x001A: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x001A
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.5: `RST 32 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 4 = 1 (entry point 0x0020 enabled)
- NextReg 0xB9 bit 4 = 1 (ROM 3 not required)
- NextReg 0xBA bit 4 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x1000 in normal Spectrum ROM
- Spectrum ROM at 0x0020 contains: `0xCD 0x00 0x10` (CALL 0x1000)
- DivMMC ROM at 0x0020 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x0020` instruction
- M1 cycle begins for instruction at 0x0020, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0xCD (CALL nn) from Spectrum ROM
- CPU completes the CALL 0x1000 instruction from Spectrum ROM
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes CALL 0x1000 from Spectrum ROM (pushes return address, jumps to 0x1000)
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x1000: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x1000
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.6: `RST 40 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 5 = 1 (entry point 0x0028 enabled)
- NextReg 0xB9 bit 5 = 1 (ROM 3 not required)
- NextReg 0xBA bit 5 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x6000 in normal RAM
- Spectrum ROM at 0x0028 contains: `0x06 0x0A` (LD B,10)
- DivMMC ROM at 0x0028 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00
- Register B = 0x00

**When:**
- CPU executes `RST 40` instruction (opcode 0xEF)
- M1 cycle begins, CPU fetches opcode from 0x0028
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x06 (LD B,n) from Spectrum ROM
- CPU completes the LD B,10 instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes LD B,10 from Spectrum ROM
- Register B = 0x0A
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x002A: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x002A
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.7: `RST 48 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 6 = 1 (entry point 0x0030 enabled)
- NextReg 0xB9 bit 6 = 1 (ROM 3 not required)
- NextReg 0xBA bit 6 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x7000 in normal RAM
- Spectrum ROM at 0x0030 contains: `0x21 0x00 0x40` (LD HL,0x4000)
- DivMMC ROM at 0x0030 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00
- Register HL = 0x0000

**When:**
- CPU executes `RST 48` instruction (opcode 0xF7)
- M1 cycle begins, CPU fetches opcode from 0x0030
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x21 (LD HL,nn) from Spectrum ROM
- CPU completes the LD HL,0x4000 instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes LD HL,0x4000 from Spectrum ROM
- Register HL = 0x4000
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x0033: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x0033
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.8: `RST 56 delayed entry point activates after instruction completes`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 7 = 1 (entry point 0x0038 enabled)
- NextReg 0xB9 bit 7 = 1 (ROM 3 not required)
- NextReg 0xBA bit 7 = 0 (delayed timing)
- ROM 3 is present
- CPU is executing from address 0x9000 in normal RAM
- Interrupts are enabled (IM 1 mode)
- Spectrum ROM at 0x0038 contains: `0xFB` (EI - re-enable interrupts)
- DivMMC ROM at 0x0038 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- Maskable interrupt occurs
- CPU executes `RST 56` instruction (opcode 0xFF, automatic in IM 1)
- M1 cycle begins, CPU fetches opcode from 0x0038
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0xFB (EI) from Spectrum ROM
- CPU completes the EI instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes EI from Spectrum ROM
- Interrupts are re-enabled
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x0039: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x0039
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 2.9: `All delayed RST entry points work in sequence`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0xFF (all 8 entry points enabled)
- NextReg 0xB9 = 0xFF (ROM 3 not required for any)
- NextReg 0xBA = 0x00 (all delayed timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Each Spectrum ROM entry point contains a `NOP` instruction
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes sequence: `RST 0`, then `RETN`, then `RST 8`, then `RETN`, then `RST 16`, then `RETN`, then `RST 24`, then `RETN`, then `RST 32`, then `RETN`, then `RST 40`, then `RETN`, then `RST 48`, then `RETN`, then `RST 56`, then `RETN`
- Each RST instruction triggers M1 cycle at corresponding entry point
- Each RETN instruction unmaps DivMMC before next RST

**Then:**
- For each RST instruction:
  - Entry point detected as delayed during M1 cycle
  - `automap_hold` = 1 during M1
  - CPU executes NOP from Spectrum ROM (not DivMMC ROM yet)
  - After NOP completes (MREQ inactive): `automap_held` = 1
  - Next instruction fetches from DivMMC ROM
- For each RETN instruction:
  - `automap_hold` = 0
  - `automap_held` = 0
  - DivMMC unmapped
  - Normal memory mapping restored
- All 8 entry points trigger correctly in sequence with delayed timing
- Each entry point allows one instruction to execute from Spectrum ROM before mapping

---

## Category 3: ROM 3 Dependencies

### Test 3.1: `Entry point with ROM 3 required triggers when ROM 3 present`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 3 = 1 (entry point 0x0018 enabled)
- NextReg 0xB9 bit 3 = 0 (ROM 3 required for entry point)
- NextReg 0xBA bit 3 = 1 (instant timing)
- **ROM 3 is present** (128K +2A/+3 ROM detected)
- CPU is executing from address 0x8000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 24` instruction (opcode 0xDF)
- M1 cycle begins, CPU fetches opcode from 0x0018
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point check: ROM 3 is required AND ROM 3 is present

**Then:**
- Entry point 0x0018 is detected as instant (ROM 3 requirement satisfied)
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0018
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 3.2: `Entry point with ROM 3 required does not trigger when ROM 3 absent`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 3 = 1 (entry point 0x0018 enabled)
- NextReg 0xB9 bit 3 = 0 (ROM 3 required for entry point)
- NextReg 0xBA bit 3 = 1 (instant timing)
- **ROM 3 is NOT present** (48K ROM detected)
- CPU is executing from address 0x8000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 24` instruction (opcode 0xDF)
- M1 cycle begins, CPU fetches opcode from 0x0018
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point check: ROM 3 is required BUT ROM 3 is NOT present

**Then:**
- Entry point 0x0018 is NOT detected (ROM 3 requirement not satisfied)
- `automap_hold` = 0 (remains inactive)
- `automap_held` = 0 (remains inactive)
- DivMMC ROM is NOT mapped
- CPU reads the instruction bytes from normal Spectrum ROM at 0x0018
- Normal memory mapping continues (no DivMMC interference)
- Port 0xE3 read returns 0x00 (conmem still clear)
- No state changes in DivMMC logic

---

### Test 3.3: `Entry point without ROM 3 requirement works regardless of ROM presence`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xB9 bit 1 = 1 (ROM 3 NOT required for entry point)
- NextReg 0xBA bit 1 = 1 (instant timing)
- Test case A: **ROM 3 is present**
- Test case B: **ROM 3 is NOT present**
- CPU is executing from address 0x3000 in normal Spectrum ROM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 8` instruction (opcode 0xCF)
- M1 cycle begins, CPU fetches opcode from 0x0008
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point check: ROM 3 is NOT required

**Then:**
- **For both test cases (ROM 3 present OR absent):**
  - Entry point 0x0008 is detected as instant (no ROM 3 requirement)
  - `automap_hold` = 1 (set immediately during M1 cycle)
  - DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
  - CPU reads the instruction bytes from DivMMC ROM at 0x0008
  - When MREQ goes inactive: `automap_held` = 1
  - Subsequent instruction fetches continue reading from DivMMC ROM
  - Port 0xE3 read returns 0x00 (conmem still clear)
- Entry point works identically regardless of ROM 3 presence

---

### Test 3.4: `0x3Dxx instant entry point triggers when ROM 3 present`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 7 = 1 (entry point 0x3Dxx enabled, instant, ROM 3 only)
- **ROM 3 is present** (128K +2A/+3 ROM detected)
- CPU is executing from address 0x4000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x3D80` instruction
- M1 cycle begins for instruction at 0x3D80, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point check: 0x3Dxx requires ROM 3 AND ROM 3 is present

**Then:**
- Entry point 0x3D80 is detected as instant (ROM 3 requirement satisfied)
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x1D80 (0x3D80 & 0x1FFF)
- When MREQ goes inactive after the instruction: `automap_held` = 1
- Subsequent instruction fetches continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 3.5: `0x3Dxx instant entry point does not trigger when ROM 3 absent`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 7 = 1 (entry point 0x3Dxx enabled, instant, ROM 3 only)
- **ROM 3 is NOT present** (48K ROM detected)
- CPU is executing from address 0x4000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x3D80` instruction
- M1 cycle begins for instruction at 0x3D80, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point check: 0x3Dxx requires ROM 3 BUT ROM 3 is NOT present

**Then:**
- Entry point 0x3D80 is NOT detected (ROM 3 requirement not satisfied)
- `automap_hold` = 0 (remains inactive)
- `automap_held` = 0 (remains inactive)
- DivMMC ROM is NOT mapped
- CPU reads the instruction bytes from normal Spectrum ROM at 0x3D80
- Normal memory mapping continues (no DivMMC interference)
- Port 0xE3 read returns 0x00 (conmem still clear)
- No state changes in DivMMC logic

---

### Test 3.6: `Multiple entry points with mixed ROM 3 requirements work correctly`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0x0A (bits 1 and 3 set: entry points 0x0008 and 0x0018 enabled)
- NextReg 0xB9 = 0x08 (bit 3 set: 0x0018 requires ROM 3, bit 1 clear: 0x0008 does NOT require ROM 3)
- NextReg 0xBA = 0x0A (instant timing for both)
- Test case A: **ROM 3 is present**
- Test case B: **ROM 3 is NOT present**
- CPU is executing from address 0x8000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- **Test Case A (ROM 3 present):**
  - CPU executes `RST 8` then `RETN` then `RST 24` then `RETN`
- **Test Case B (ROM 3 absent):**
  - CPU executes `RST 8` then `RETN` then `RST 24` then `RETN`

**Then:**
- **Test Case A (ROM 3 present):**
  - `RST 8` (0x0008): Triggers automap (no ROM 3 requirement), DivMMC maps
  - `RETN`: Unmaps DivMMC
  - `RST 24` (0x0018): Triggers automap (ROM 3 requirement satisfied), DivMMC maps
  - `RETN`: Unmaps DivMMC
  - Both entry points work correctly

- **Test Case B (ROM 3 absent):**
  - `RST 8` (0x0008): Triggers automap (no ROM 3 requirement), DivMMC maps
  - `RETN`: Unmaps DivMMC
  - `RST 24` (0x0018): Does NOT trigger automap (ROM 3 requirement NOT satisfied), executes from Spectrum ROM
  - Normal execution continues, no DivMMC mapping
  - Only entry point without ROM 3 requirement works

---

## Category 4: Additional Entry Points

### Test 4.1: `NMI vector 0x0066 delayed mode triggers automap`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 0 = 1 (NMI entry point 0x0066 enabled, delayed)
- NextReg 0xBB bit 1 = 0 (instant NMI disabled)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x0066 contains: `0xC9` (RETN)
- DivMMC ROM at 0x0066 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- Non-maskable interrupt (NMI) occurs
- CPU jumps to NMI vector at 0x0066
- M1 cycle begins, CPU fetches opcode from 0x0066
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0xC9 (RETN) from Spectrum ROM (not DivMMC ROM yet)
- CPU completes the RETN instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes RETN from Spectrum ROM (returns to interrupted code)
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- However, RETN also clears automap state
- Result: automap activated briefly but cleared by RETN
- If ROM at 0x0066 contained different code (not RETN), automap would persist

---

### Test 4.2: `NMI vector 0x0066 instant mode triggers automap immediately`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 0 = 0 (delayed NMI disabled)
- NextReg 0xBB bit 1 = 1 (NMI entry point 0x0066 enabled, instant)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x0066 contains: `0xC9` (RETN)
- DivMMC ROM at 0x0066 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- Non-maskable interrupt (NMI) occurs
- CPU jumps to NMI vector at 0x0066
- M1 cycle begins, CPU fetches opcode from 0x0066
- Clock falling edge occurs during M1 (MREQ=0, M1=0)

**Then:**
- Entry point 0x0066 is detected as instant
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU reads the instruction bytes from DivMMC ROM at 0x0066 (0xC3, JP 0x1000)
- CPU executes JP 0x1000 from DivMMC ROM
- When MREQ goes inactive: `automap_held` = 1
- Subsequent instructions execute from DivMMC ROM at 0x1000
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 4.3: `Entry point 0x04C6 delayed triggers automap`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 2 = 1 (entry point 0x04C6 enabled, delayed)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x04C6 contains: `0x00` (NOP)
- DivMMC ROM at 0x04C6 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x04C6` instruction
- M1 cycle begins for instruction at 0x04C6, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x00 (NOP) from Spectrum ROM
- CPU completes the NOP instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes NOP from Spectrum ROM
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x04C7: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x04C7
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 4.4: `Entry point 0x0562 delayed triggers automap`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 3 = 1 (entry point 0x0562 enabled, delayed)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x0562 contains: `0x00` (NOP)
- DivMMC ROM at 0x0562 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x0562` instruction
- M1 cycle begins for instruction at 0x0562, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x00 (NOP) from Spectrum ROM
- CPU completes the NOP instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes NOP from Spectrum ROM
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x0563: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x0563
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 4.5: `Entry point 0x04D7 delayed triggers automap`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 4 = 1 (entry point 0x04D7 enabled, delayed)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x04D7 contains: `0x00` (NOP)
- DivMMC ROM at 0x04D7 contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x04D7` instruction
- M1 cycle begins for instruction at 0x04D7, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x00 (NOP) from Spectrum ROM
- CPU completes the NOP instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes NOP from Spectrum ROM
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x04D8: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x04D8
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 4.6: `Entry point 0x056A delayed triggers automap`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 5 = 1 (entry point 0x056A enabled, delayed)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x056A contains: `0x00` (NOP)
- DivMMC ROM at 0x056A contains: `0xC3 0x00 0x10` (JP 0x1000)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x056A` instruction
- M1 cycle begins for instruction at 0x056A, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detected, `automap_hold` = 1
- CPU reads 0x00 (NOP) from Spectrum ROM
- CPU completes the NOP instruction
- MREQ goes inactive (instruction complete)

**Then:**
- During M1 cycle: `automap_hold` = 1 but mapping not yet active
- CPU executes NOP from Spectrum ROM
- After instruction completes (MREQ inactive): `automap_held` = 1
- Next M1 cycle at 0x056B: DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF
- CPU fetches next instruction from DivMMC ROM at 0x056B
- Subsequent instructions continue reading from DivMMC ROM
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 4.7: `Multiple additional entry points active simultaneously`

**Given:**
- DivMMC is enabled
- NextReg 0xBB = 0x3F (bits 5:0 set: all additional entry points enabled except 0x3Dxx)
  - Bit 0: NMI 0x0066 delayed
  - Bit 1: NMI 0x0066 instant
  - Bit 2: 0x04C6 delayed
  - Bit 3: 0x0562 delayed
  - Bit 4: 0x04D7 delayed
  - Bit 5: 0x056A delayed
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Each entry point in Spectrum ROM contains: `0x00` (NOP)
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes sequence of CALLs to each entry point with RETN between them:
  - `CALL 0x04C6`, `RETN`, `CALL 0x0562`, `RETN`, `CALL 0x04D7`, `RETN`, `CALL 0x056A`, `RETN`, trigger NMI

**Then:**
- Each entry point triggers automap correctly:
  - 0x04C6: Delayed mode, executes NOP from Spectrum ROM, then maps DivMMC
  - 0x0562: Delayed mode, executes NOP from Spectrum ROM, then maps DivMMC
  - 0x04D7: Delayed mode, executes NOP from Spectrum ROM, then maps DivMMC
  - 0x056A: Delayed mode, executes NOP from Spectrum ROM, then maps DivMMC
  - NMI 0x0066: Both instant and delayed enabled, instant takes priority, maps immediately
- All additional entry points work correctly
- RETN clears automap state between each test
- No interference between different entry points

---

## Category 5: State Machine Transitions

### Test 5.1: `automap_hold set during M1 cycle when entry point detected`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xB9 bit 1 = 1 (ROM 3 not required)
- NextReg 0xBA bit 1 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x3000 in normal Spectrum ROM
- `automap_held` = 0, `automap_hold` = 0, `conmem` = 0
- Port 0xE3 = 0x00
- CPU is about to execute `RST 8` instruction

**When:**
- CPU begins M1 cycle for opcode fetch at 0x0008
- MREQ signal goes low (MREQ=0)
- M1 signal is low (M1=0)
- Clock falling edge occurs
- Entry point detection logic evaluates address 0x0008

**Then:**
- `automap_hold` transitions from 0 to 1 on the clock falling edge
- State transition happens during the M1 cycle (not after)
- `automap_held` remains 0 (not updated until MREQ goes inactive)
- DivMMC ROM mapping becomes active immediately (instant mode)
- CPU reads opcode from DivMMC ROM at 0x0008
- Port 0xE3 read returns 0x00 (conmem unchanged)

---

### Test 5.2: `automap_held latched when MREQ goes inactive`

**Given:**
- DivMMC is enabled
- Entry point has been detected and `automap_hold` = 1
- CPU has completed M1 cycle and is executing the instruction
- ROM 3 is present
- `automap_held` = 0 (not yet latched)
- `automap_hold` = 1 (set during previous M1 cycle)
- Port 0xE3 = 0x00

**When:**
- Instruction execution completes
- MREQ signal goes inactive (MREQ transitions from 0 to 1)
- Clock rising edge occurs with MREQ=1

**Then:**
- `automap_held` transitions from 0 to 1
- `automap_hold` value is latched into `automap_held`
- State transition happens when MREQ goes inactive (between instructions)
- DivMMC ROM mapping persists (or becomes active if delayed mode)
- Subsequent M1 cycles will maintain `automap_held` = 1
- Port 0xE3 read returns 0x00 (conmem unchanged)

---

### Test 5.3: `automap_held persists across multiple instructions`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM at address 0x0100
- DivMMC ROM contains sequence: `0x00 0x00 0x00 0x00 0x00` (5 NOP instructions)
- Port 0xE3 = 0x00

**When:**
- CPU executes 5 consecutive NOP instructions
- Each instruction has its own M1 cycle
- Each instruction completes with MREQ going inactive
- No entry points detected (addresses are not entry points)
- No RETN instruction executed
- No auto-unmap addresses accessed

**Then:**
- After 1st NOP: `automap_held` = 1, `automap_hold` = 1, DivMMC mapped
- After 2nd NOP: `automap_held` = 1, `automap_hold` = 1, DivMMC mapped
- After 3rd NOP: `automap_held` = 1, `automap_hold` = 1, DivMMC mapped
- After 4th NOP: `automap_held` = 1, `automap_hold` = 1, DivMMC mapped
- After 5th NOP: `automap_held` = 1, `automap_hold` = 1, DivMMC mapped
- DivMMC ROM remains mapped throughout entire sequence
- State persists without re-triggering entry point detection
- Port 0xE3 read returns 0x00 (conmem unchanged)

---

### Test 5.4: `Nested CALL instructions maintain automap state`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM at address 0x0500
- DivMMC ROM at 0x0500 contains: `0xCD 0x00 0x08` (CALL 0x0800)
- DivMMC ROM at 0x0800 contains: `0xCD 0x00 0x0C` (CALL 0x0C00)
- DivMMC ROM at 0x0C00 contains: `0xC9` (RET)
- Stack is valid
- Port 0xE3 = 0x00

**When:**
- CPU executes `CALL 0x0800` from 0x0500 (1st level call)
- CPU executes `CALL 0x0C00` from 0x0800 (2nd level call, nested)
- CPU executes `RET` from 0x0C00 (return to 0x0803)
- CPU executes next instruction after first CALL (return to 0x0503)

**Then:**
- During 1st CALL: `automap_held` = 1, DivMMC mapped, pushes 0x0503 to stack
- During 2nd CALL: `automap_held` = 1, DivMMC mapped, pushes 0x0803 to stack
- During 1st RET: `automap_held` = 1, DivMMC mapped, pops 0x0803 from stack
- During 2nd RET: `automap_held` = 1, DivMMC mapped, pops 0x0503 from stack
- `automap_held` remains 1 throughout entire nested call sequence
- All instructions execute from DivMMC ROM
- Stack operations work correctly with DivMMC mapped
- Port 0xE3 read returns 0x00 (conmem unchanged)

---

### Test 5.5: `automap_hold cleared when entry point not detected`

**Given:**
- DivMMC is enabled but not currently automapped
- NextReg 0xB8 = 0x00 (all entry points disabled)
- ROM 3 is present
- CPU is executing from address 0x4000 in normal RAM
- `automap_held` = 0, `automap_hold` = 0
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 8` instruction (opcode 0xCF)
- M1 cycle begins, CPU fetches opcode from 0x0008
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Entry point detection logic evaluates address 0x0008
- Entry point 0x0008 is disabled (NextReg 0xB8 bit 1 = 0)

**Then:**
- Entry point 0x0008 is NOT detected (disabled in configuration)
- `automap_hold` remains 0 (not set)
- `automap_held` remains 0 (not latched)
- DivMMC ROM is NOT mapped
- CPU reads opcode from normal Spectrum ROM at 0x0008
- Normal memory mapping continues
- Port 0xE3 read returns 0x00 (conmem unchanged)
- State machine remains in inactive state

---

### Test 5.6: `State transitions during interrupt handling`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 7 = 1 (entry point 0x0038 enabled, maskable interrupt vector)
- NextReg 0xB9 bit 7 = 1 (ROM 3 not required)
- NextReg 0xBA bit 7 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Interrupts enabled, IM 1 mode
- DivMMC ROM at 0x0038 contains interrupt handler: `0xFB 0xED 0x4D` (EI, RETI)
- `automap_held` = 0, `automap_hold` = 0
- Port 0xE3 = 0x00

**When:**
- Maskable interrupt occurs (INT signal asserts)
- CPU acknowledges interrupt, jumps to 0x0038
- M1 cycle begins at 0x0038 (interrupt acknowledge + fetch)
- Entry point detected, `automap_hold` = 1 immediately
- CPU executes EI instruction from DivMMC ROM
- CPU executes RETI instruction from DivMMC ROM
- RETI completes and returns to interrupted code

**Then:**
- During interrupt acknowledge M1: `automap_hold` = 1, DivMMC maps instantly
- CPU reads EI instruction from DivMMC ROM at 0x0038
- After EI: `automap_held` = 1, interrupts re-enabled
- CPU reads RETI instruction from DivMMC ROM at 0x0039
- RETI execution: Returns to interrupted code at 0x8000
- After RETI: `automap_held` may remain 1 (RETI doesn't clear automap like RETN does)
- DivMMC ROM remains mapped unless explicitly unmapped
- Port 0xE3 read returns 0x00 (conmem unchanged)

---

### Test 5.7: `State machine reset on system reset`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM at address 0x1000
- Port 0xE3 = 0x85 (conmem=1, mapram=0, bank=5)

**When:**
- System reset signal asserts (hardware reset or soft reset)
- Reset signal propagates to DivMMC logic
- DivMMC state machine detects reset condition

**Then:**
- `automap_hold` = 0 (cleared by reset)
- `automap_held` = 0 (cleared by reset)
- Port 0xE3 = 0x00 (register cleared by reset)
- DivMMC ROM unmapped
- Normal Spectrum ROM mapping restored
- CPU begins execution from address 0x0000 in Spectrum ROM
- All DivMMC state cleared to inactive
- button_nmi flag = 0 (cleared)

---

### Test 5.8: `State machine during instruction with multiple MREQ cycles`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF (conmem set)
- CPU is executing from DivMMC ROM at address 0x0100
- DivMMC RAM at 0x2000 contains: `0x42`
- DivMMC ROM at 0x0100 contains: `0x3A 0x00 0x20` (LD A,(0x2000))
- Port 0xE3 = 0x85 (conmem=1, mapram=0, bank=5)

**When:**
- CPU executes `LD A,(0x2000)` instruction
- M1 cycle: Fetch opcode 0x3A (MREQ=0, M1=0)
- Memory read cycle: Fetch operand byte 1 (0x00) (MREQ=0, M1=1)
- Memory read cycle: Fetch operand byte 2 (0x20) (MREQ=0, M1=1)
- Memory read cycle: Read data from address 0x2000 (MREQ=0, M1=1)
- MREQ goes inactive (MREQ=1) after instruction completes

**Then:**
- During M1 cycle: `automap_hold` remains 1 (address 0x0100 is not an entry point)
- During operand fetches: `automap_held` = 1, DivMMC ROM mapped, reads from 0x0100-0x0102
- During data read: `automap_held` = 1, DivMMC RAM mapped, reads 0x42 from bank 5 at 0x2000
- After MREQ inactive: `automap_held` = 1, latched again
- Register A = 0x42 (value read from DivMMC RAM)
- State machine handles multiple MREQ cycles correctly within one instruction
- Port 0xE3 read returns 0x85 (unchanged)

---

## Category 6: RETN Unmapping

### Test 6.1: `RETN instruction clears automap state`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- Port 0xE3 register: `conmem` = 1, `mapram` = 0, `ramBank` = 5
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- CPU is executing ESXDOS code at address 0x0500 in DivMMC ROM
- Stack contains return address 0x8000 (in normal RAM)
- DivMMC ROM at 0x0500 contains: `0xED 0x45` (RETN)

**When:**
- CPU executes `RETN` instruction (opcode 0xED 0x45)
- Z80 core detects RETN during instruction decode
- `retn_seen` signal asserts
- Instruction completes, pops return address from stack

**Then:**
- `automap_hold` = 0 (cleared immediately by retn_seen)
- `automap_held` = 0 (cleared immediately by retn_seen)
- `conmem` = 0 (port 0xE3 bit 7 cleared)
- DivMMC ROM and RAM unmapped from 0x0000-0x3FFF
- Normal Spectrum ROM/RAM mapping restored via MMU
- CPU returns to address 0x8000 in normal RAM
- Next instruction fetches from standard memory map (not DivMMC)
- Port 0xE3 read returns 0x05 (conmem=0, mapram=0, ramBank=5 preserved)
- `button_nmi` = 0 (NMI button state cleared)

---

### Test 6.2: `RETN clears conmem bit in port 0xE3`

**Given:**
- DivMMC is enabled
- `automap_held` = 0 (automap not active)
- Port 0xE3 register: `conmem` = 1 (manually enabled), `mapram` = 1, `ramBank` = 7
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF (mapram=1)
- DivMMC RAM bank 7 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM at address 0x0200
- Stack contains return address 0x5000 (in normal RAM)
- DivMMC RAM at 0x0200 contains: `0xED 0x45` (RETN)

**When:**
- CPU executes `RETN` instruction
- `retn_seen` signal asserts
- Instruction completes

**Then:**
- `automap_hold` = 0 (already was 0)
- `automap_held` = 0 (already was 0)
- `conmem` = 0 (bit 7 cleared by RETN)
- `mapram` bit remains 1 (sticky bit, not cleared by RETN)
- `ramBank` remains 7 (not cleared by RETN)
- DivMMC RAM unmapped from 0x0000-0x3FFF
- Normal memory mapping restored
- CPU returns to address 0x5000 in normal RAM
- Port 0xE3 read returns 0x47 (conmem=0, mapram=1, ramBank=7)
- Only conmem bit affected by RETN, other bits preserved

---

### Test 6.3: `RETN from nested interrupt handlers`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM at 0x0066 contains NMI handler: `0xC5 0xCD 0x00 0x10 0xC1 0xED 0x45` (PUSH BC, CALL 0x1000, POP BC, RETN)
- DivMMC ROM at 0x1000 contains subroutine: `0x06 0x05 0xC9` (LD B,5, RET)
- CPU is executing main program at 0x8000 in normal RAM
- Stack pointer is valid
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- NMI occurs, CPU jumps to 0x0066
- Entry point triggers automap (if configured)
- CPU executes PUSH BC (saves BC to stack)
- CPU executes CALL 0x1000 (nested call)
- CPU executes LD B,5 at 0x1000
- CPU executes RET (returns to 0x006B)
- CPU executes POP BC (restores BC from stack)
- CPU executes RETN (returns to main program at 0x8000)

**Then:**
- During PUSH BC: `automap_held` = 1, stack write to DivMMC RAM or normal RAM
- During CALL 0x1000: `automap_held` = 1, nested call executes from DivMMC ROM
- During LD B,5: Register B = 5, `automap_held` = 1
- During RET: `automap_held` = 1 (RET doesn't clear automap), returns to 0x006B
- During POP BC: `automap_held` = 1, BC restored from stack
- During RETN: `automap_hold` = 0, `automap_held` = 0, `conmem` = 0, DivMMC unmapped
- After RETN: CPU at 0x8000 in normal RAM, normal memory mapping active
- Port 0xE3 read returns 0x00 (conmem cleared)
- Nested calls handled correctly before final RETN clears state

---

### Test 6.4: `RETN clears button_nmi flag`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 1 = 1 (NMI entry point 0x0066 enabled, instant)
- NMI button has been pressed: `button_nmi` = 1
- NMI occurred and triggered automap
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM at 0x0066 contains: `0xED 0x45` (RETN)
- CPU is executing from DivMMC ROM at 0x0066
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes `RETN` instruction at 0x0066
- `retn_seen` signal asserts
- Instruction completes

**Then:**
- `automap_hold` = 0 (cleared by RETN)
- `automap_held` = 0 (cleared by RETN)
- `conmem` = 0 (cleared by RETN)
- `button_nmi` = 0 (NMI button flag cleared by RETN)
- DivMMC unmapped
- CPU returns to interrupted code
- Normal memory mapping restored
- Port 0xE3 read returns 0x00
- NMI button state reset, ready for next button press

---

### Test 6.5: `RETN preserves mapram and bank bits in port 0xE3`

**Given:**
- DivMMC is enabled and currently automapped
- `automap_held` = 1, `automap_hold` = 1
- Port 0xE3 register: `conmem` = 1, `mapram` = 1, `ramBank` = 12 (0x0C)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF (mapram=1)
- DivMMC RAM bank 12 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM at address 0x0300
- Stack contains return address 0x7000 (in normal RAM)
- DivMMC RAM at 0x0300 contains: `0xED 0x45` (RETN)

**When:**
- CPU executes `RETN` instruction
- `retn_seen` signal asserts
- Instruction completes
- CPU returns to address 0x7000

**Then:**
- `automap_hold` = 0 (cleared by RETN)
- `automap_held` = 0 (cleared by RETN)
- `conmem` = 0 (bit 7 cleared by RETN)
- `mapram` = 1 (bit 6 preserved, sticky bit not affected by RETN)
- `ramBank` = 12 (bits 3:0 preserved, not affected by RETN)
- DivMMC unmapped (conmem=0, automap=0)
- Normal memory mapping active
- Port 0xE3 read returns 0x4C (binary: 0100_1100 = conmem:0, mapram:1, bank:12)
- RETN only clears conmem and automap state, preserves other configuration
- mapram can only be cleared via NextReg 0x09 bit 3

---

## Category 7: Auto-Unmap Feature

### Test 7.1: `Execution from 0x1FF8 triggers auto-unmap`

**Given:**
- DivMMC is enabled and currently automapped
- NextReg 0xBB bit 6 = 1 (auto-unmap feature enabled)
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM
- DivMMC ROM at 0x1FF8 contains: `0xC3 0x00 0x80` (JP 0x8000)
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes `JP 0x1FF8` instruction
- M1 cycle begins at address 0x1FF8, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Address decode logic detects 0x1FF8 is in auto-unmap range (0x1FF8-0x1FFF)
- `automap_delayed_off` signal asserts

**Then:**
- During M1 cycle at 0x1FF8: Auto-unmap detected, `automap_hold` = 0
- CPU reads and executes JP 0x8000 instruction from DivMMC ROM at 0x1FF8
- After instruction completes (MREQ inactive): `automap_held` = 0 (latched from automap_hold)
- Next M1 cycle at 0x8000: DivMMC ROM unmapped
- CPU continues execution from normal RAM at 0x8000
- `conmem` remains 1 (auto-unmap doesn't clear port 0xE3, unlike RETN)
- Port 0xE3 read returns 0x80
- DivMMC can be re-activated by entry point or manual conmem

---

### Test 7.2: `Execution from 0x1FFF triggers auto-unmap`

**Given:**
- DivMMC is enabled and currently automapped
- NextReg 0xBB bit 6 = 1 (auto-unmap feature enabled)
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM at 0x1FF0
- DivMMC ROM at 0x1FFF contains: `0xC9` (RET)
- Stack contains return address 0x9000 (in normal RAM)
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes series of NOPs until PC reaches 0x1FFF
- M1 cycle begins at address 0x1FFF, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Address decode logic detects 0x1FFF is in auto-unmap range (0x1FF8-0x1FFF)
- `automap_delayed_off` signal asserts

**Then:**
- During M1 cycle at 0x1FFF: Auto-unmap detected, `automap_hold` = 0
- CPU reads and executes RET instruction from DivMMC ROM at 0x1FFF
- After RET completes: `automap_held` = 0, returns to 0x9000
- Next M1 cycle at 0x9000: DivMMC ROM unmapped
- CPU continues execution from normal RAM at 0x9000
- `conmem` remains 1 (auto-unmap doesn't clear port 0xE3)
- Port 0xE3 read returns 0x80
- Auto-unmap works at last byte of DivMMC ROM range

---

### Test 7.3: `Execution from 0x1FF7 does not trigger auto-unmap`

**Given:**
- DivMMC is enabled and currently automapped
- NextReg 0xBB bit 6 = 1 (auto-unmap feature enabled)
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM
- DivMMC ROM at 0x1FF7 contains: `0x00` (NOP)
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes instruction at address 0x1FF7
- M1 cycle begins at address 0x1FF7, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Address decode logic checks address 0x1FF7 (NOT in auto-unmap range)

**Then:**
- Auto-unmap NOT detected (address 0x1FF7 is below threshold)
- `automap_hold` = 1 (remains active, not cleared)
- `automap_held` = 1 (remains active)
- CPU reads and executes NOP from DivMMC ROM at 0x1FF7
- After NOP completes: `automap_held` = 1 (still active)
- DivMMC ROM remains mapped
- CPU continues execution from DivMMC ROM at 0x1FF8
- Port 0xE3 read returns 0x80
- Only addresses 0x1FF8-0x1FFF trigger auto-unmap

---

### Test 7.4: `Execution from 0x2000 does not trigger auto-unmap`

**Given:**
- DivMMC is enabled and currently automapped with conmem set
- NextReg 0xBB bit 6 = 1 (auto-unmap feature enabled)
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM
- DivMMC RAM at 0x2000 contains: `0x00` (NOP)
- Port 0xE3 = 0x85 (conmem=1, ramBank=5)

**When:**
- CPU executes instruction at address 0x2000
- M1 cycle begins at address 0x2000, CPU fetches opcode
- Clock falling edge occurs during M1 (MREQ=0, M1=0)
- Address decode logic checks address 0x2000 (NOT in auto-unmap range)

**Then:**
- Auto-unmap NOT detected (address 0x2000 is above range)
- `automap_hold` = 1 (remains active, not cleared)
- `automap_held` = 1 (remains active)
- CPU reads and executes NOP from DivMMC RAM at 0x2000
- After NOP completes: `automap_held` = 1 (still active)
- DivMMC ROM and RAM remain mapped
- CPU continues execution from DivMMC RAM at 0x2001
- Port 0xE3 read returns 0x85
- Auto-unmap only applies to ROM range (0x1FF8-0x1FFF), not RAM range

---

### Test 7.5: `Auto-unmap disabled when NextReg 0xBB bit 6 clear`

**Given:**
- DivMMC is enabled and currently automapped
- NextReg 0xBB bit 6 = 0 (auto-unmap feature DISABLED)
- `automap_held` = 1, `automap_hold` = 1
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- CPU is executing from DivMMC ROM
- DivMMC ROM at 0x1FF8 contains: `0x00 0x00 0x00 0x00 0x00 0x00 0x00 0x00` (8 NOPs covering 0x1FF8-0x1FFF)
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes instructions at addresses 0x1FF8, 0x1FF9, 0x1FFA, 0x1FFB, 0x1FFC, 0x1FFD, 0x1FFE, 0x1FFF
- M1 cycles occur at each address
- Auto-unmap feature is disabled in configuration

**Then:**
- For all addresses 0x1FF8-0x1FFF:
  - Auto-unmap NOT detected (feature disabled)
  - `automap_hold` = 1 (remains active)
  - `automap_held` = 1 (remains active)
  - CPU reads and executes NOP from DivMMC ROM
  - DivMMC ROM remains mapped
- After all 8 NOPs: `automap_held` = 1, DivMMC still mapped
- CPU continues execution from DivMMC ROM at 0x0000 (wraps around in 8KB ROM)
- Port 0xE3 read returns 0x80
- Auto-unmap addresses have no effect when feature disabled

---

### Test 7.6: `Auto-unmap during automap_hold state vs automap_held state`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 6 = 1 (auto-unmap feature enabled)
- NextReg 0xB8 bit 0 = 1 (entry point 0x0000 enabled)
- NextReg 0xBA bit 0 = 0 (delayed timing for 0x0000)
- ROM 3 is present
- `automap_held` = 0, `automap_hold` = 0
- Spectrum ROM at 0x0000 contains: `0xC3 0xF8 0x1F` (JP 0x1FF8)
- DivMMC ROM at 0x1FF8 contains: `0x00` (NOP)
- Port 0xE3 = 0x00

**When:**
- **Test Case A - Auto-unmap during automap_hold:**
  - If 0x0000 entry point was at 0x1FF8-0x1FFF range (hypothetically)
  - Entry point detected: `automap_hold` = 1
  - Simultaneously, auto-unmap detected: `automap_delayed_off` = 1
  - Conflicting signals

- **Test Case B - Auto-unmap during automap_held:**
  - CPU jumps to 0x0000 (entry point, delayed)
  - Executes JP 0x1FF8 from Spectrum ROM
  - After instruction: `automap_held` = 1, DivMMC maps
  - Next M1 at 0x1FF8: Auto-unmap detected
  - `automap_hold` = 0 (cleared by auto-unmap)

**Then:**
- **Test Case A (Conflict):**
  - Entry point and auto-unmap in same address is configuration error
  - Hardware behavior: Auto-unmap takes priority (clears automap_hold)
  - Result: DivMMC does not map (auto-unmap wins)

- **Test Case B (Normal):**
  - Entry point triggers at 0x0000, maps DivMMC after JP instruction
  - Auto-unmap triggers at 0x1FF8, clears mapping
  - `automap_held` = 0 after auto-unmap
  - DivMMC unmapped at 0x1FF8
  - CPU continues from Spectrum ROM

---

## Category 8: Manual Control (Port 0xE3)

### Test 8.1: `Write port 0xE3 sets conmem bit to enable DivMMC manually`

**Given:**
- DivMMC is enabled
- `automap_held` = 0, `automap_hold` = 0 (no automap active)
- Port 0xE3 = 0x00 (all bits clear)
- CPU is executing from address 0x8000 in normal RAM
- Normal Spectrum ROM is mapped to 0x0000-0x1FFF

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x83 (binary: 1000_0011 = conmem:1, mapram:0, bank:3)
- Port 0xE3 write operation occurs
- DivMMC logic processes the write

**Then:**
- Port 0xE3 register = 0x83
- `conmem` = 1 (bit 7 set, DivMMC manually enabled)
- `mapram` = 0 (bit 6 clear, ROM mode)
- `ramBank` = 3 (bits 3:0 = 3)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 3 is mapped to 0x2000-0x3FFF
- Next instruction fetch reads from DivMMC ROM instead of Spectrum ROM
- Manual control overrides normal memory mapping
- Port 0xE3 read returns 0x83

---

### Test 8.2: `Write port 0xE3 clears conmem bit to disable DivMMC manually`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x85 (conmem=1, mapram=0, bank=5)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC ROM at address 0x0100
- `automap_held` = 0 (only manual control active)

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x07 (binary: 0000_0111 = conmem:0, mapram:0, bank:7)
- Port 0xE3 write operation occurs
- DivMMC logic processes the write

**Then:**
- Port 0xE3 register = 0x47 (see note below about mapram sticky bit)
- `conmem` = 0 (bit 7 cleared, DivMMC manually disabled)
- `mapram` = 1 (bit 6 remains set due to OR behavior, sticky)
- `ramBank` = 7 (bits 3:0 updated to 7)
- DivMMC ROM and RAM unmapped from 0x0000-0x3FFF
- Normal Spectrum ROM/RAM mapping restored
- Next instruction fetch reads from Spectrum ROM
- Port 0xE3 read returns 0x47
- Note: mapram bit uses OR logic (sticky), cannot be cleared by port write

---

### Test 8.3: `Write port 0xE3 sets mapram bit (sticky behavior)`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 0 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC ROM at address 0x0100

**When:**
- CPU executes `OUT (0xE3),A` with A = 0xC5 (binary: 1100_0101 = conmem:1, mapram:1, bank:5)
- Port 0xE3 write operation occurs
- DivMMC logic processes the write

**Then:**
- Port 0xE3 register = 0xC5
- `conmem` = 1 (bit 7 set)
- `mapram` = 1 (bit 6 set, switches to RAM mode)
- `ramBank` = 5 (bits 3:0 updated to 5)
- DivMMC RAM bank 3 is now mapped to 0x0000-0x1FFF (instead of ROM)
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- Next instruction fetch reads from DivMMC RAM bank 3 at 0x0100
- Port 0xE3 read returns 0xC5
- mapram bit is now "stuck" at 1

---

### Test 8.4: `Write port 0xE3 cannot clear mapram bit (requires NextReg 0x09)`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0xC5 (conmem=1, mapram=1, bank=5)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF (mapram=1)
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM at address 0x0100

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x80 (binary: 1000_0000 = conmem:1, mapram:0 attempt, bank:0)
- Port 0xE3 write operation occurs
- DivMMC logic processes write with OR behavior for mapram bit

**Then:**
- Port 0xE3 register = 0xC0 (mapram bit remains 1 due to OR logic)
- `conmem` = 1 (bit 7 set)
- `mapram` = 1 (bit 6 CANNOT be cleared by port write, sticky)
- `ramBank` = 0 (bits 3:0 updated to 0)
- DivMMC RAM bank 3 still mapped to 0x0000-0x1FFF (RAM mode persists)
- DivMMC RAM bank 0 now mapped to 0x2000-0x3FFF
- Cannot switch back to ROM mode via port 0xE3
- Port 0xE3 read returns 0xC0
- Must use NextReg 0x09 bit 3 to clear mapram bit

---

### Test 8.5: `Write port 0xE3 selects RAM bank 0`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x8F (conmem=1, mapram=0, bank=15)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 15 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC ROM at address 0x0100

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x80 (binary: 1000_0000 = conmem:1, mapram:0, bank:0)
- Port 0xE3 write operation occurs
- DivMMC logic processes the write

**Then:**
- Port 0xE3 register = 0x80
- `conmem` = 1 (bit 7 set)
- `mapram` = 0 (bit 6 clear)
- `ramBank` = 0 (bits 3:0 = 0)
- DivMMC ROM bank 8 still mapped to 0x0000-0x1FFF
- DivMMC RAM bank 0 now mapped to 0x2000-0x3FFF (changed from bank 15)
- Memory reads/writes to 0x2000-0x3FFF access bank 0
- Port 0xE3 read returns 0x80

---

### Test 8.6: `Write port 0xE3 selects RAM bank 15`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 0 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC ROM at address 0x0100

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x8F (binary: 1000_1111 = conmem:1, mapram:0, bank:15)
- Port 0xE3 write operation occurs
- DivMMC logic processes the write

**Then:**
- Port 0xE3 register = 0x8F
- `conmem` = 1 (bit 7 set)
- `mapram` = 0 (bit 6 clear)
- `ramBank` = 15 (bits 3:0 = 15, maximum bank number)
- DivMMC ROM bank 8 still mapped to 0x0000-0x1FFF
- DivMMC RAM bank 15 now mapped to 0x2000-0x3FFF (changed from bank 0)
- Memory reads/writes to 0x2000-0x3FFF access bank 15
- Port 0xE3 read returns 0x8F

---

### Test 8.7: `Read port 0xE3 returns current register value`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0xC7 (conmem=1, mapram=1, bank=7)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 7 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM at address 0x0200

**When:**
- CPU executes `IN A,(0xE3)` instruction
- Port 0xE3 read operation occurs
- DivMMC logic returns the register value

**Then:**
- Register A = 0xC7 (exact value of port 0xE3 register)
- Bit 7 (conmem) = 1
- Bit 6 (mapram) = 1
- Bits 5:4 = 0 (unused, always read as 0)
- Bits 3:0 = 7 (bank selection)
- Read operation does not modify port 0xE3 register
- DivMMC mapping remains unchanged
- Port 0xE3 still = 0xC7 after read

---

### Test 8.8: `conmem=1 enables DivMMC when automap=0`

**Given:**
- DivMMC is enabled
- `automap_held` = 0, `automap_hold` = 0 (no automap)
- Port 0xE3 = 0x00 (conmem=0, DivMMC not active)
- CPU is executing from address 0x0100 in normal Spectrum ROM
- No entry points configured

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x82 (conmem=1, mapram=0, bank=2)
- Port 0xE3 write operation occurs

**Then:**
- Port 0xE3 register = 0x82
- `conmem` = 1 (manual enable)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 2 is mapped to 0x2000-0x3FFF
- Next instruction fetch at 0x0101 reads from DivMMC ROM (not Spectrum ROM)
- Manual control takes priority even without automap
- Port 0xE3 read returns 0x82

---

### Test 8.9: `Both conmem=1 and automap=1 active simultaneously`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xBA bit 1 = 1 (instant timing)
- Port 0xE3 = 0x85 (conmem=1, mapram=0, bank=5)
- `automap_held` = 0, `automap_hold` = 0
- CPU is executing from DivMMC ROM at 0x0100 (manual conmem=1)

**When:**
- CPU executes `RST 8` instruction
- M1 cycle begins at 0x0008, entry point detected
- `automap_hold` = 1, then `automap_held` = 1
- Now both `conmem` = 1 AND `automap_held` = 1

**Then:**
- Both manual and automatic control active simultaneously
- DivMMC ROM bank 8 remains mapped to 0x0000-0x1FFF
- DivMMC RAM bank 5 remains mapped to 0x2000-0x3FFF
- Behavior identical to having just one control active
- If RETN executed: clears `automap_held` AND `conmem`, unmaps DivMMC
- If `OUT (0xE3),0x05` executed (conmem=0): clears manual control but automap still active
- Port 0xE3 read returns 0x85 (conmem bit, not automap bit)
- Both control mechanisms can coexist

---

### Test 8.10: `Clear mapram via NextReg 0x09 bit 3`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0xC5 (conmem=1, mapram=1, bank=5)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF (mapram=1)
- DivMMC RAM bank 5 is mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC RAM at address 0x0100
- NextReg 0x09 = 0x00 (all bits clear initially)

**When:**
- CPU writes to NextReg 0x243B with register select = 0x09
- CPU writes to NextReg 0x253B with value = 0x08 (bit 3 set)
- NextReg 0x09 bit 3 write operation clears mapram sticky bit

**Then:**
- Port 0xE3 mapram bit cleared: `mapram` = 0
- Port 0xE3 register = 0x85 (conmem=1, mapram=0, bank=5)
- DivMMC ROM bank 8 now mapped to 0x0000-0x1FFF (switched from RAM to ROM)
- DivMMC RAM bank 5 still mapped to 0x2000-0x3FFF
- Next instruction fetch at 0x0101 reads from DivMMC ROM (not RAM)
- This is the ONLY way to clear mapram bit
- Port 0xE3 read returns 0x85
- mapram no longer sticky (can be set again via port 0xE3)

---

## Category 9: Memory Access Patterns

### Test 9.1: `Read from DivMMC ROM at 0x0000-0x1FFF (mapram=0)`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC ROM at physical address 0x010000 (bank 8, offset 0x0000) contains: 0x42
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,(0x0000)` instruction
- Memory read operation from address 0x0000
- DivMMC decodes address and activates ROM mapping

**Then:**
- DivMMC ROM bank 8 responds to read request
- Physical address decoded: 0x010000 (bank 8 × 8KB + offset 0x0000)
- Data 0x42 read from DivMMC ROM
- Register A = 0x42
- Read operation successful
- DivMMC ROM is read-only (hardware characteristic)

---

### Test 9.2: `Write to DivMMC ROM is ignored (read-only)`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC ROM at physical address 0x010000 contains: 0x42
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD (0x0000),A` with A = 0x99
- Memory write operation to address 0x0000
- DivMMC decodes address and recognizes ROM mapping

**Then:**
- DivMMC ROM is read-only, write operation ignored
- Data at physical address 0x010000 remains 0x42 (unchanged)
- No error or exception generated
- Write silently ignored (characteristic of ROM)
- Subsequent read from 0x0000 returns 0x42 (original value)
- CPU continues normal execution

---

### Test 9.3: `Read from DivMMC RAM at 0x0000-0x1FFF (mapram=1)`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0xC0 (conmem=1, mapram=1, bank=0)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF (fixed bank 3 when mapram=1)
- DivMMC RAM at bank 3, offset 0x0500 contains: 0x7F
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,(0x0500)` instruction
- Memory read operation from address 0x0500
- DivMMC decodes address and activates RAM mapping

**Then:**
- DivMMC RAM bank 3 responds to read request
- Physical address decoded: bank 3 × 8KB + offset 0x0500
- Data 0x7F read from DivMMC RAM
- Register A = 0x7F
- Read operation successful

---

### Test 9.4: `Write to DivMMC RAM at 0x0000-0x1FFF (mapram=1)`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0xC0 (conmem=1, mapram=1, bank=0)
- DivMMC RAM bank 3 is mapped to 0x0000-0x1FFF
- DivMMC RAM at bank 3, offset 0x0500 contains: 0x00
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD (0x0500),A` with A = 0xAA
- Memory write operation to address 0x0500
- DivMMC decodes address and activates RAM mapping

**Then:**
- DivMMC RAM bank 3 responds to write request
- Physical address decoded: bank 3 × 8KB + offset 0x0500
- Data 0xAA written to DivMMC RAM
- Memory at bank 3, offset 0x0500 now contains 0xAA
- Write operation successful
- Subsequent read from 0x0500 returns 0xAA (new value)

---

### Test 9.5: `Read/Write DivMMC RAM at 0x2000-0x3FFF`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x87 (conmem=1, mapram=0, bank=7)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 7 is mapped to 0x2000-0x3FFF
- DivMMC RAM at bank 7, offset 0x0100 (address 0x2100) contains: 0x00
- CPU is executing from DivMMC ROM at address 0x0100

**When:**
- CPU executes `LD A,(0x2100)` - read from DivMMC RAM
- CPU executes `INC A` - A becomes 0x01
- CPU executes `LD (0x2100),A` - write to DivMMC RAM
- CPU executes `LD B,(0x2100)` - read back to verify

**Then:**
- First read: A = 0x00 (original value from bank 7)
- After INC: A = 0x01
- Write: Data 0x01 written to bank 7, offset 0x0100
- Second read: B = 0x01 (new value verified)
- Read and write operations both successful
- DivMMC RAM at 0x2000-0x3FFF is fully read/write capable
- Bank selection via port 0xE3 bits 3:0 works correctly

---

### Test 9.6: `DivMMC overrides MMU slot 0 and 1`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- DivMMC RAM bank 0 is mapped to 0x2000-0x3FFF
- MMU slot 0 (0x0000-0x1FFF) configured to point to RAM bank 10 (NextReg 0x50 = 10)
- MMU slot 1 (0x2000-0x3FFF) configured to point to RAM bank 15 (NextReg 0x51 = 15)
- RAM bank 10 at offset 0x0000 contains: 0x11
- DivMMC ROM at offset 0x0000 contains: 0x42
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,(0x0000)` - read from slot 0
- CPU executes `LD B,(0x2000)` - read from slot 1

**Then:**
- Read from 0x0000: A = 0x42 (from DivMMC ROM bank 8, NOT RAM bank 10)
- Read from 0x2000: B = value from DivMMC RAM bank 0 (NOT RAM bank 15)
- DivMMC has higher priority than MMU in memory decode chain
- MMU slot 0 and 1 configurations are ignored when DivMMC active
- MMU slots 2-7 (0x4000-0xFFFF) continue to work normally
- When DivMMC unmapped, MMU slots 0-1 become active again

---

### Test 9.7: `DivMMC overrides Layer 2 paging`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 is mapped to 0x0000-0x1FFF
- Layer 2 enabled and mapped to 0x0000-0x1FFF (NextReg 0x69 bit 7 = 1, shadow=0)
- Layer 2 RAM at offset 0x0000 contains: 0x55
- DivMMC ROM at offset 0x0000 contains: 0x42
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,(0x0000)` - read from address 0x0000

**Then:**
- Read from 0x0000: A = 0x42 (from DivMMC ROM, NOT Layer 2 RAM)
- DivMMC has highest priority in memory decode chain
- Layer 2 mapping is overridden by DivMMC
- Layer 2 at 0x4000-0x7FFF (if mapped) continues to work
- When DivMMC unmapped, Layer 2 at 0x0000-0x1FFF becomes accessible
- Priority order: DivMMC > Layer 2 > Expansion Bus > Alt ROM > MMU

---

### Test 9.8: `Memory access when DivMMC disabled`

**Given:**
- DivMMC is enabled (hardware present)
- Port 0xE3 = 0x00 (conmem=0, DivMMC not active)
- `automap_held` = 0, `automap_hold` = 0 (no automap)
- MMU slot 0 configured to point to RAM bank 5 (NextReg 0x50 = 5)
- RAM bank 5 at offset 0x0000 contains: 0x33
- DivMMC ROM at offset 0x0000 contains: 0x42
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,(0x0000)` - read from address 0x0000

**Then:**
- Read from 0x0000: A = 0x33 (from RAM bank 5 via MMU, NOT DivMMC ROM)
- DivMMC is not active in memory decode
- Normal memory mapping via MMU works
- DivMMC hardware present but not interfering
- Memory reads/writes follow standard MMU mapping
- Layer 2, expansion bus, and alt ROM also follow normal priority

---

## Category 10: NMI Button Integration

### Test 10.1: `NMI button press sets button_nmi flag`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bits 1:0 = 0x00 (NMI entry points disabled initially)
- `button_nmi` = 0 (button not pressed)
- `automap_held` = 0, `automap_hold` = 0
- CPU is executing from address 0x8000 in normal RAM
- Port 0xE3 = 0x00

**When:**
- User presses the NMI button (hardware signal asserts)
- DivMMC logic detects button press
- `button_nmi` flag is set

**Then:**
- `button_nmi` = 1 (flag set on button press)
- Flag persists until cleared by automap activation or RETN
- No immediate effect on memory mapping (NMI entry point disabled)
- If NMI entry point enabled later, flag can trigger automap
- CPU continues normal execution
- Port 0xE3 read returns 0x00 (button_nmi is internal state)

---

### Test 10.2: `NMI button triggers automap at 0x0066 (instant mode)`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 1 = 1 (NMI entry point 0x0066 enabled, instant)
- NextReg 0xBB bit 0 = 0 (delayed NMI disabled)
- `button_nmi` = 0 (button not pressed initially)
- `automap_held` = 0, `automap_hold` = 0
- CPU is executing from address 0x8000 in normal RAM
- DivMMC ROM at 0x0066 contains: `0xC3 0x00 0x10` (JP 0x1000)
- Port 0xE3 = 0x00

**When:**
- User presses NMI button
- `button_nmi` = 1 (flag set)
- NMI signal asserts to CPU
- CPU acknowledges NMI, jumps to 0x0066
- M1 cycle begins at 0x0066

**Then:**
- Entry point 0x0066 detected as instant (due to button_nmi=1 and NextReg 0xBB bit 1)
- `automap_hold` = 1 (set immediately during M1 cycle)
- DivMMC ROM bank 8 mapped to 0x0000-0x1FFF
- CPU reads JP 0x1000 instruction from DivMMC ROM at 0x0066
- After instruction: `automap_held` = 1
- CPU jumps to 0x1000, continues executing from DivMMC ROM
- `button_nmi` = 0 (cleared when automap becomes active)
- Port 0xE3 read returns 0x00 (conmem still clear)

---

### Test 10.3: `NMI button triggers automap at 0x0066 (delayed mode)`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 0 = 1 (NMI entry point 0x0066 enabled, delayed)
- NextReg 0xBB bit 1 = 0 (instant NMI disabled)
- `button_nmi` = 0 (button not pressed initially)
- `automap_held` = 0, `automap_hold` = 0
- CPU is executing from address 0x8000 in normal RAM
- Spectrum ROM at 0x0066 contains: `0xC9` (RETN)
- DivMMC ROM at 0x0066 contains: `0xC3 0x00 0x10` (JP 0x1000)
- Port 0xE3 = 0x00

**When:**
- User presses NMI button
- `button_nmi` = 1 (flag set)
- NMI signal asserts to CPU
- CPU acknowledges NMI, jumps to 0x0066
- M1 cycle begins at 0x0066

**Then:**
- Entry point 0x0066 detected as delayed (due to button_nmi=1 and NextReg 0xBB bit 0)
- During M1: `automap_hold` = 1 but mapping not yet active
- CPU reads and executes RETN from Spectrum ROM at 0x0066
- RETN clears automap_hold and returns to main program
- Result: Automap activated but immediately cleared by RETN
- `button_nmi` = 0 (cleared when automap attempted)
- This configuration is problematic - instant mode preferred for NMI button
- Port 0xE3 read returns 0x00

---

### Test 10.4: `button_nmi cleared when automap becomes active`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 1 = 1 (NMI entry point 0x0066 enabled, instant)
- User has pressed NMI button: `button_nmi` = 1
- NMI has been triggered, automap activated
- `automap_held` = 1, `automap_hold` = 1
- CPU is executing from DivMMC ROM at address 0x1000
- Port 0xE3 = 0x00

**When:**
- Automap state becomes active (`automap_held` = 1)
- DivMMC logic detects automap_held transition from 0 to 1

**Then:**
- `button_nmi` = 0 (cleared automatically when automap held)
- Flag cleared to prevent repeated NMI triggering
- If button pressed again while in DivMMC ROM, new NMI can occur
- Clearing happens automatically, no software action required
- Prevents button press from "sticking" across multiple NMI cycles
- CPU continues executing from DivMMC ROM

---

### Test 10.5: `button_nmi cleared by RETN instruction`

**Given:**
- DivMMC is enabled
- User has pressed NMI button: `button_nmi` = 1
- `automap_held` = 1, `automap_hold` = 1
- CPU is executing ESXDOS NMI handler in DivMMC ROM at 0x1000
- DivMMC ROM at 0x1000 contains: `0xED 0x45` (RETN)
- Port 0xE3 = 0x80 (conmem=1)

**When:**
- CPU executes `RETN` instruction
- `retn_seen` signal asserts
- DivMMC logic processes RETN

**Then:**
- `automap_hold` = 0 (cleared by RETN)
- `automap_held` = 0 (cleared by RETN)
- `conmem` = 0 (cleared by RETN)
- `button_nmi` = 0 (cleared by RETN)
- DivMMC unmapped
- CPU returns to interrupted code
- All NMI-related state cleared
- System ready for next NMI button press
- Port 0xE3 read returns 0x00

---

## Category 11: Edge Cases and Interactions

### Test 11.1: `Entry point at 0x0000 (power-on/reset vector)`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 0 = 1 (entry point 0x0000 enabled)
- NextReg 0xB9 bit 0 = 1 (ROM 3 not required)
- NextReg 0xBA bit 0 = 1 (instant timing)
- ROM 3 is present
- System has just powered on or been reset
- CPU starts execution at 0x0000 (reset vector)
- Port 0xE3 = 0x00 (reset state)

**When:**
- CPU begins first M1 cycle at address 0x0000
- Entry point detection logic evaluates 0x0000
- Clock falling edge occurs during M1

**Then:**
- Entry point 0x0000 detected as instant
- `automap_hold` = 1 immediately
- DivMMC ROM bank 8 mapped to 0x0000-0x1FFF
- CPU reads first instruction from DivMMC ROM at 0x0000 (not Spectrum ROM)
- System boots into ESXDOS instead of Spectrum ROM
- This configuration allows DivMMC to take over from power-on
- Alternative: Disable 0x0000 entry point, enable 0x0066 NMI only for on-demand DOS
- Port 0xE3 read returns 0x00

---

### Test 11.2: `Rapid entry point → RETN → entry point sequence`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xBA bit 1 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- DivMMC ROM at 0x0008 contains: `0xED 0x45` (RETN - immediate return)
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 8` (1st entry)
- Automap activates, CPU reads RETN from DivMMC ROM
- RETN executes, clears automap, returns to 0x8001
- CPU immediately executes another `RST 8` (2nd entry)
- Automap activates again

**Then:**
- First RST 8: `automap_held` = 1, DivMMC maps
- First RETN: `automap_held` = 0, DivMMC unmaps, returns to 0x8001
- Second RST 8: `automap_held` = 1, DivMMC maps again
- State machine handles rapid transitions correctly
- No glitches or stuck states
- Each entry point → RETN cycle is independent
- Port 0xE3 returns 0x00 after each RETN
- Demonstrates proper state machine reset behavior

---

### Test 11.3: `Automap during maskable interrupt (RST 38)`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 7 = 1 (entry point 0x0038 enabled)
- NextReg 0xBA bit 7 = 1 (instant timing)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Interrupts enabled, IM 1 mode
- DivMMC ROM at 0x0038 contains: `0xFB 0xED 0x4D` (EI, RETI)
- Port 0xE3 = 0x00

**When:**
- Maskable interrupt (INT) asserts
- CPU acknowledges interrupt, performs RST 38 (automatic in IM 1)
- M1 cycle begins at 0x0038
- Entry point detected, automap activates instantly
- CPU executes EI, RETI from DivMMC ROM
- RETI returns to interrupted code

**Then:**
- Interrupt acknowledge: `automap_hold` = 1, DivMMC maps
- CPU reads EI from DivMMC ROM at 0x0038
- After EI: Interrupts re-enabled, `automap_held` = 1
- CPU reads RETI from DivMMC ROM at 0x0039
- RETI executes: Returns to interrupted code
- `automap_held` remains 1 (RETI doesn't clear automap like RETN)
- DivMMC still mapped after interrupt handler
- May need explicit RETN or unmap to restore normal memory
- Demonstrates difference between RETI (return from maskable interrupt) and RETN (return from NMI, clears DivMMC)

---

### Test 11.4: `Automap during non-maskable interrupt (0x0066)`

**Given:**
- DivMMC is enabled
- NextReg 0xBB bit 1 = 1 (NMI entry point 0x0066 enabled, instant)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- DivMMC ROM at 0x0066 contains: `0xF5 0xC5 ... 0xC1 0xF1 0xED 0x45` (PUSH AF, PUSH BC, ..., POP BC, POP AF, RETN)
- Port 0xE3 = 0x00

**When:**
- Non-maskable interrupt (NMI) asserts
- CPU jumps to 0x0066 (NMI vector, cannot be changed)
- M1 cycle begins at 0x0066
- Entry point detected, automap activates instantly
- CPU executes NMI handler from DivMMC ROM
- RETN at end of handler

**Then:**
- NMI vector: `automap_hold` = 1, DivMMC maps instantly
- CPU reads PUSH AF from DivMMC ROM at 0x0066
- Handler executes from DivMMC ROM
- RETN at end: Clears `automap_held`, `conmem`, DivMMC unmaps
- Returns to interrupted code at 0x8000
- Normal memory mapping restored
- NMI handling works correctly with DivMMC automap
- RETN properly cleans up state

---

### Test 11.5: `All entry points disabled (NextReg 0xB8 = 0x00)`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0x00 (all 8 RST entry points disabled)
- NextReg 0xBB = 0x00 (all additional entry points disabled)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Port 0xE3 = 0x00 (conmem=0, no manual control)

**When:**
- CPU executes sequence: `RST 0`, `RST 8`, `RST 16`, `RST 24`, `RST 32`, `RST 40`, `RST 48`, `RST 56`
- CPU executes `CALL 0x04C6`, `CALL 0x0562`, `CALL 0x04D7`, `CALL 0x056A`
- NMI interrupt occurs (jumps to 0x0066)

**Then:**
- For all RST instructions: No entry points detected, automap does not activate
- CPU executes from normal Spectrum ROM at all entry point addresses
- For all CALL instructions: No entry points detected, automap does not activate
- For NMI: No entry point detected, executes from Spectrum ROM at 0x0066
- `automap_held` = 0, `automap_hold` = 0 throughout
- DivMMC never maps automatically
- Only manual control via port 0xE3 can activate DivMMC
- Port 0xE3 read returns 0x00

---

### Test 11.6: `All entry points enabled (NextReg 0xB8 = 0xFF)`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0xFF (all 8 RST entry points enabled)
- NextReg 0xB9 = 0xFF (ROM 3 not required for any)
- NextReg 0xBA = 0xFF (all instant timing)
- NextReg 0xBB = 0x7F (all additional entry points enabled except 0x3Dxx)
- ROM 3 is present
- CPU is executing from address 0x8000 in normal RAM
- Port 0xE3 = 0x00

**When:**
- CPU executes any RST instruction (0, 8, 16, 24, 32, 40, 48, 56)
- CPU executes CALL to any additional entry point (0x04C6, 0x0562, 0x04D7, 0x056A)
- NMI interrupt occurs

**Then:**
- Every RST instruction triggers automap instantly
- Every additional entry point CALL triggers automap
- NMI trigger triggers automap instantly
- DivMMC very "aggressive" in this configuration
- Almost any ROM call results in DivMMC mapping
- Useful for maximum ESXDOS integration
- May interfere with normal Spectrum ROM operation
- RETN required to unmap after each entry
- Port 0xE3 read returns 0x00 (automap is separate from conmem)

---

### Test 11.7: `Entry point enabled but timing and valid both = 0`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 3 = 1 (entry point 0x0018 enabled)
- NextReg 0xB9 bit 3 = 0 (ROM 3 required)
- NextReg 0xBA bit 3 = 0 (delayed timing)
- ROM 3 is NOT present (48K ROM)
- CPU is executing from address 0x8000 in normal RAM
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 24` instruction
- M1 cycle begins at 0x0018
- Entry point check: enabled=1, ROM3_required=1 (valid=0), ROM3_present=0, timing=delayed

**Then:**
- Entry point NOT detected (ROM 3 requirement not satisfied)
- `automap_hold` = 0, `automap_held` = 0
- DivMMC does not map
- CPU executes from Spectrum ROM at 0x0018
- Configuration: enabled + ROM3_required + no ROM3 = entry point blocked
- Timing setting (instant vs delayed) is irrelevant when entry point blocked
- Port 0xE3 read returns 0x00

---

### Test 11.8: `DivMMC disabled completely (port decode off)`

**Given:**
- DivMMC hardware is disabled at system level (not implemented in this test, but conceptual)
- All NextReg settings irrelevant
- CPU is executing from address 0x8000 in normal RAM
- Normal Spectrum memory mapping active

**When:**
- CPU executes any RST instruction
- CPU writes to port 0xE3
- CPU reads from port 0xE3
- NMI occurs

**Then:**
- No DivMMC behavior occurs
- All RST instructions execute from Spectrum ROM
- Port 0xE3 writes have no effect (port not decoded)
- Port 0xE3 reads return floating bus value (not 0xE3 register)
- NMI executes from Spectrum ROM at 0x0066
- DivMMC completely transparent when disabled
- Normal Spectrum operation unaffected

---

### Test 11.9: `Conflicting instant and delayed config for same entry point`

**Given:**
- DivMMC is enabled
- NextReg 0xB8 bit 1 = 1 (entry point 0x0008 enabled)
- NextReg 0xB9 bit 1 = 1 (ROM 3 not required)
- NextReg 0xBA bit 1 = 1 (instant timing bit set)
- Hypothetically: Both instant and delayed somehow active (hardware shouldn't allow this, but test priority)
- ROM 3 is present
- CPU is executing from address 0x3000 in normal Spectrum ROM
- Port 0xE3 = 0x00

**When:**
- CPU executes `RST 8` instruction
- M1 cycle begins at 0x0008
- Entry point check evaluates timing configuration

**Then:**
- NextReg 0xBA bit determines timing: bit=1 means instant, bit=0 means delayed
- Configuration is binary (one bit per entry point), cannot be both simultaneously
- If bit=1: Instant mode wins, maps during M1 cycle
- If bit=0: Delayed mode wins, maps after instruction
- Hardware design prevents conflict (single bit controls timing)
- In this test: bit=1, so instant mode active
- CPU reads from DivMMC ROM at 0x0008 immediately

---

### Test 11.10: `Memory contention timing with DivMMC active`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x80 (conmem=1, mapram=0, bank=0)
- DivMMC ROM bank 8 mapped to 0x0000-0x1FFF
- DivMMC RAM bank 0 mapped to 0x2000-0x3FFF
- CPU is executing from DivMMC ROM at address 0x0100
- ULA is active, causing contention on normal RAM accesses
- Display is being generated (paper area)

**When:**
- CPU executes `LD A,(0x1000)` - read from DivMMC ROM
- CPU executes `LD B,(0x2500)` - read from DivMMC RAM
- CPU executes `LD C,(0x4000)` - read from contended RAM (screen memory)

**Then:**
- Read from 0x1000 (DivMMC ROM): No contention, uncontended access
- Read from 0x2500 (DivMMC RAM): No contention, uncontended access
- Read from 0x4000 (screen RAM): Contention applies (if in contended window)
- DivMMC memory is external to ULA contention system
- Accesses to DivMMC ROM/RAM are faster (no wait states)
- Performance benefit when executing from DivMMC
- Screen memory (0x4000-0x7FFF) still contended normally
- Contention timing follows standard Spectrum rules for non-DivMMC addresses

---

## Category 12: Port 0xE3 Read/Write Operations

### Test 12.1: `Read port 0xE3 after reset (should return 0x00)`

**Given:**
- DivMMC is enabled
- System has just been reset (power-on or hardware reset)
- All registers cleared to default state
- CPU begins execution at 0x0000
- Port 0xE3 register reset to 0x00

**When:**
- CPU executes `IN A,(0xE3)` instruction
- Port 0xE3 read operation occurs

**Then:**
- Register A = 0x00
- Bit 7 (conmem) = 0 (DivMMC not manually enabled)
- Bit 6 (mapram) = 0 (ROM mode default)
- Bits 5:4 = 0 (unused bits)
- Bits 3:0 = 0 (bank 0 default)
- Reset state confirmed
- DivMMC not active by default (requires entry point or manual enable)

---

### Test 12.2: `Write 0xFF to port 0xE3, read back`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x00 (initial state)
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,0xFF` then `OUT (0xE3),A`
- Port 0xE3 write operation with value 0xFF (binary: 1111_1111)
- CPU executes `IN A,(0xE3)`

**Then:**
- Port 0xE3 write: All writable bits set
- Port 0xE3 read: A = 0xCF (binary: 1100_1111)
- Bit 7 (conmem) = 1 (set)
- Bit 6 (mapram) = 1 (set, sticky)
- Bits 5:4 = 0 (unused, always read as 0 even if written as 1)
- Bits 3:0 = 15 (0xF, all bank select bits set)
- Unused bits masked off in read-back
- DivMMC RAM bank 3 mapped to 0x0000-0x1FFF (mapram=1)
- DivMMC RAM bank 15 mapped to 0x2000-0x3FFF

---

### Test 12.3: `Write 0x00 to port 0xE3, read back`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0xFF (all bits set from previous test)
- CPU is executing from DivMMC RAM at address 0x0100

**When:**
- CPU executes `LD A,0x00` then `OUT (0xE3),A`
- Port 0xE3 write operation with value 0x00 (binary: 0000_0000)
- CPU executes `IN A,(0xE3)`

**Then:**
- Port 0xE3 write: Attempt to clear all bits
- Port 0xE3 read: A = 0x40 (binary: 0100_0000)
- Bit 7 (conmem) = 0 (cleared successfully)
- Bit 6 (mapram) = 1 (CANNOT be cleared, sticky bit)
- Bits 5:4 = 0 (unused)
- Bits 3:0 = 0 (cleared to bank 0)
- mapram sticky behavior demonstrated
- DivMMC unmapped due to conmem=0
- But mapram state preserved in register

---

### Test 12.4: `mapram bit OR behavior (write 0x40, write 0x00, read should be 0x40)`

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x00 (initial state, mapram=0)
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `LD A,0x40` then `OUT (0xE3),A` (set mapram bit)
- Port 0xE3 = 0x40 (conmem=0, mapram=1, bank=0)
- CPU executes `LD A,0x00` then `OUT (0xE3),A` (attempt to clear mapram)
- CPU executes `IN A,(0xE3)`

**Then:**
- After first write: Port 0xE3 = 0x40, mapram=1
- After second write: Port 0xE3 = 0x40 (mapram bit persists)
- Read-back: A = 0x40
- Bit 6 (mapram) uses OR logic: once set, remains set
- Writing 0 to mapram bit has no effect
- Only NextReg 0x09 bit 3 can clear mapram
- Demonstrates sticky bit behavior
- conmem and bank bits respond normally to writes

---

### Test 12.5: `Port 0xE3 updated by RETN (conmem cleared)`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0xC7 (conmem=1, mapram=1, bank=7)
- `automap_held` = 1, `automap_hold` = 1
- CPU is executing from DivMMC RAM at address 0x0300
- Stack contains return address 0x9000

**When:**
- CPU executes `RETN` instruction
- DivMMC logic processes RETN
- CPU executes `IN A,(0xE3)` after returning to 0x9000

**Then:**
- After RETN: Port 0xE3 = 0x47 (conmem=0, mapram=1, bank=7)
- Bit 7 (conmem) = 0 (cleared by RETN)
- Bit 6 (mapram) = 1 (preserved, not affected by RETN)
- Bits 3:0 = 7 (preserved, not affected by RETN)
- Read-back confirms: A = 0x47
- Only conmem bit cleared by RETN
- Other port 0xE3 state preserved
- DivMMC unmapped but configuration retained

---

### Test 12.6: `Port 0xE3 preserves bank bits during RETN`

**Given:**
- DivMMC is enabled and active
- Port 0xE3 = 0x8D (conmem=1, mapram=0, bank=13)
- `automap_held` = 1
- CPU is executing from DivMMC ROM at address 0x0500
- Stack contains return address 0x7000

**When:**
- CPU executes `RETN` instruction
- CPU executes `OUT (0xE3),A` with A = 0x8E (re-enable with bank 14)
- CPU executes `IN B,(0xE3)`

**Then:**
- After RETN: Port 0xE3 = 0x0D (conmem=0, mapram=0, bank=13)
- Bank bits preserved during RETN
- After re-enable write: Port 0xE3 = 0x8E (conmem=1, mapram=0, bank=14)
- Bank successfully changed to 14
- Read-back: B = 0x8E
- Demonstrates bank bits are independent of conmem bit
- RETN doesn't reset bank selection, only clears conmem
- Software can restore DivMMC with different bank if needed

---

## Category 13: Regression Tests (Implementation Issues)

### Test 13.1: `REGRESSION: conmem=1 manually activates DivMMC mapping on next opcode fetch`

**Issue**: Missing Manual CONMEM Control - The implementation doesn't check the `conmem` bit to activate DivMMC paging.

**Given:**
- DivMMC is enabled (`nextReg83 = 0x01`)
- No entry points configured (all NextReg 0xB8/0xBA bits = 0)
- `automap_held` = 0, `automap_hold` = 0 (no automap active)
- Port 0xE3 = 0x00 (conmem=0, DivMMC unmapped)
- CPU is executing from address 0x4000 in normal RAM
- Normal Spectrum ROM at 0x0000-0x1FFF
- DivMMC ROM bank 8 available but not mapped
- enableAutomap = true (automap feature enabled in settings)

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x81 (binary: 1000_0001)
  - Bit 7 (conmem) = 1 (set to manually enable DivMMC)
  - Bit 6 (mapram) = 0 (ROM mode)
  - Bits 3:0 (bank) = 1
- Port 0xE3 write occurs
- DivMmcDevice.port0xe3Value setter is called
- CPU increments PC to 0x4001 and prepares next opcode fetch
- CPU enters opcode fetch phase for address 0x4001

**Then:**
- After `OUT` instruction: Port 0xE3 = 0x81
- `_conmem` flag = true (captured correctly by setter)
- `_enableAutomap` = true (automap enabled)
- Before next opcode fetch: `beforeOpcodeFetch()` is called with PC = 0x4001
- **CRITICAL**: `beforeOpcodeFetch()` MUST detect `conmem=1` and activate DivMMC:
  - `_autoMapActive` = true
  - Call `updateFastPathFlags()` to update memory mapping
- DivMMC ROM bank 8 is now mapped to 0x0000-0x1FFF (overriding Spectrum ROM)
- Next instruction at 0x4001 is fetched from normal RAM (unaffected, as 0x4001 > 0x3FFF)
- But instruction at 0x0000 would be read from DivMMC ROM (if CPU jumps there)
- Subsequent fetches from 0x0000-0x1FFF access DivMMC ROM
- Port 0xE3 read returns 0x81

**Verification**:
- After OUT (0xE3),0x81: Check that memory mapping updated
- Memory reads at 0x0000-0x1FFF should access DivMMC ROM, not Spectrum ROM
- If test fails: `beforeOpcodeFetch()` doesn't check `_conmem` flag
- Must add code: `if (this._conmem && this._enableAutomap) { this._autoMapActive = true; ... }`

---

### Test 13.2: `REGRESSION: conmem=1 persists across multiple instructions until cleared`

**Issue**: Manual CONMEM control must remain active until explicitly disabled by `conmem=0`.

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x81 (conmem=1, DivMMC mapped)
- `_autoMapActive` = true (from previous state or manual setting)
- CPU is executing multiple instructions
- PC = 0x4000, 0x4001, 0x4002, 0x4003 (normal RAM, not affected by DivMMC)

**When:**
- CPU executes: `NOP` at 0x4000
- CPU executes: `NOP` at 0x4001
- CPU executes: `NOP` at 0x4002
- CPU executes: `JP 0x0100` at 0x4003
- After each instruction, `beforeOpcodeFetch()` called with new PC
- No changes to Port 0xE3

**Then:**
- After NOP at 0x4000: conmem=1, `_autoMapActive` = true (persists)
- After NOP at 0x4001: conmem=1, `_autoMapActive` = true (persists)
- After NOP at 0x4002: conmem=1, `_autoMapActive` = true (persists)
- After JP at 0x4003: CPU jumps to 0x0100
- At 0x0100 M1 cycle: `beforeOpcodeFetch()` called with PC = 0x0100
- `_conmem` = true (still set), so `_autoMapActive` must remain true
- Instruction fetched from 0x0100 must come from DivMMC ROM (not Spectrum ROM)
- `conmem=1` state must NOT be overwritten by entry point checks
- Test passes if: DivMMC ROM remains mapped until explicit `OUT (0xE3),value_with_bit7_clear` occurs

**Expected Failure Mode** (if bug exists):
- `_autoMapActive` might be cleared at 0x0100 if entry point code path resets it
- Or `_conmem` might not be re-checked on every `beforeOpcodeFetch()` call
- Result: DivMMC unmaps unexpectedly, Spectrum ROM appears at 0x0000-0x1FFF

---

### Test 13.3: `REGRESSION: conmem=0 disables DivMMC mapping (except if automap active)`

**Issue**: Manual CONMEM control must be properly disabled.

**Given:**
- DivMMC is enabled
- Port 0xE3 = 0x81 (conmem=1, DivMMC ROM mapped)
- `_autoMapActive` = true
- No automap active (no entry points triggered)
- `automap_held` = 0, `automap_hold` = 0
- CPU is executing from address 0x8000 in normal RAM

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x01 (binary: 0000_0001)
  - Bit 7 (conmem) = 0 (disable manual control)
  - Bit 6 (mapram) = 0 (ROM mode)
  - Bits 3:0 (bank) = 1
- Port 0xE3 write occurs
- DivMmcDevice.port0xe3Value setter is called
- CPU executes next instruction at 0x8001

**Then:**
- After `OUT` instruction: Port 0xE3 = 0x01
- `_conmem` flag = false (cleared)
- `automap_held` = false, `automap_hold` = false (no automap active)
- Before next opcode fetch at 0x8001: `beforeOpcodeFetch()` called
- `beforeOpcodeFetch()` evaluates: `conmem=0` AND `automap_held=0`
- DivMMC is NOT active (no mapping active)
- Next instruction at 0x8001 fetched from normal RAM (correct)
- If CPU jumps to 0x0100: instruction fetched from Spectrum ROM, NOT DivMMC ROM
- Memory mapping at 0x0000-0x1FFF returns to normal Spectrum ROM
- Port 0xE3 read returns 0x01

**Verification**:
- After OUT (0xE3),0x01: Memory at 0x0000-0x1FFF should be Spectrum ROM
- Memory reads at 0x0000 should return Spectrum ROM content, not DivMMC ROM

---

### Test 13.4: `REGRESSION: conmem overrides default memory mapping independently`

**Issue**: `conmem=1` should work even when no entry points are configured.

**Given:**
- DivMMC is enabled
- NextReg 0xB8 = 0x00 (all entry points disabled)
- NextReg 0xBA = 0x00 (no instant timing configured)
- Port 0xE3 = 0x00 (conmem=0, DivMMC unmapped)
- CPU is executing from address 0x5000 in normal RAM
- `automap_held` = 0 (no automap active)
- Normal Spectrum ROM at 0x0000-0x1FFF

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x84 (conmem=1, bank=4)
- Port 0xE3 setter processes write
- CPU executes multiple instructions without triggering any entry points
- CPU jumps to address 0x0050

**Then:**
- After OUT: Port 0xE3 = 0x84, conmem=1
- No entry points are available to interfere
- `beforeOpcodeFetch()` called at PC = 0x0050
- Must check: `if (this._conmem && this._enableAutomap) { activate DivMMC }`
- This check must be independent of entry point logic
- DivMMC ROM must be mapped despite no entry points configured
- Instruction at 0x0050 fetched from DivMMC ROM (not Spectrum ROM)
- Demonstrates that `conmem` works as standalone control, not dependent on entry points

---

### Test 13.5: `REGRESSION: enableAutomap=false disables manual conmem control`

**Issue**: Even with `conmem=1`, if `enableAutomap=false`, DivMMC should remain unmapped.

**Given:**
- DivMMC is enabled
- `enableAutomap` = false (automap feature disabled globally)
- Port 0xE3 = 0x00 (conmem=0)
- CPU is executing from address 0x6000 in normal RAM

**When:**
- CPU executes `OUT (0xE3),A` with A = 0x82 (conmem=1, bank=2)
- Port 0xE3 setter processes write
- CPU executes instruction at 0x6000
- CPU jumps to address 0x0100

**Then:**
- After OUT: Port 0xE3 = 0x82, `_conmem` = true
- Before opcode fetch at 0x0100: `beforeOpcodeFetch()` called
- `beforeOpcodeFetch()` checks: `if (!this.enableAutomap) return;` (exits early)
- Alternative check: `if (this._conmem && this._enableAutomap) { ... }` (false, so skip)
- `_autoMapActive` remains false
- DivMMC ROM NOT mapped, Spectrum ROM at 0x0000-0x1FFF
- Instruction at 0x0100 fetched from Spectrum ROM
- Port 0xE3 read returns 0x82 (conmem bit still set in register)
- Demonstrates that enableAutomap setting controls both automap AND manual conmem

---

