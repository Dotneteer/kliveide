# Generic Z80 virtual machine design

Klive can run generic Z80-based machines that fit into these constraints:
- Up to 16MB memory (24-bit address space)
- Any banking/paging model with 8K blocks an 8K address boundaries
- Standard (documented and originally undocumented) Z80 instructions
- Extended (ZX Spectrum Next) instructions
- Frame-bound execution cycle with well-defined frames that can be the base of the screen, sound, or another output rendering. For example, for ZX Spectrum models, this frame is the screen rendering frame (~20 milliseconds). For Cambridge Z88, this is the 5ms tick frame of the internal real-time clock.

Klive intends to provide these services to build emulation and IDE for such machines
- Breakpoints for the Z80 16-bit address space
- Breakpoints for the entire virtual memory
- Memory read breakpoints for the Z80 16-bit address space
- Memory write breakpoints for the Z80 16-bit address space
- I/O read breakpoints for the Z80 16-bit port address space
- I/O write breakpoints for the Z80 16-bit port address space
- Binary debugging: step-into, step-over, step-out

## Implementation technology

Klive uses the Electron shell to support the toolset on Mac, Linux, and Windows. For the sake of performance, it implements the core of the virtual machines in native WebAssembly. Currently, it can run a ZX Spectrum 48 emulator with a 56 MHz CPU.
Klive uses TypeScript (JavaScript) to implement the emulator UI and supporting functions for the virtual machines (for example, breakpoint management).

The IDE part is a VS Code extension that communicates with the emulator. The IDE implementation uses TypeScript and Svelte. The emulator provides a web server that the IDE can use for controlling the emulator.

## The Z80 CPU

Klive implements a Z80 CPU that handles the initially and later documented Z80 instructions, plus the extended instructions defined by the ZX Spectrum Next project.

> *Note*: By "later documented Z80 instructions", we mean the ones that handle the LSB and SMB of IX, IY, and the peculiarities of Bit 3 and Bit 5 of Z80 flags. For more details, see this document: http://ebook.pldworld.com/_eBook/Z80/www.myquest.nl/z80undocumented/z80-documented-v0.91.pdf.

### Registers

The Klive implementation contains all the registers available with the instruction set. It also includes an internal register called `WZ` (some call it MEMPTR), which influences Bit 3 and 5 of the Z80 flags in many operations.

### Diagnostics capabilites

The Z80 CPU implementation allows some special diagnostic features:
- Signing memory read and write events (for the use of the Z80 virtual machine)
- Signing I/O read and write events (for the use of the Z80 virtual machine)
- Running in diagnostics mode provides hooks that can call any JavaScript method used for logging and advanced diagnostics.

### CPU operation

The CPU implementation uses a single execution flow (CPU cycle) that contains these steps:

1. Processes the INT, HLT, NMI, and RST signals, all that are raised.
2. Reads the operation code from the Program Counter address
3. Executes a memory refresh cycle
4. Processes the operation code read in step 2.

Observe that a multi-byte Z80 instruction need as many CPU cycles as many bytes it has. When the engine processes the opcode in step 4, it may just administer a few flags. For example, when the operation code is $cb, the engine administers that the next operation code should be processed as a bit-operation. Only the next cycle will process that instruction.

However, step 4 processes the argument bytes of a particular instruction. For example, the `LD BC,$0001` instruction contains 3 bytes. The first byte ($01) is the operation code; the subsequent two bytes are the arguments in LSB/MSB order. Step 4 reads the arguments and processes the statement entirely.

### Timing

Timing is the cornerstone of the CPU's operation. Without it, you cannot create virtual machines that emulate real hardware accurately and with high fidelity.

The CPU implementation counts the clock cycles while executing the instructions precisely according to the official Z80 specification. Memory and I/O operations may contend with other hardware devices. The Klive Z80 CPU implementation allows virtual machines to override memory read and write and I/O handling. So virtual machines can implement their contention schemes.

To support the frame-bound execution cycle, Klive uses these state variables for accurate timing:

