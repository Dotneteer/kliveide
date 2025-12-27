# Glossary

A reference guide to terminology used throughout the book. This isn't your typical dry glossary - we'll explain terms like we're having a conversation, not writing a dictionary.

---

## A

### Address Bus
The wires that carry memory addresses from the CPU to memory. Think of it as the CPU saying "I want to talk to the byte at this specific location." The Z80 has 16 address lines (A0-A15), giving it a 64KB address space. The ZX Spectrum Next extends this with 5 more lines (A16-A20) through the MMU, reaching 2MB.

### Address Decoding
The process of figuring out which memory or device should respond to a specific address. Like a postal system routing mail to the right house, address decoding ensures that when the CPU reads from 0x4000, the correct memory chip (or ROM, or hardware register) answers the call.

### Alt ROM (Alternative ROM)
The ZX Spectrum Next can swap between different ROM images on the fly. The alternative ROM is typically the 128K or 48K Spectrum ROM, while the default contains the Next's native firmware. Useful for compatibility with original Spectrum software.

### Automap
DivMMC's clever trick for automatically paging in its ROM/RAM when the CPU hits specific addresses (like RST instructions) or I/O ports. It's like having a butler who appears exactly when you need them without being called - the system just "knows" when ESXDOS needs to take over.

---

## B

### 8K-Bank
An 8KB chunk of memory used by the Next's MMU system. The official ZX Spectrum Next documentation uses "8k-bank" to distinguish these from the traditional "16k-bank" (16KB chunks). With 2MB of total memory, there are 256 8K-banks numbered 0-255, though the MMU can only directly address 8K-banks 0-223 (0x00-0xDF). Values 224-255 (0xE0-0xFF) trigger special System Region access. Some older documentation uses "page" for the same concept.

### Bank
In ZX Spectrum terminology, a bank typically refers to a 16KB chunk of memory (also called "16k-bank" in official Next documentation). Bank 5 and Bank 7 are special - they're video memory banks that can be accessed by both the CPU and the display hardware. Don't confuse this with memory "regions" (64KB chunks used by the address decoder).

### Bank 5
The main display memory (16KB) at physical addresses 0x014000-0x017FFF, implemented as dual-port BRAM. Pages 0x0A and 0x0B. This is where the screen bitmap lives in standard 48K mode. Subject to ULA contention because the display hardware reads from it constantly.

### Bank 7
Shadow screen memory (8KB only, due to BRAM limitations) at physical address starting at 0x01C000, page 0x0E. Used in 128K mode for page-flipping effects. Also implemented as dual-port BRAM.

### Boot ROM
The ROM that's active when the system first powers on. Highest priority in the memory decode hierarchy - nothing can override it during boot. Contains initialization code to set up the system before handing control to the main firmware.

### BRAM (Block RAM)
Internal FPGA memory blocks. Fast, dual-ported (both CPU and video can access simultaneously), but limited in size. The Next uses BRAM for Banks 5 and 7 because they need to be shared between the CPU and display hardware without slowing things down.

---

## C

### Configuration Mode
A special mode (activated via NextReg 0x03) that maps alternative ROM/RAM for system updates and configuration. Like a "safe mode" for updating the firmware without bricking the machine.

### Contention
When two parts of the system want the same memory at the same time, someone has to wait. The most common case is ULA contention - when the CPU tries to access Bank 5 while the ULA is reading screen data. The CPU gets paused for a few cycles. Can be disabled via NextReg 0x08 bit 6 if you don't care about timing accuracy.

### CPU (Central Processing Unit)
The Z80 processor at the heart of the ZX Spectrum Next. It executes your programs, reads from memory, writes to hardware, and generally makes everything happen. Runs at 3.5, 7, 14, or 28 MHz depending on the speed setting.

---

## D

### DivMMC
An SD card interface and operating system (ESXDOS) for the Spectrum. On the Next, it's built-in rather than being an add-on. Uses automap to page itself in automatically when DOS services are needed. Has its own ROM (8KB at physical 0x010000) and RAM (128KB at physical 0x020000-0x03FFFF).

---

## L

### Layer 2
The Next's high-color graphics mode supporting 256 colors. Has its own memory mapping system that can override the MMU for the first 48K of address space. Priority level 4 in the memory decode hierarchy.

---

## M

### MMU (Memory Management Unit)
The hardware that extends the Z80's 64KB address space to access all 2MB of memory. Divides the 64KB into 8 slots of 8KB each, with registers (NextReg 0x50-0x57) controlling which physical page appears in each slot. Can address physical memory starting at 0x040000 (after the System Region).

### Multiface
A debugging and snapshot tool that can freeze the machine and inspect/save its state. Activated via NMI button or software trigger. Has its own ROM/RAM at physical 0x014000-0x017FFF. Priority level 2 in the decode hierarchy - only Boot ROM can beat it.

