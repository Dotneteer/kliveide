# Appendix E: Glossary

> **Status:** Initial seed. Entries will be added and refined as the book is written, following the conversational style described in [book-writing-guidelines.md](./book-writing-guidelines.md).

A reference for the technical terminology used throughout the book. Entries are alphabetical. When two terms could be confused, both are listed and cross-referenced.

---

### AY (AY-3-8912)
The classic three-channel programmable sound generator, originally made by General Instrument and used in the 128K Spectrum, the Amstrad CPC, the MSX, and many arcade machines. The Next has three of them, addressed through the same legacy ports as the 128K, with a NextReg-controlled selector to pick which chip is active. See [The AY-3-8912 Family](./17-ay.mdx).

### Bank
A traditional ZX Spectrum 16 KB memory area, named by number (Bank 0 through Bank 7 on the 128K, more on the Next). Banks predate the Next's MMU — when a Next program "pages Bank 5 into the screen area", it's really setting two MMU registers to map Bank 5's two 8 KB **pages** into two adjacent **slots**. See also: **Page**, **Slot**, **Region**.

### CTC (Counter/Timer Circuit)
The Zilog Z80 CTC chip — a four-channel programmable timer. The Next implements one of these in its FPGA. Each channel can act as a timer (dividing the 28 MHz system clock) or a counter (decrementing on the previous channel's output), and each can fire interrupts. Used for code profiling, periodic events, audio sample-rate generation, and DMA pacing. See [The CTC](./05-ctc.mdx).

### DMA (Direct Memory Access)
Hardware that moves bytes between memory and/or I/O ports without CPU involvement. The Next's DMA controller (the **zxnDMA**) can fill memory, copy memory, stream samples to a DAC, and more — all while the CPU does something else. See [zxnDMA](./06-zxndma.mdx).

### IM2 (Interrupt Mode 2)
The Z80's vectored interrupt mode. The interrupt source provides a byte that, combined with the I register, points into a 256-entry table of ISR addresses. On the Next, IM2 is preferred over IM1 because the Next's interrupt controller computes vectors automatically based on a fixed priority for each source. See [Interrupts](./04-interrupts.mdx).

### Layer 2
The Next's true-colour bitmap layer. 256 colours per pixel at 256×192 or 320×256 resolution; 16 colours per pixel at 640×256. Stored in pageable RAM (not Bank 5), composited with ULA, Tilemap, and Sprites by the priority logic. See [Layer 2](./11-layer2.mdx).

### MMU (Memory Management Unit)
The hardware that translates the Z80's 16-bit addresses into 21-bit physical addresses on the Next. Divides the 64 KB Z80 address space into eight 8 KB **slots**, each of which can independently point to any 8 KB **page** in the 2 MB physical pool. Configured via NextRegs `$50`–`$57`. See [Memory Architecture](./03-memory.mdx).

### NEX (file format)
The standard distribution format for ZX Spectrum Next applications. A single file containing a header, the bank/page contents, optional Layer 2 data, and a start-up configuration. Klive builds NEX files automatically when you run `Build | Run` on a Next project. See [Appendix A](./app-A-nex-file-format.md).

### NextReg
A register inside the Next's FPGA, accessed through ports `$243B` (select) and `$253B` (data). NextRegs control everything the Next adds beyond the original Spectrum: CPU speed, MMU, layers, palettes, sprites, audio routing, interrupt sources. Numbered `$00`–`$FF`. See [I/O and NextRegs](./02-io-and-nextregs.mdx) and [Appendix B](./app-B-nextreg-reference.md).

### Page
An 8 KB unit of physical memory that the MMU can map into any **slot**. There are 256 pages in the Next's 2 MB pool. Pages are smaller than the traditional 16 KB **bank** — a single bank consists of two pages. See also: **Slot**, **Region**.

### Region
A 64 KB chunk of physical address space, selected by physical address bits A20:A16 — there are 32 of them in the 2 MB pool. The MMU's address translation formula uses the top three bits of the MMU register as a region selector (with a +1 offset). See [Memory Architecture](./03-memory.mdx).

### Slot
One of eight 8 KB divisions of the Z80's 64 KB address space. Slot 0 is `$0000`–`$1FFF`, Slot 1 is `$2000`–`$3FFF`, and so on through Slot 7 at `$E000`–`$FFFF`. Each slot is independently mapped to a physical **page** by one of the MMU registers (`$50`–`$57`). See also: **Page**, **Bank**, **Region**.

### Sprite
A movable graphic object, independently positioned and styled, composited above (or below) the layered background. The Next provides 128 hardware sprites, each 16×16 pixels with an 8-bit colour index per pixel. See [Hardware Sprites](./13-sprites.mdx).

### T-state
A single tick of the Z80's clock. Each Z80 instruction takes a fixed number of T-states (4 for `NOP`, 12 for `IN A,(C)`, etc.). On the Next, the wall-clock duration of a T-state depends on the CPU speed (NextReg `$07`): 285.7 ns at 3.5 MHz, down to 35.7 ns at 28 MHz.

### Tilemap
The Next's character-grid background layer. A 40×32 (or 80×32) array of tile indices, each cell pointing to an 8×8 (or 16×16) pattern in tile memory. Hardware-rendered every frame, hardware-scrolled, and composited above or below the ULA layer depending on per-cell or global priority bits. See [The Tilemap](./12-tilemap.mdx).

### ULA (Uncommitted Logic Array)
The original ZX Spectrum's video and I/O chip. On the Next it's recreated in the FPGA, complete with attribute clash and contended memory timing. The "ULA layer" is the classic 256×192 bitmap with 32×24 attributes, still drawn from Bank 5. See [The ULA Screen and Border](./08-ula-screen.mdx).

### Z80N
The Next's Z80 implementation. Fully compatible with the original Zilog Z80 (same instructions, same flags, same timing in 3.5 MHz mode), but with an extension instruction set that adds hardware multiply, fast NextReg writes, barrel shifts, block-copy variants, and more. See [Z80N: The Next's Z80 CPU](./01-z80n.mdx).

### zxnDMA
The Next's DMA controller. Loosely based on the Zilog Z80 DMA but simplified for the Next's needs and accessed through port `$6B`. See [zxnDMA](./06-zxndma.mdx) and **DMA**.