- `$baseClockFrequency`: The clock frequency of the CPU, in another way, the number of clock cycles per second.
- `$clockMultiplier`: The base frequency can be multiplied by setting this value (defaults to 1).
- `$tactsInFrame`: The number of tacts in a single frame when the CPU runs with regular clock frequency.
- `$tacts`: The number of CPU clock cycles executed since the beginning of the current frame.
- `$lastRenderedFrameTact`: The tact index within a frame after performing the last CPU cycle.
- `$frameCount`: The number of completed frames.

> *Note*: With this abstraction, the CPU's clock can be handled separately from the _master clock_ that determines the frame timing. For example, for a ZX Spectrum implementation, you can increase the CPU frequency while the screen rendering uses the original timing.

When a virtual machine is initialized, it should specify constant values for `$baseClockFrequency`, and `$tactsInFrame`. Optionally, it can specify a different `$clockMultiplier` (integer). Let's see a few examples!

For ZX Spectrum 48K:

```javascript
$baseClockFrequency = 3_500_000;
$tactsInFrame       = 69_888; // 50.08 frames per second
```

For Cambridge Z88:

```javascript
$baseClockFrequency = 3_276_800;
$tactsInFrame       = 16_384; // 200 frames per second
```

While executing a virtual machine frame, the engine updates the `$lastRenderedFrameTact` variable after each executed CPU instruction (and not after each CPU cycle):

```javascript
$lastRenderedFrameTact = $tacts/$clockMultiplier;
```

Whenever a frame completes (`$lastRenderedFrameTact` >= `$tactsInFrame`), the engine starts a new frame with updating the state variables:

```javascript
$framecount++;
$tacts = $tacts - $tactsInFrame * $clockMultiplier;
$lastRenderedFrameTact = $tacts/$clockMultiplier
```

In a few places in the code (for example, when emulating tape), the engine needs to know the number of clock cycles elapsed since starting the virtual machine. This value (64-bit integer) can be calculated like this:

```javascript
clockCycles = $framecount * $tactInFrame * $clockMultiplier + $tacts
```

### Internal CPU state

The Z80 CPU implementation uses a few state variables to keep track of the current execution cycle state:

- `$cpuSignalFlags`: A variable that represents the signal flags (INT, NMI, HLT, and RST) of the CPU. The zero value indicates that there is no signal to process.
- `$iff1`, `$iff2`: The internal IFF1 and IFF2 flip-flops of the Z80 CPU to manage interrupt state.
- `$interruptMode`: The current interrupt mode as set by the `IM 0`, `IM 1`, and `IM 2` Z80 instructions.
- `$isInterruptBlocked`: Flag that disables interrupt in the middle of an instruction's execution.
- `$prefixMode`: Signs the current prefix mode:
    - $00: Standard instrcutions
    - $01: $CB prefix, bit instructions
    - $02: $ED prefix, extended instructions
- `$indexMode`: Index register-related operation
    - $00: No index register use
    - $01: Use IX
    - $02: Use IY
- `$opCode`: The last fetched operation code byte

## Memory

### Memory structure

According to the particular machine's implementation, the Z80 virtual machine can access up to 16 MB flat memory (24-bit address line) through paging/banking logic. The 16-bit addressable memory is split up into eight blocks, each with a size of 8 KB. The addressing logic of the engine determines how these blocks are mapped to the flat memory.

### Memory addressing

There are three types of addresses we use when detailing the operation of the Klive engine:
- *Address*: The 16-bit address managed by the Z80 CPU
- *Flat address*: The 24-bit absolute address within the 16 MB memory available for a virtual machine
- *Machine address*: The address described according to the addressing semantics of a particular virtual machine. The machine must provide an address calculation logic that can give a 16-bit CPU *address* and a *partition* (bank, page, region, or whatever) from the *machine address* unambiguously. Machine address is just a notation for representing the (up to) 24-bit address in a form useful for the particular machine type.

### Address calculation

The virtual machine must implement its banking/paging logic by administering the `BLOCK_LOOKUP_TABLE` structure to map an address to a flat address.