---

## N

### NextReg (Next Register)
Configuration registers accessed via ports 0x243B (select) and 0x253B (read/write). Control almost every aspect of the Next's hardware - memory mapping, graphics modes, audio, etc. The MMU registers (0x50-0x57) are NextRegs.

---

## P

### Page
An 8KB chunk of memory. The MMU uses pages as its unit of mapping - each of the 8 MMU slots maps to one page. With 2MB total memory and 8KB pages, there are 256 theoretical pages (0x00-0xFF), but only pages 0-223 (0x00-0xDF) are usable by the MMU formula. Pages 224-255 trigger special System Region access.

### Priority Decode Chain
The ordered list of memory systems checked when the CPU accesses an address. Higher priority systems respond first. For example, in the 0x0000-0x3FFF range: Boot ROM (1) > Multiface (2) > DivMMC (3) > Layer 2 (4) > MMU (5) > Config (6) > ROMCS (7) > Standard ROM (8). The order ensures critical systems like boot and debugging always work.

---

## R

### ROM (Read-Only Memory)
On the Next, "ROM" is a polite fiction - it's actually SRAM that's write-protected by the memory controller. Contains firmware images and system code. The write protection can be disabled via NextReg 0x8C for updates. All ROM images live in the System Region (first 256K of physical memory).

### ROMCS (ROM Chip Select)
A signal from expansion bus hardware saying "I have ROM for you!" Allows external cards to provide their own ROM without modifying the internal memory. Mapped to physical addresses 0x01C000-0x01FFFF (DivMMC banks 14-15). Priority level 6 - near the bottom of the decode chain.

---

## S

### Slot
One of the eight 8KB regions of the Z80's 64KB address space. Slot 0 is 0x0000-0x1FFF, Slot 1 is 0x2000-0x3FFF, and so on. Each slot has a corresponding MMU register that determines which physical page appears there.

### SRAM (Static RAM)
The main memory chips in the Next. All 2MB of physical memory is SRAM - fast, doesn't need refreshing (unlike DRAM), but larger physically. Even the "ROM" areas are SRAM with write protection.

### System Region
The first 256K of physical memory (0x000000-0x03FFFF) containing firmware ROM images, DivMMC ROM/RAM, Multiface ROM/RAM, and Alt ROMs. This region is accessed through the priority decode chain, NOT through the MMU's normal paging mechanism. MMU values 224-255 bypass the MMU formula and access different parts of this region instead.

---

## U

### ULA (Uncommitted Logic Array)
The chip that generates the video display in original Spectrums. On the Next it's implemented in the FPGA. Reads from Bank 5 to display the screen, causing contention when the CPU tries to access the same memory.

---

## W

### Wait State
An extra clock cycle inserted to give slower hardware time to respond. At 28 MHz, SRAM needs 1 wait state. At lower speeds, no wait states are needed. Think of it as the CPU politely pausing to let memory catch up.

---

## Z

### Z80
The 8-bit CPU used in the ZX Spectrum and many other 1980s computers. Has a 16-bit address bus (64KB address space) and 8-bit data bus. The Next uses a soft-core Z80 implementation in the FPGA with Next-specific extensions.
A coprocessor that can modify hardware registers in sync with the display beam. Named after the Amiga's similar feature. Can change colors, trigger interrupts, and generally make the display more interesting. Not directly related to memory management, but can modify memory-related registers mid-frame.

---

## D

### Decode Chain / Decode Hierarchy
The priority order used to determine which memory responds to an address. Like a chain of command in the military - Boot ROM has highest priority, then Multiface, then DivMMC, and so on. Each level can "override" the levels below it. There are three separate chains for different address ranges (0-16K, 16K-48K, 48K-64K).

### DivMMC
A hardware interface (originally an external device, now built into the Next) that provides SD card access and ESXDOS support. It has its own ROM (8KB) and RAM (128KB) that can be automatically paged in when needed. Named after the divide-by-MMC clock generation trick used in the original design.

### Dual-Port RAM
Memory that can be accessed by two different components simultaneously. Bank 5 and Bank 7 are dual-ported so the CPU can write to them while the ULA reads for display. Without dual-porting, you'd get horrible slowdowns or screen corruption.

---

## E

### ESXDOS
The operating system that runs from DivMMC ROM/RAM. Provides file system access and DOS-like commands. When you're loading a .NEX file or accessing the SD card, ESXDOS is handling it behind the scenes.

### Expansion Bus
External connector that allows adding hardware like joystick interfaces, sound cards, etc. Can provide external ROM via the ROMCS signal. The memory management system includes delays at certain speeds to give slow expansion cards time to respond.

---

## I

### I/O Port
A 16-bit address used for communicating with hardware rather than memory. The Z80 has separate instructions for I/O (IN/OUT) vs memory (LD). Ports control everything from the keyboard to the NextReg register system.

---

## L

### Layer 2
A 256x192 bitmap graphics layer with 256 colors. Has its own memory mapping system that can override the normal MMU for the first 48K of address space. Controlled by port 0x123B and NextReg registers 0x12/0x13.

### LoRes (Low Resolution Mode)
A 128x96 display mode with 256 colors per pixel. Shares Bank 5 with the CPU, so requires arbitration. Named because each pixel is effectively 2x2 screen pixels.

---

## M

### Memory Region
A 64KB chunk of the 2MB physical address space. Selected by bits A20:A16, giving 32 possible regions (0-31). This is address decoder terminology, distinct from traditional Spectrum "banks." Region 0 is the system ROMs, region 1 contains DivMMC/Multiface/Alt ROMs, regions 2-3 are main RAM, etc.

### MMU (Memory Management Unit)
The hardware that translates Z80's 16-bit addresses into 21-bit physical addresses. Divides the 64KB Z80 address space into 8 slots of 8KB each, with each slot pointing to any 8KB page in the 2MB physical memory.

### MMU Slot
One of 8 divisions (0-7) of the Z80's 64KB address space. Each slot is 8KB. Slot 0 = 0x0000-0x1FFF, Slot 1 = 0x2000-0x3FFF, etc. Controlled by MMU registers (NextReg 0x50-0x57).

### Multiface
A debugging/snapshot tool that can pause execution and save/restore machine state. Has its own 16KB ROM/RAM at physical address 0x014000. When activated (via NMI button), it gets highest priority in the decode chain (except Boot ROM).

---

## N

### NextReg (Next Extended Registers)
A set of 256 registers (0x00-0xFF) that control everything unique to the Next. Accessed via a two-step process: write register number to port 0x243B, then read/write data at port 0x253B. Controls MMU, Layer 2, timing, and dozens of other features.

### NMI (Non-Maskable Interrupt)
A hardware interrupt that can't be disabled by software. Used by Multiface and DivMMC to grab control instantly. NextReg 0x02 can trigger NMIs programmatically.

---

## P

### Page
Sometimes used as an alternative term for "8K-bank" - an 8KB unit of physical memory. The official ZX Spectrum Next documentation prefers "8k-bank" to avoid confusion with the general concept of "paging" (swapping memory regions). See "8K-Bank" for the full definition.

### Page Calculation
The process of converting an 8-bit MMU register value into a 21-bit physical address. Formula: `((MMU_reg[7:5] + 1) << 16) | (MMU_reg[4:0] << 13) | CPU_A[12:0]`. The "+1" offset accounts for region 0 being reserved for system ROMs.

### Priority Decode
See "Decode Chain" - same concept. The systematic checking of each memory system in order until one responds to an address.

---

## R

### ROM (Read-Only Memory)
Technically a misnomer on the Next - all memory is physically SRAM (writable). "ROM" areas are write-protected by the memory controller, not by hardware. Can be made writable via NextReg 0x8C for firmware updates.

### ROMCS (ROM Chip Select)
A signal from the expansion bus indicating that external hardware wants to provide ROM for address 0x0000-0x3FFF. Memory cycle delays at slower CPU speeds give expansion cards time to assert this signal.

---

## S

### Shadow Screen
A second screen buffer that can be written to while the other is displayed, then flipped for smooth animation. Traditionally located in Bank 7. Standard 128K Spectrum feature, supported on the Next.

### Slot
See "MMU Slot" - the 8 divisions of the Z80's address space.

### SRAM (Static RAM)
The main 2MB memory chips on the Next. Faster than DRAM (no refresh needed) but more expensive. Everything except Banks 5/7 lives in SRAM.

---

## T

### Tilemap
A character/tile-based display mode. Can read from Bank 5 or Bank 7, requiring arbitration with the CPU and ULA.

---

## U

### ULA (Uncommitted Logic Array)
The custom chip that generates the display, handles keyboard input, and produces sound on original Spectrums. On the Next, it's implemented in FPGA logic but still called the ULA. Causes memory contention when accessing Bank 5.

---

## W

### Wait State
Extra clock cycles inserted when the CPU needs to wait for memory. At 28 MHz, SRAM reads need one wait state. Bank 5 reads may need additional wait states due to contention with the ULA.

---

## Z

### Z80
The 8-bit CPU at the heart of all Spectrum models. Originally designed by Zilog in 1976. Has a 16-bit address bus (64KB), 8-bit data bus, and a fascinating instruction set that includes some truly weird undocumented opcodes.

---

*This glossary will grow as the book introduces new concepts. If a term feels overloaded or ambiguous, we'll add clarifications here to keep the terminology consistent.*