```
BLOCK_LOOKUP_TABLE (64 bytes)                               MEMORY (16 MB)
(8 bytes for each block)                                    ($800 blocks, 8K each)

==============================================               =====================
| PTR to RD Block #0 ($0000-$1fff) (4 bytes) |------|        | Memory block #000 |
----------------------------------------------      |        ---------------------
| PTR to WR Block #0 ($0000-$1fff) (4 bytes) |----| |------->| Memory block #001 |
----------------------------------------------    |          ---------------------
| Block #0 type flags              (1 byte)  |    |--------->| Memory block #002 |
----------------------------------------------               ---------------------
| Block #0 reserved for VM use     (7 bytes) |    |--------->| Memory block #003 |
==============================================    |          ---------------------
| PTR to RD Block #1 ($2000-$3fff) (4 bytes) |----|                    ...
----------------------------------------------    |
| PTR to WR Block #1 ($2000-$3fff) (4 bytes) |----|
----------------------------------------------
| Block #1 type flags              (1 byte)  |
----------------------------------------------
| Block #1 reserved for VM use     (7 bytes) |                         ...
==============================================               ---------------------
| PTR to RD Block #2 ($4000-$5fff) (4 bytes) |---|---------->| Memory block #1f2 |
----------------------------------------------   |           ---------------------
| PTR to WR Block #2 ($4000-$5fff) (4 bytes) |---|                     ...
----------------------------------------------
| Block #2 type flags              (1 byte)  |
----------------------------------------------
| Block #2 reserved for VM use     (7 bytes) |
==============================================
                   ...                                                 ...
==============================================
| PTR to RD Block #6 ($c000-$dfff) (4 bytes) |
----------------------------------------------
| PTR to WR Block #6 ($c000-$dfff) (4 bytes) |
----------------------------------------------
| Block #6 type flags              (1 byte)  |
----------------------------------------------
| Block #6 reserved for VM use     (7 bytes) |                         ...
==============================================               ---------------------
| PTR to RD Block #7 ($e000-$ffff) (4 bytes) |               | Memory block #7fc |
----------------------------------------------               ---------------------
| PTR to WR Block #7 ($e000-$ffff) (4 bytes) |               | Memory block #7fd |
----------------------------------------------               ---------------------
| Block #7 type flags              (1 byte)  |               | Memory block #7fe |
----------------------------------------------               ---------------------
| Block #7 reserved for VM use     (7 bytes) |               | Memory block #7ff |
==============================================               =====================
```

The lookup table has eight entries, one for each 8K block within the 16-bit 64K range available for Z80 machine code. The entry of a block has these fields:
- `RD_PTR`: Pointer to the 8K memory block within the 16MB physical memory (flat address) as the source of reading operations (4 bytes)
- `WR_PTR`: Pointer to the 8K memory block within the 16MB physical memory (flat address) as the target of write operations (4 bytes)
- `BL_FLAGS`: Flags for the type of memory behind that block
    - 0x00: RAM, can be read and written
    - 0x01: ROM, read-only
    - 0xff: Unavailable block (no physical memory behind the block). Cannot be written, reads 0xff, random noise, or other values a particular virtual machine uses (1 byte)
- `BL_RESV`: Reserved for the use of the virtual machine (7 bytes)

For most virtual machines, `RD_PTR`, and `WR_PTR` share the same value. However, the engine may have different addressing logic for reads and writes.

When the CPU is addressing a specific 16-bit address, this is the algorithm that determines the access:
- The most significant three bits (A15-A13) determine the *block ID* ($00-$07). The address calculation uses the corresponding entry of BLOCK_LOOKUP_TABLE.
- The least significant 13 bits (A12-A0) gives the *offset* within the block ($0000-$1fff)
- For read operations, the address is `RD_PTR + offset`.
- For write operations, the address is `WR_PTR + offset`.

> *Note*: It's the responsibility of a particular virtual machine to check the `BL_FLAGS` field to determine when executing the memory access operations.

### Partition mapping

At any time, a virtual machine must be able to return the current _partition_ of a specific (16-bit) address. The partition is the extra information that is suitable to convert an address to a machine address. For example, if a virtual machine uses 8-bit banks with a size of 16K each, the partition is the ID of the bank that is paged into the slot of an address. If we're fetching the address $cb00, which is at slot 3 (if we use 0, 1, 2, and 3 as IDs of 16K page slots). If bank $12 is paged into slot 3, the partition of $cb00 is $12. The extra 7 bytes of an entry within `BLOCK_LOOKUP_TABLE` is a suitable location to store the partition value for a particular block so that it can be quickly retrieved.

> *Note*: The suggestion is that a virtual machine should use the first one or two bytes of the `BL_RESV` field to store the partition associated with the addresses within the block.

### Memory usage diagnostics

The CPU continuously collects information about the use of the 16-bit 64K memory space:
- Addresses affected by a memory read operations (`MEM_WR_MAP`)
- Addresses affected by a memory write operations (`MEM_RD_MAP`)
- Addresses affected by an instruction read operations (`INSTR_RD_MAP`)

To support this operation, the engine uses three maps (`MEM_WR_MAP`, `MEM_RD_MAP`, and `INSTR_RD_MAP`). Each map has 64K entries, each of them is 16-bit.

```
MEM_WR_MAP             MEM_RD_MAP             INSTR_RD_MAP

===================    ===================    ===================
| $0000 (2 bytes) |    | $0000 (2 bytes) |    | $0000 (2 bytes) |
-------------------    -------------------    -------------------
| $0001 (2 bytes) |    | $0001 (2 bytes) |    | $0001 (2 bytes) |
-------------------    -------------------    -------------------
| $0002 (2 bytes) |    | $0002 (2 bytes) |    | $0002 (2 bytes) |
-------------------    -------------------    -------------------
        ...                    ...                    ...
-------------------    -------------------    -------------------
| $fffe (2 bytes) |    | $fffe (2 bytes) |    | $fffe (2 bytes) |
-------------------    -------------------    -------------------
| $ffff (2 bytes) |    | $ffff (2 bytes) |    | $ffff (2 bytes) |
===================    ===================    ===================
```

When the CPU executes any of the three types of memory access listed above, it increments the 16-bit entry addressed within the corresponding operation map. The engine provides methods to reset the contents of these maps.

## Breakpoints

The Klive virtual machine allows defining breakpoints for these scenarios:

- The CPU is about to execute an instruction at a particular 16-bit address (the address is determined by the Program Counter register)
- The Program Counter (PC) is about to execute an instruction at a particular (up to 24-bit) machine address 
- The CPU reads from a particular 16-bit memory address.
    - Can be associated with a hit counter, for example, "stop at the 3rd read".
    - Can be associated with a value read, for example "stop when value $48 is read".
    - These conditions can be combined.
- The CPU writes to a particular 16-bit memory address.
    - Can be associated with a hit counter, for example, "stop at the 5th write".
    - Can be associated with a value written, for example "stop when value $fe is written".
    - These conditions can be combined.
- The CPU reads from a particular 16-bit I/O port given with a port mask and a value to allow diagnosing devices with multiple address.
    - Can be associated with a hit counter, for example, "stop at the 3rd I/O read".
    - Can be associated with a value read, for example "stop when value $f0 is read".
    - These conditions can be combined.
- The CPU writes to a particular 16-bit I/O port given with a port mask and a value to allow diagnosing devices with multiple address.
    - Can be associated with a hit counter, for example, "stop at the 7th I/O write".
    - Can be associated with a value read, for example "stop when value $e3 is written".
    - These conditions can be combined.

> *Note*: A virtual machine also can add its custom breakpoints.

Working with multiple breakpoints requires special techniques to allow the machine run in debug mode with only slight performance degradation. Klive is desinged to cause the minimum performance degradation.

### Instruction and memory breakpoints

Instead of keeping a list of breakpoints, Klive uses address maps. This technique allows using an O(1) algorithm independently from the number of active breakpoints. `BREAKPOINTS_MAP` is a structure of 64K bytes, each having a set of flags to test if a specific breakpoint is set on a particular address. This structure keeps track of instruction and memory breakpoints. I/O breakpoints use a different form.

```
BREAKPOINTS_MAP

====================================
| Flags for address $0000 (1 byte) |
------------------------------------
| Flags for address $0002 (1 byte) |
------------------------------------
| Flags for address $0003 (1 byte) |
------------------------------------
                ...
------------------------------------
| Flags for address $fffe (1 byte) |
------------------------------------
| Flags for address $ffff (1 byte) |
====================================
```

Each byte in `BREAKPOINTS_MAP` uses this bit structure:
- **Bit 0**: Instruction breakpoint
- **Bit 1**: Instruction breakpoint with a machine address
- **Bit 2**: Memory read breakpoint
- **Bit 3**: Memory read breakpoint has hit counter
- **Bit 4**: Memory read breakpoint has value condition
- **Bit 5**: Memory write breakpoint
- **Bit 6**: Memory write breakpoint has hit counter
- **Bit 7**: Memory write breakpoint has value condition

If the entry for a particular address is $00, there is no breakpoint set for that address. Otherwise, one of the instruction or memory breakpoints is specified. Depending on the type of breakpoint, the engine uses other structures, too.

### Instruction breakpoints with machine address

When Bit 1 are set in a `BREAKPOINTS_MAP` entry, the instruction breakpoint is on a machine address. The `BRP_PARTITION_MAP` structure contains the partition information for the address. If both Bit 0 and Bit 1 are set, Bit 0 take priority, so the engine will stop whenever the Program Counter contains the breakpoint address, independently of the current machine address partition.

```
BRP_PARTITION_MAP

=========================================
| Partition for address $0000 (2 bytes) |
-----------------------------------------
| Partition for address $0001 (2 bytes) |
-----------------------------------------
| Partition for address $0002 (2 bytes) |
-----------------------------------------
                   ...
-----------------------------------------
| Partition for address $fffe (2 bytes) |
-----------------------------------------
| Partition for address $ffff (2 bytes) |
=========================================
```

> *Note*: Observe, this structure has a notable limitation. You can set up a machine breakpoint only for a single partition at a time. This design decision is deliberate, as it does not seem to be a significant weakness.

### Memory breakpoints

Two structures, `MEM_RD_CONDITIONS_MAP`, and `MEM_WR_CONDITIONS_MAP`, contain information about memory read and write operation breakpoints. Each entry in these structures take five bytes.

```
MEM_RD_CONDITIONS_MAP, MEM_WR_CONDITIONS_MAP,

==========================================
| Conditions for address $0000 (5 bytes) |
------------------------------------------
| Conditions for address $0001 (5 bytes) |
------------------------------------------
| Conditions for address $0002 (5 bytes) |
------------------------------------------
                   ...
------------------------------------------
| Conditions for address $fffe (5 bytes) |
------------------------------------------
| Conditions for address $ffff (5 bytes) |
==========================================
```

The entries of the map contain these fields:
- `VAL_COND` (1 byte): If Bit 4 or Bit 7 of a `BREAKPOINTS_MAP` entry is set, this 8-bit value contains the condition value to test against the value of the memory operation. The execution engine stops at a breakpoint only if the condition value equals the operation value.
- `HIT_LIMIT` (2 bytes): If Bit 3 or Bit 6 of a `BREAKPOINTS_MAP` entry is set, this 16-bit value contains the hit counter value to reach so that the engine stops at the breakpoint.
- `HIT_COUNT` (2 bytes): The remaining hit count for the memory operation. When a debugging section starts (or reset), the `HIT_LIMIT` value is copied into this field. Each memory operation hit decrements the field value. If it reaches 0, the engine stops at the associated breakpoint.

> *Note*: When both the value condition and the hit count are combined, the engine considers a hit only when the operation value equals the condition value.

### I/O breakpoints

As most I/O ports use partial addresses (the device attached to the port uses only a subset of the A15-A0 address lines), the approach used for memory addresses does not work. Klive uses a particular structure, an array of `IO_BREAKPOINT_ENTRY`items, to keep a list of I/O breakpoints. The current implementation allows up to 32 I/O breakpoints in a debugging section. If it proves to be a limitation, Klive will increase this number in a future release.

```
IO_BREAKPOINTS

=========================================
| Slot for I/O breakpoint 00 (15 bytes) |
-----------------------------------------
| Slot for I/O breakpoint 01 (15 bytes) |
-----------------------------------------
| Slot for I/O breakpoint 02 (15 bytes) |
-----------------------------------------
                   ...
-----------------------------------------
| Slot for I/O breakpoint 30 (15 bytes) |
-----------------------------------------
| Slot for I/O breakpoint 31 (15 bytes) |
=========================================
```

An `IO_BREAKPOINT_ENTRY` contains this information:

- `FLAGS` (1 byte): I/O breakpoint flags. If this value is 0, it means that this entry within `IO_BREAKPOINTS` is unused, and a new breakpoint set in the future will take this information slot.
    - **Bit 0**: I/O read breakpoint
    - **Bit 1**: I/O write breakpoint
- `MASK` (2 bytes): The I/O MASK value to mask out the bits of the address line that should be considered for a particular breakpoint.
- `PORT` (2 bytes): The masked port value. If the binary AND operation between the I/O port and `MASK` results in `PORT`, this entry serves as a descriptor for that particular I/O port.
- `RD_VAL_COND` (1 byte): This 8-bit value contains the condition value to test against the value read from the port. The execution engine stops at a breakpoint only if the I/O read results in this value.
- `RD_HIT_LIMIT` (2 bytes): This 16-bit value contains the hit counter value of the I/O read operation to reach so that the engine stops at the breakpoint.
- `RD_HIT_COUNT` (2 bytes): The remaining hit count for the I/O read operation. When a debugging section starts (or reset), the `RD_HIT_LIMIT` value is copied into this field. Each I/O read operation hit decrements the field value. If it reaches 0, the engine stops at the associated breakpoint.
- `WR_VAL_COND` (1 byte): This 8-bit value contains the condition value to test against the value written to the port. The execution engine stops at a breakpoint only if the I/O write uses this value.
- `WR_HIT_LIMIT` (2 bytes): This 16-bit value contains the hit counter value of the I/O write operation to reach so that the engine stops at the breakpoint.
- `WR_HIT_COUNT` (2 bytes): The remaining hit count for the I/O write operation. When a debugging section starts (or reset), the `WR_HIT_LIMIT` value is copied into this field. Each I/O write operation hit decrements the field value. If it reaches 0, the engine stops at the associated breakpoint.

> *Note*: When both the value condition and the hit count are combined, the engine considers a hit only when the operation value equals the condition value.

The `IO_BREAKPOINTS` array would not provide an O(1) algorithm on its own. The execution engine would use the `IO_INDEX_MAP` structure to check if a particular I/O operation may be the subject of an associated I/O breakpoint. `IO_INDEX_MAP` contains 64K entries, each of is a byte:

```
IO_INDEX_MAP

=======================================
| Index entry for port $0000 (1 byte) |
---------------------------------------
| Index entry for port $0001 (1 byte) |
---------------------------------------
| Index entry for port $0002 (1 byte) |
---------------------------------------
                  ...
---------------------------------------
| Index entry for port $fffe (1 byte) |
---------------------------------------
| Index entry for port $ffff (1 byte) |
=======================================
```

When a byte in this array is $ff, the associated I/O port has no breakpoint. Otherwise, the value contains the index of the corresponding breakpoint entry in `IO_BREAKPOINTS`.

## I/O breakpoints manipulation

The `IO_BREAKPOINTS` list initially holds 32 free slots (having its `FLAGS` value set to 0). Whenever a new I/O breakpoint is defined, the related entry goes into the first available slot (the one with the lowest index value). Removing an I/O breakpoint sets its `FLAGS` value to 0 and so if frees the associated entry in `IO_BREAKPOINTS`.

When either the `MASK` or `PORT` fields of entry is modified, this modification is a sequence of a remove and an insert operation. Any other updates result in an in-place update of the corresponding entry.

The engine re-calculates the contents of the `IO_INDEX_MAP` every time an item is added to or removed from `IO_INDEX_MAP`. The re-calculation starts at index 0 and goes toward index 31.

> *Note*: As a consequence of this implementation, an I/O port address might be affected by multiple breakpoint entries. In this case, the breakpoint entry with a higher index takes priority.
